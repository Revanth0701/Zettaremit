"""Opt-in production-mode TiDB smoke test with synthetic inserts and live Gemini.

Retains synthetic rows. Never creates schema, deletes rows, or prints credentials.
Starts only a private loopback Java process; FastAPI runs through its ASGI client.
"""
import argparse
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import build_opener, ProxyHandler

ROOT = Path('/app') if Path('/app/backend').is_dir() else Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live', action='store_true')
    args = parser.parse_args()
    if not args.live:
        parser.error('--live required: inserts synthetic TiDB rows and calls Gemini')
    from database_config import load_cloud_config
    from settings import setting
    from fastapi.testclient import TestClient

    config = load_cloud_config()
    assert config.connect_args['ssl'].check_hostname
    for key in ('GEMINI_API_KEY', 'GEMINI_MODEL', 'RAG_EMBEDDING_PROVIDER',
                'RAG_EMBEDDING_MODEL'):
        value = setting(key)
        if value is not None:
            os.environ[key] = value
    os.environ.update(APP_ENV='production', DATABASE_MODE='cloud',
                      LOCAL_CREATE_TABLES='false', SCHEMA_REVISION='20261023_01',
                      JWT_SECRET_KEY=secrets.token_hex(32),
                      INTERNAL_SERVICE_TOKEN=secrets.token_hex(32),
                      CORS_ORIGINS='https://synthetic.example.com',
                      ENABLE_AI_ASSISTANT='true', ENABLE_AI_AGENT='true',
                      DB_HOST=config.url.host, DB_PORT=str(config.url.port),
                      DB_NAME=config.url.database, DB_USER=config.url.username,
                      DB_PASSWORD=config.url.password,
                      DB_CA_PATH=os.environ.get('DB_CA_PATH', str((ROOT/'backend/certs/tidb-ca.pem').resolve())))
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    os.environ['INTERNAL_SERVICE_URL'] = f'http://127.0.0.1:{port}'
    java_env = {key: value for key, value in os.environ.items() if key in (
        'PATH', 'JAVA_HOME', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP')}
    java_env.update(PORT=str(port), BIND_ADDRESS='127.0.0.1',
                    INTERNAL_SERVICE_TOKEN=os.environ['INTERNAL_SERVICE_TOKEN'])
    outcomes = []

    def record(name, ok, **safe_details):
        outcomes.append(dict(check=name, passed=bool(ok), **safe_details))
        print(json.dumps(outcomes[-1]), flush=True)
        return ok

    api = None
    with tempfile.TemporaryFile() as logs:
        child = subprocess.Popen(['java', '-Xms32m', '-Xmx160m', '-jar', str(
            ROOT/'transaction-service.jar' if ROOT == Path('/app') else ROOT/'services/transaction-service/build/libs/transaction-service-0.0.1-SNAPSHOT.jar')],
            env=java_env, stdout=logs, stderr=logs,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        try:
            opener = build_opener(ProxyHandler({}))
            deadline = time.monotonic() + 60
            while child.poll() is None and time.monotonic() < deadline:
                try:
                    if opener.open(f'http://127.0.0.1:{port}/health', timeout=1).status == 200:
                        break
                except OSError:
                    time.sleep(.25)
            else:
                raise RuntimeError('Java startup failed')
            record('private_java_startup', True)
            import main as api
            with TestClient(api.app, raise_server_exceptions=False) as client:
                record('health', client.get('/health').status_code == 200)
                record('authentication_required', client.get('/transactions/').status_code == 401
                       and client.get('/transactions/', headers={'Authorization':'Bearer invalid'}).status_code == 401)
                accounts = []
                for i in range(2):
                    body = dict(full_name='Synthetic TiDB Smoke Tester',
                                email=f'tidb-smoke-{secrets.token_hex(8)}@example.com',
                                password=secrets.token_urlsafe(24))
                    registration = client.post('/users/register', json=body)
                    assert record('registration', registration.status_code == 201, http_status=registration.status_code)
                    login_body = {key: body[key] for key in ('email','password')}
                    login = client.post('/users/login', json=login_body)
                    assert record('login', login.status_code == 200, http_status=login.status_code)
                    wrong = client.post('/users/login', json=dict(login_body, password='synthetic-wrong-password'))
                    record('wrong_password_rejected', wrong.status_code == 401)
                    accounts.append({'Authorization':'Bearer '+login.json()['access_token']})
                a,b = accounts
                rate = client.get('/simulation/rate', headers=a)
                record('live_exchange_rate', rate.status_code == 200, http_status=rate.status_code)
                request = dict(recipient_name='Synthetic Recipient', gross_amount='1000.00')
                quote = client.post('/simulation/quote', headers=a, json=request)
                if record('live_quote', quote.status_code == 200, http_status=quote.status_code):
                    details = quote.json()
                    record('decimal_fee', details['fee_deducted'] == '30.00')
                    headers = dict(a, **{'Idempotency-Key':secrets.token_hex(16)})
                    body = dict(request, quote_token=details['quote_token'])
                    tx = client.post('/transactions/create', headers=headers, json=body)
                    if record('simulated_transaction', tx.status_code == 201, http_status=tx.status_code):
                        transaction = tx.json()['transaction']
                        record('simulation_status', transaction['status'] == 'SIMULATED')
                        replay = client.post('/transactions/create', headers=headers, json=body)
                        record('idempotent_replay', replay.status_code == 201 and
                               replay.json()['transaction']['transaction_id'] == transaction['transaction_id'])
                        own = client.get('/transactions/', headers=a)
                        other = client.get('/transactions/', headers=b)
                        record('persisted_history_and_isolation', own.status_code == other.status_code == 200
                               and any(t['transaction_id'] == transaction['transaction_id'] for t in own.json())
                               and not other.json())
                record('ai_authentication_required', client.post('/ai/ask', json={'question':'fees'}).status_code == 401)
                try:
                    from ai.gemini_client import GeminiClient
                    gemini = GeminiClient()
                    answer = gemini.chat('Reply with the word ready.', max_tokens=16)
                    record('live_gemini_generation', bool(answer.strip()), model=gemini.model)
                except Exception as error:
                    record('live_gemini_generation', False, category=type(error).__name__)
                response = client.post('/ai/ask', headers=a, json={'question':'What is the ZettaRemit platform fee?'})
                data = response.json()
                record('authenticated_ai_integration', response.status_code == 200 and
                       bool(data.get('answer')) and not data.get('error'), http_status=response.status_code,
                       error=data.get('error'))
        except Exception as error:
            record('smoke_execution', False, category=type(error).__name__)
        finally:
            if api is not None:
                api.engine.dispose()
            if child.poll() is None:
                child.terminate()
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                child.kill(); child.wait()
    report = dict(checks=outcomes, passed=bool(outcomes) and all(item['passed'] for item in outcomes),
                  synthetic_rows_retained=True, schema_changes=False)
    destination = Path('/tmp/zettaremit-smoke') if ROOT == Path('/app') else ROOT/'.local-backups/production-readiness'
    destination.mkdir(parents=True, exist_ok=True)
    (destination/'tidb-smoke.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
