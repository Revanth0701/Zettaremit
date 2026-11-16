"""Explicit live smoke test: local-only DB writes and limited Gemini calls.

Run with --live after configuring backend/.env. Synthetic accounts/transactions
are retained for inspection; no cleanup deletes, schema changes or migrations.
Credentials and model prompts/results are never printed. Services started here
are stopped in finally. This is not collected by ordinary backend unit tests.
"""
import argparse
from contextlib import ExitStack
from dataclasses import replace
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live', action='store_true', help='Authorize live API calls and synthetic local inserts')
    args = parser.parse_args()
    if not args.live:
        parser.error('--live is required; this test can incur Gemini API charges')

    from settings import setting
    from database_config import load_database_config, create_database_engine
    from sqlalchemy.engine import make_url
    from sqlalchemy import text
    import httpx
    import uvicorn

    cfg = load_database_config()
    url = make_url(cfg.url)
    assert cfg.mode == 'local' and url.host == '127.0.0.1' and (url.port or 3306) == 3306
    assert url.database == 'zettaremit_ai_dev' and setting('APP_ENV') == 'development'
    assert setting('LOCAL_CREATE_TABLES') == 'false'
    assert setting('ENABLE_AI_ASSISTANT') == 'true' and setting('ENABLE_AI_AGENT') == 'true'
    assert setting('RAG_EMBEDDING_PROVIDER') == 'gemini'
    for port in (8000, 8082):
        with socket.socket() as sock:
            assert sock.connect_ex(('127.0.0.1', port)) != 0, 'Required loopback port is already in use'

    # Only the isolated database is read or written throughout this test.
    engine = create_database_engine(cfg)
    with engine.connect() as connection:
        before = {table: connection.execute(text(f'SELECT COUNT(*) FROM `{table}`')).scalar_one()
                  for table in ('users', 'user_verifications', 'transactions')}
    engine.dispose()

    outcomes = []
    def record(name, ok, **details):
        item = dict(check=name, result='PASS' if ok else 'FAIL', **details)
        outcomes.append(item)
        print(json.dumps(item), flush=True)
        return ok

    java = None
    server = None
    thread = None
    trace = []
    try:
        with ExitStack() as stack:
            logfile = stack.enter_context(tempfile.TemporaryFile())
            java_env = {key: value for key, value in os.environ.items() if key in (
                'PATH', 'JAVA_HOME', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE')}
            java_env.update(INTERNAL_SERVICE_TOKEN=setting('INTERNAL_SERVICE_TOKEN'),
                            PORT='8082', BIND_ADDRESS='127.0.0.1')
            jar = ROOT / 'services/transaction-service/build/libs/transaction-service-0.0.1-SNAPSHOT.jar'
            if jar.exists():
                java = subprocess.Popen(['java', '-Xms32m', '-Xmx160m', '-jar', str(jar)],
                    env=java_env, stdout=logfile, stderr=logfile,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            client = stack.enter_context(httpx.Client(base_url='http://127.0.0.1:8000', timeout=120, trust_env=False))
            with httpx.Client(timeout=2, trust_env=False) as probe:
                deadline = time.monotonic()+45
                java_ready = False
                while java and java.poll() is None and time.monotonic() < deadline:
                    try:
                        java_ready = probe.get('http://127.0.0.1:8082/health').status_code == 200
                        if java_ready:
                            break
                    except httpx.HTTPError:
                        pass
                    time.sleep(.25)
            record('java_startup', java_ready)

            import main as api
            from ai.hybrid import get_knowledge_index, KnowledgeIndex
            from ai.agent import AgentTools, confirm_support
            original_execute = AgentTools.execute
            def traced(tools, name, arguments):
                result = original_execute(tools, name, arguments)
                trace.append(dict(tool=name, success='error' not in result))
                return result
            AgentTools.execute = traced
            stack.callback(setattr, AgentTools, 'execute', original_execute)

            server = uvicorn.Server(uvicorn.Config(api.app, host='127.0.0.1', port=8000,
                                                   log_level='warning', access_log=False))
            thread = threading.Thread(target=server.run, daemon=True)
            thread.start()
            deadline = time.monotonic()+60
            while not server.started and thread.is_alive() and time.monotonic() < deadline:
                time.sleep(.2)
            if not record('fastapi_startup', server.started):
                return 1
            index = get_knowledge_index()
            snapshot = index._snapshot
            record('live_document_index', bool(snapshot and snapshot.vectors) and len({c['source'] for c in snapshot.chunks}) == 8,
                   documents=len({c['source'] for c in snapshot.chunks}), chunks=len(snapshot.chunks),
                   vector_dimensions=len(snapshot.vectors[0]) if snapshot.vectors else 0, error=index.last_error)
            for question, expected in [('What is the platform fee?', 'fees_and_rates.md'),
                                       ('What currencies can I send?', 'currencies_and_corridors.md')]:
                results = index.query(question)
                record('live_hybrid_retrieval', bool(results) and any(c['source'] == expected for c in results)
                       and results[0]['retrieval']['mode'] == 'hybrid',
                       sources=[c['source'] for c in results], final_chunks=len(results),
                       mode=results[0]['retrieval']['mode'] if results else 'empty')

            # Reuse actual cached document vectors; modified synthetic text never
            # enters the application's approved knowledge directory.
            with tempfile.TemporaryDirectory() as directory:
                temp = Path(directory)
                for source in index.directory.glob('*.md'):
                    shutil.copyfile(source, temp/source.name)
                refreshed = KnowledgeIndex(temp, index.embeddings, replace(index.config, interval=0))
                refreshed._cache = dict(index._cache)
                refreshed.sync(True)
                old = refreshed._snapshot.version
                source = temp/'about_zettaremit.md'
                original = source.read_text(encoding='utf-8')
                source.write_text(original+'\n## Synthetic smoke test\nThis temporary copy verifies local knowledge synchronization.\n', encoding='utf-8')
                refreshed.sync(True)
                record('live_knowledge_refresh', refreshed._snapshot.version != old and bool(refreshed._snapshot.vectors))

            missing_auth = [client.post(path, json={'question':'test'}).status_code == 401
                            for path in ('/ai/ask','/ai/ask-stream','/ai/agent/ask','/ai/agent/ask-stream')]
            record('unauthenticated_ai_rejected', all(missing_auth))
            cors = client.options('/ai/ask-stream', headers={'Origin':'http://localhost:8081',
                                  'Access-Control-Request-Method':'POST',
                                  'Access-Control-Request-Headers':'authorization,content-type'})
            record('local_cors', cors.status_code == 200 and cors.headers.get('access-control-allow-origin') == 'http://localhost:8081')

            accounts = []
            for number in (1,2):
                email = f'ai-smoke-{secrets.token_hex(6)}@example.com'
                password = secrets.token_urlsafe(24)
                registration = client.post('/users/register',json={'full_name':f'Synthetic AI Tester {number}',
                                           'email':email,'password':password})
                login = client.post('/users/login',json={'email':email,'password':password})
                assert registration.status_code == 201 and login.status_code == 200
                data = login.json()
                accounts.append(dict(headers={'Authorization':'Bearer '+data['access_token']}, owner=data['user_id'],
                                     token=data['access_token'], expires_in=data['expires_in']))
            record('registration_and_login', True, synthetic_accounts=2)
            a,b = accounts
            rate = client.get('/simulation/rate',headers=a['headers'])
            record('live_reference_rate', rate.status_code == 200, http_status=rate.status_code)
            transactions = []
            for account in accounts:
                if not java_ready:
                    break
                request = {'recipient_name':'Synthetic Recipient', 'gross_amount':'10000.00'}
                quote = client.post('/simulation/quote',headers=account['headers'],json=request)
                if not record('java_quote_integration', quote.status_code == 200, http_status=quote.status_code):
                    continue
                details = quote.json()
                assert details['source_currency'] == 'INR' and details['target_currency'] == 'USD' and details['simulation']
                assert details['fee_deducted'] == '300.00'
                key = secrets.token_hex(16)
                headers = dict(account['headers'], **{'Idempotency-Key':key})
                body = dict(request,quote_token=details['quote_token'])
                transfer = client.post('/transactions/create',headers=headers,json=body)
                assert transfer.status_code == 201
                transaction = transfer.json()['transaction']
                assert transaction['status'] == 'SIMULATED'
                replay = client.post('/transactions/create',headers=headers,json=body)
                record('simulated_transfer_and_idempotency', replay.status_code == 201 and replay.json()['transaction']['transaction_id'] == transaction['transaction_id'])
                transactions.append(transaction)

            tools_a = api.agent_tools_for_user(a['owner'])
            record('invalid_tool_arguments', tools_a.execute('get_latest_transaction', {'user_id':b['owner']}).get('error') == 'invalid_tool_arguments')
            record('unauthorized_tool_rejected', tools_a.execute('execute_sql', {'sql':'SELECT 1'}).get('error') == 'tool_not_allowed')
            record('server_identity_enforced',client.get('/transactions/',params={'sender_id':b['owner']},headers=a['headers']).status_code == 403)
            invalid = client.post('/ai/agent/ask',headers=a['headers'],json={'question':'latest','user_id':b['owner']})
            record('llm_identity_payload_rejected', invalid.status_code == 422)
            if len(transactions) == 2:
                own, other = transactions
                record('cross_user_tool_isolation', tools_a.execute('get_transaction_details', {'transaction_id':other['transaction_id']}).get('error') == 'transaction_not_found')
                record('latest_owned_transaction', tools_a.execute('get_latest_transaction', {})['transaction_id'] == own['transaction_id'])
                draft = tools_a.execute('prepare_support_request', {'transaction_id':own['transaction_id'],'issue':'status_question'})
                token = draft['draft_token']
                no = client.post('/ai/support/confirm',headers=a['headers'],json={'draft_token':token,'confirmed':False})
                wrong = client.post('/ai/support/confirm',headers=b['headers'],json={'draft_token':token,'confirmed':True})
                yes = client.post('/ai/support/confirm',headers=a['headers'],json={'draft_token':token,'confirmed':True})
                repeat = client.post('/ai/support/confirm',headers=a['headers'],json={'draft_token':token,'confirmed':True})
                record('support_confirmation_and_unavailable_backend', no.status_code == 422 and wrong.status_code == 422 and
                       yes.status_code == repeat.status_code == 503 and not yes.json()['submitted'] and not repeat.json()['submitted'])
                trace.clear()
                question = ('Check my latest simulated transfer and its recorded status. Get the current USD/INR reference rate, '
                            'calculate a simulated estimate for 10000 INR to USD, search the knowledge base for fee policy, '
                            'and prepare a status_question support draft for that transfer. Do not submit anything.')
                result = client.post('/ai/agent/ask',headers=a['headers'],json={'question':question,'session_id':secrets.token_hex(16)})
                data = result.json()
                expected_tools={'get_latest_transaction','get_exchange_rate','calculate_transfer_estimate','search_knowledge','prepare_support_request'}
                record('live_authenticated_agent_multistep',result.status_code == 200 and not data.get('error') and bool(data.get('answer'))
                       and expected_tools.issubset({item['tool'] for item in trace}) and bool(data.get('drafts')),
                       http_status=result.status_code, error=data.get('error'), tools=list(trace),
                       usage=data.get('usage',{}), has_draft=bool(data.get('drafts')))

            # Exercise the actual frontend client against the real HTTP/SSE server.
            node_source = '''
const {createClient}=require('./frontend/lib/client');
let input='';process.stdin.on('data',chunk=>input+=chunk);
process.stdin.on('end',async()=>{
  try {
    const session=JSON.parse(input);const observed=[];
    const client=createClient({baseUrl:'http://127.0.0.1:8000',allowHttp:true,fetchImpl:fetch,
      storage:{get:async()=>session,clear:async()=>{},set:async()=>{}},onUnauthorized:()=>{}});
    const result=await client.aiAskStream('What is the ZettaRemit fee and does this simulation move real money?',
      'synthetic-client-session-12345',{onSources:s=>observed.push(...s)});
    const ok=!!result.answer&&result.sources.length>0&&observed.length>0;
    console.log(JSON.stringify({check:'live_frontend_client_sse',result:ok?'PASS':'FAIL',sources:result.sources,
                               received_sources_callback:observed.length>0}));
    process.exitCode=ok?0:1;
  } catch(error) {
    console.log(JSON.stringify({check:'live_frontend_client_sse',result:'FAIL',code:error.code||'REQUEST_FAILED',status:error.status||null}));
    process.exitCode=1;
  }
});
'''
            session = json.dumps({'token':b['token'],'expiresAt':int(time.time()*1000)+b['expires_in']*1000})
            node = subprocess.run(['node','-e',node_source],input=session,text=True,capture_output=True,cwd=ROOT,timeout=120)
            for line in node.stdout.splitlines():
                try:
                    item=json.loads(line)
                    if item.get('check')=='live_frontend_client_sse':
                        outcomes.append(item);print(json.dumps(item),flush=True)
                except ValueError:
                    pass
            record('frontend_client_process',node.returncode==0)

            # Public rate/estimate tools invoke real provider and backend Decimal math.
            estimate=tools_a.execute('calculate_transfer_estimate',{'amount':'10000.00'})
            record('deterministic_estimate_tool','error' not in estimate and estimate.get('fee')=='300.00' and estimate.get('simulation') is True)
            with api.SessionLocal() as db:
                after={table:db.execute(text(f'SELECT COUNT(*) FROM `{table}`')).scalar_one() for table in before}
            record('synthetic_data_retained',after['users']==before['users']+2 and after['user_verifications']==before['user_verifications']+2,
                   added_rows={table:after[table]-before[table] for table in before})
    except Exception as error:
        # Never stringify transport/driver exceptions containing credentials or tokens.
        record('integration_workflow',False,error_type=type(error).__name__)
    finally:
        if server is not None:
            server.should_exit=True
        if thread is not None:
            thread.join(timeout=15)
        if java is not None and java.poll() is None:
            java.terminate()
            try:
                java.wait(timeout=10)
            except subprocess.TimeoutExpired:
                java.kill();java.wait(timeout=5)
    failed=[item['check'] for item in outcomes if item['result']=='FAIL']
    print(json.dumps({'summary':{'passed':len(outcomes)-len(failed),'failed':len(failed),'failed_checks':failed,
                               'services_stopped':not (thread and thread.is_alive()),
                               'database':'zettaremit_ai_dev','live_calls':True}}),flush=True)
    return int(bool(failed))


if __name__=='__main__':
    raise SystemExit(main())
