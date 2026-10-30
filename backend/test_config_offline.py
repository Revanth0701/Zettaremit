import ast
from pathlib import Path
import ssl
import unittest
from unittest.mock import Mock, mock_open, patch
import database_config as dc

class ConfigTests(unittest.TestCase):
    def test_default_local_and_precedence(self):
        with patch.object(dc,'dotenv_values',return_value={'DATABASE_URL':'synthetic-local'}),patch.object(dc,'load_cloud_config') as cloud:
            self.assertEqual(dc.load_database_config(environ={}).mode,'local')
            self.assertEqual(dc.load_database_config(environ={'DATABASE_URL':'override'}).url,'override')
            cloud.assert_not_called()
    def test_explicit_cloud_and_invalid_modes(self):
        with patch.object(dc,'load_cloud_config',return_value='cloud') as cloud:
            self.assertEqual(dc.load_database_config(environ={'DATABASE_MODE':'cloud'}),'cloud')
            cloud.assert_called_once()
        for mode in ('','Cloud','invalid'):
            with self.assertRaises(dc.ConfigurationError):dc.load_database_config(environ={'DATABASE_MODE':mode})
    def test_cloud_literal_password_and_strict_tls(self):
        env={'AIVEN_HOST':'synthetic.invalid','AIVEN_PORT':'12345','AIVEN_DATABASE':'synthetic','AIVEN_USER':'synthetic','AIVEN_PASSWORD':'literal#${secret}@:/','AIVEN_CA_PATH':'ca.pem','APP_ENV':'production'}
        context=Mock()
        with patch.object(Path,'is_file',return_value=False),patch.object(dc.ssl,'create_default_context',return_value=context):
            cfg=dc.load_cloud_config(environ=env)
            self.assertEqual(cfg.url.password,env['AIVEN_PASSWORD'])
            self.assertTrue(context.check_hostname)
            self.assertEqual(context.verify_mode,ssl.CERT_REQUIRED)
            self.assertEqual(context.minimum_version,ssl.TLSVersion.TLSv1_2)
    def test_no_insecure_ca_fallback(self):
        with patch.object(Path,'is_file',return_value=False),patch.object(dc.ssl,'create_default_context',side_effect=FileNotFoundError):
            with self.assertRaises(dc.ConfigurationError):dc.load_cloud_config(environ=dict(AIVEN_HOST='synthetic',AIVEN_PORT='123',AIVEN_DATABASE='synthetic',AIVEN_USER='synthetic',AIVEN_PASSWORD='synthetic',AIVEN_CA_PATH='missing'))
    def test_cloud_create_all_guard(self):
        tree=ast.parse((Path(__file__).parent/'main.py').read_text(encoding='utf-8'))
        guard=next(n for n in tree.body if isinstance(n,ast.If) and 'database_config.mode' in ast.unparse(n.test) and 'LOCAL_CREATE_TABLES' in ast.unparse(n.test))
        metadata=Mock();config=Mock();config.mode='cloud'
        exec(compile(ast.Module(body=[guard],type_ignores=[]),'<guard>','exec'),dict(database_config=config,production=lambda:False,setting=lambda *args:'true',Base=Mock(metadata=metadata)))
        metadata.create_all.assert_not_called()
    def test_sanitized_wrapped_errors(self):
        from pymysql.err import OperationalError
        from sqlalchemy.exc import OperationalError as Wrapped
        message=dc.safe_error_summary(Wrapped('sensitive sql',{},OperationalError(1045,'sensitive password')))
        self.assertIn('1045',message);self.assertNotIn('sensitive',message)

if __name__=='__main__':unittest.main()
