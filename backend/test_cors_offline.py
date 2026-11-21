"""Exercise main.py's actual CORS configuration without importing its DB/AI startup."""
import ast
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent))
from settings import setting, production

NEW = 'https://zettaremit.pages.dev'
OLD = 'https://zettaremit-app.pages.dev'


class CorsTests(unittest.TestCase):
    def app(self, origins=None, environment='production'):
        # Execute the existing assignment, validation guard and middleware call.
        # No duplicated allowlist/middleware implementation and no DB/model import.
        tree = ast.parse((Path(__file__).parent/'main.py').read_text(encoding='utf-8'))
        start = next(i for i,n in enumerate(tree.body) if isinstance(n,ast.Assign)
                     and any(isinstance(t,ast.Name) and t.id=='origins' for t in n.targets))
        block = ast.Module(body=tree.body[start:start+3],type_ignores=[])
        app = FastAPI()
        @app.get('/health')
        def health(): return {'status':'ok'}
        env = {'APP_ENV':environment}
        if origins is not None: env['CORS_ORIGINS'] = origins
        with patch.dict(os.environ,env,clear=True), patch('settings.dotenv_values',return_value={}):
            exec(compile(block,'<actual-main-cors>','exec'),
                 {'app':app,'setting':setting,'production':production,'CORSMiddleware':CORSMiddleware})
        return app

    def preflight(self, client, origin, method='GET'):
        return client.options('/health',headers={'Origin':origin,
            'Access-Control-Request-Method':method,
            'Access-Control-Request-Headers':'authorization,content-type,idempotency-key'})

    def test_health_preflight_allows_both_cloudflare_origins(self):
        with TestClient(self.app(NEW+','+OLD)) as client:
            for origin in (NEW,OLD):
                with self.subTest(origin=origin):
                    r = self.preflight(client,origin)
                    self.assertEqual(r.status_code,200)
                    self.assertEqual(r.headers['access-control-allow-origin'],origin)
                    self.assertIn('Origin',r.headers['vary'])

    def test_authenticated_post_headers_are_permitted_without_wildcards(self):
        with TestClient(self.app(NEW+','+OLD)) as client:
            for origin in (NEW,OLD):
                r = self.preflight(client,origin,'POST')
                self.assertEqual(r.status_code,200)
                allowed = r.headers['access-control-allow-headers'].lower()
                for header in ('authorization','content-type','idempotency-key'):
                    self.assertIn(header,allowed)
                self.assertNotEqual(r.headers['access-control-allow-origin'],'*')
                # The client uses explicit bearer headers, not cookie credentials.
                self.assertNotEqual(r.headers.get('access-control-allow-credentials'),'true')

    def test_actual_health_response_has_exact_allowed_origin(self):
        with TestClient(self.app(NEW+','+OLD)) as client:
            for origin in (NEW,OLD):
                r = client.get('/health',headers={'Origin':origin})
                self.assertEqual(r.status_code,200)
                self.assertEqual(r.headers['access-control-allow-origin'],origin)

    def test_unapproved_origins_and_methods_remain_blocked(self):
        with TestClient(self.app(NEW+','+OLD)) as client:
            for origin in ('https://evil.invalid',NEW+'.evil.invalid','null'):
                r = self.preflight(client,origin)
                self.assertEqual(r.status_code,400)
                self.assertNotIn('access-control-allow-origin',r.headers)
            self.assertEqual(self.preflight(client,NEW,'DELETE').status_code,400)

    def test_existing_development_origins_unchanged(self):
        with TestClient(self.app(environment='development')) as client:
            for origin in ('http://localhost:8081','http://127.0.0.1:8081'):
                r = self.preflight(client,origin)
                self.assertEqual(r.status_code,200)
                self.assertEqual(r.headers['access-control-allow-origin'],origin)

    def test_production_rejects_wildcard_and_http_origin_configuration(self):
        for origins in ('*','http://localhost:8081',NEW+',*'):
            with self.subTest(origins=origins), self.assertRaises(RuntimeError):
                self.app(origins)

    def test_old_only_setting_reproduces_new_site_failure(self):
        with TestClient(self.app(OLD)) as client:
            self.assertEqual(self.preflight(client,OLD).status_code,200)
            r = self.preflight(client,NEW)
            self.assertEqual(r.status_code,400)
            self.assertNotIn('access-control-allow-origin',r.headers)


if __name__=='__main__': unittest.main()
