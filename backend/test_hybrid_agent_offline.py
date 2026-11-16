"""No paid calls: deterministic vectors, Gemini responses and provider snapshots."""
import asyncio
from datetime import datetime, timezone
from decimal import Decimal
import importlib
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import time
from types import SimpleNamespace as NS
import unittest
from unittest.mock import AsyncMock, Mock, patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from google.genai import types

from backend.ai.hybrid import KnowledgeIndex, RetrievalConfig, Embeddings, fuse
from backend.ai.agent import Agent, AgentTools, confirm_support, declarations, transaction_data
from backend.ai.agent_router import create_agent_router
from backend.ai import router
from backend.auth import issue_access_token


class Vectors:
    identity = 'test:model'
    provider = 'local'

    def __init__(self):
        self.documents = 0
        self.fail = False

    def embed(self, texts, query=False):
        if self.fail:
            raise RuntimeError('synthetic failure')
        if not query:
            self.documents += len(texts)
        return [[1, 0] if any(w in t.lower() for w in ('price', 'charge', 'fee')) else [0, 1] for t in texts]


class HybridTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.vector = Vectors()
        self.index = KnowledgeIndex(self.root, self.vector, RetrievalConfig(interval=0))
        self.write('fees.md', '# Pricing\nService charge is 3 percent.')
        self.write('security.md', '# Security\nAuthentication uses JWT bearer tokens.')

    def write(self, name, text):
        (self.root / name).write_text(text, encoding='utf-8')

    def test_keyword_semantic_and_metadata(self):
        self.assertEqual(self.index.query('JWT')[0]['source'], 'security.md')
        # "price" does not occur in the source; fake semantic model supplies its relation.
        result = self.index.query('price')[0]
        self.assertEqual(result['source'], 'fees.md')
        self.assertEqual(result['retrieval']['mode'], 'hybrid')
        self.assertIn('source_version', result)
        self.assertGreater(result['rrf_score'], 0)

    def test_rrf_dedup_and_rank(self):
        a, b = {'chunk_id': 'a'}, {'chunk_id': 'b'}
        results = fuse([[a, a, b], [b, a]], 60)
        self.assertEqual(len(results), 2)
        scores = {r['chunk_id']: r['rrf_score'] for r in results}
        self.assertAlmostEqual(scores['a'], 1/61+1/62)

    def test_add_modify_delete_unchanged_and_restart(self):
        self.index.sync(True)
        first = self.index._snapshot
        count = self.vector.documents
        self.assertFalse(self.index.sync(True))
        self.assertEqual(count, self.vector.documents)
        self.write('new.md', '# Limits\nMaximum simulation limit.')
        self.assertTrue(self.index.sync(True))
        self.assertEqual(self.vector.documents, count+1)
        unchanged = next(c['chunk_id'] for c in self.index._snapshot.chunks if c['source'] == 'fees.md')
        self.write('security.md', '# Security\nTokens expire quickly.')
        self.index.sync(True)
        self.assertNotEqual(first.version, self.index._snapshot.version)
        self.assertIn(unchanged, [c['chunk_id'] for c in self.index._snapshot.chunks])
        (self.root/'fees.md').unlink()
        self.index.sync(True)
        self.assertNotIn('fees.md', [c['source'] for c in self.index._snapshot.chunks])
        restarted = KnowledgeIndex(self.root, Vectors(), RetrievalConfig(interval=0))
        restarted.sync(True)
        self.assertEqual(restarted._snapshot.version, self.index._snapshot.version)

    def test_failed_rebuild_keeps_both_indexes_and_recovers(self):
        self.index.sync(True)
        snapshot = self.index._snapshot
        self.write('fees.md', '# Fees\nA changed fee policy.')
        self.vector.fail = True
        self.assertFalse(self.index.sync(True))
        self.assertIs(snapshot, self.index._snapshot)
        self.assertEqual(len(snapshot.chunks), len(snapshot.vectors))
        self.vector.fail = False
        self.assertTrue(self.index.sync(True))
        self.assertIsNone(self.index.last_error)

    def test_empty_and_missing_model_fallback(self):
        for path in self.root.glob('*.md'):
            path.unlink()
        self.assertEqual(self.index.query('anything'), [])
        self.write('fees.md', '# Fees\nService charge applies.')
        self.vector.fail = True
        self.index.sync(True)
        self.assertEqual(self.index.query('charge')[0]['retrieval']['mode'], 'bm25')

    def test_query_failure_strict_and_fallback(self):
        self.index.sync(True)
        self.vector.fail = True
        self.assertEqual(self.index.query('JWT')[0]['retrieval']['mode'], 'bm25')
        self.index.config = RetrievalConfig(fallback=False, interval=0)
        with self.assertRaises(RuntimeError):
            self.index.query('JWT')

    def test_configuration_and_final_limit(self):
        with patch.dict(os.environ, {'RAG_FINAL_CHUNKS': '1', 'RAG_VECTOR_CANDIDATES': '2'}):
            config = RetrievalConfig.environment()
        self.index.config = config
        self.assertEqual(len(self.index.query('charge JWT')), 1)
        with patch.dict(os.environ, {'RAG_FINAL_CHUNKS': '0'}):
            with self.assertRaises(ValueError):
                RetrievalConfig.environment()

    def test_missing_provider_strict_initial_failure(self):
        with patch.dict(os.environ, {'RAG_EMBEDDING_PROVIDER': 'none'}):
            index = KnowledgeIndex(self.root, Embeddings(), RetrievalConfig(fallback=False))
            with self.assertRaises(RuntimeError):
                index.sync(True)

    def test_hosted_query_uses_public_words_only(self):
        self.vector.provider = 'gemini'
        original = self.vector.embed
        self.vector.embed = Mock(side_effect=original)
        self.index.query('JWT customer Alice alice@example.com 123456 secret')
        query_text = self.vector.embed.call_args.args[0][0]
        self.assertEqual(query_text, 'jwt')


class ToolTests(unittest.TestCase):
    def setUp(self):
        self.key = patch.dict(os.environ, {'JWT_SECRET_KEY': 'synthetic-test-signing-key-at-least-32-bytes'})
        self.key.start()
        self.addCleanup(self.key.stop)
        now = datetime.now(timezone.utc)
        self.provider = Mock()
        self.provider.get_rate.return_value = NS(inr_per_usd=Decimal('80'), observed_at=now,
            fetched_at=now, schedule_overdue=False, attribution_text='Synthetic provider', attribution_url='https://example.invalid')
        self.lookup = Mock(return_value={'transaction_id': 'TXN-owned', 'status': 'SIMULATED'})
        self.tools = AgentTools('owner', self.lookup, Mock(return_value={'status': 'SIMULATED'}),
                                rate_provider=self.provider, index=Mock())

    def test_argument_validation_and_allowlist(self):
        for name, args in [('shell', {}), ('get_latest_transaction', {'user_id': 'victim'}),
                           ('get_transaction_details', {'transaction_id': '../bad'}),
                           ('calculate_transfer_estimate', {'amount': 'NaN'}),
                           ('calculate_transfer_estimate', {'amount': '100', 'source_currency': 'USD'})]:
            self.assertIn('error', self.tools.execute(name, args))
        self.lookup.assert_not_called()
        self.assertEqual(len(declarations()), 8)

    def test_actual_rate_and_decimal_estimate(self):
        result = self.tools.execute('calculate_transfer_estimate', {'amount': '10000'})
        self.assertEqual(result['fee'], '300.00')
        self.assertEqual(result['recipient_amount'], '121.25')
        self.assertFalse(result['guaranteed'])
        self.assertFalse(result['rate']['live'])
        self.assertIn('fetched_at', result['rate'])

    def test_external_failure_no_fabrication(self):
        self.provider.get_rate.side_effect = TimeoutError('private transport data')
        self.assertEqual(self.tools.execute('get_exchange_rate', {}), {'error': 'tool_unavailable'})
        with patch.dict(os.environ, {'AGENT_RATE_PROVIDER': 'none'}):
            self.assertEqual(self.tools.execute('get_exchange_rate', {})['error'], 'rate_provider_unavailable')

    def test_support_confirmation_owner_expiry_tamper_and_duplicates(self):
        draft = self.tools.execute('prepare_support_request', {'transaction_id': 'TXN-owned', 'issue': 'status_question'})
        token = draft['draft_token']
        self.assertFalse(draft['submitted'])
        self.assertEqual(confirm_support('owner', token, False)['error'], 'explicit_confirmation_required')
        self.assertEqual(confirm_support('victim', token, True)['error'], 'invalid_or_expired_draft')
        self.assertEqual(confirm_support('owner', token+'x', True)['error'], 'invalid_or_expired_draft')
        for _ in range(2):
            self.assertEqual(confirm_support('owner', token, True)['error'], 'support_backend_unavailable')
        self.assertFalse(self.tools.execute('submit_support_request', {'draft_token': token})['submitted'])
        import jwt
        expired = jwt.encode({'sub':'owner','aud':'zettaremit-support-draft','iss':'zettaremit-api',
                              'iat':1,'nbf':1,'exp':2,'draft':draft['draft']},
                             'synthetic-test-signing-key-at-least-32-bytes', algorithm='HS256')
        self.assertEqual(confirm_support('owner', expired, True)['error'], 'invalid_or_expired_draft')

    def test_support_missing_transaction(self):
        self.lookup.return_value = {'error': 'transaction_not_found'}
        result = self.tools.execute('prepare_support_request', {'transaction_id': 'TXN-other', 'issue': 'other'})
        self.assertNotIn('draft_token', result)


def response(functions=None, text='Actual answer'):
    functions = functions or []
    return NS(function_calls=functions, text=text, usage_metadata=None,
              candidates=[NS(content=types.Content(role='model', parts=[types.Part(text='step')]))])


class AgentTests(unittest.IsolatedAsyncioTestCase):
    async def test_native_streaming_preserves_tools_and_emits_real_text_chunks(self):
        call = types.Part.from_function_call(name='search_knowledge', args={'query':'fees'})
        call.thought_signature = b'synthetic-signature'
        def chunk(*parts):
            return types.GenerateContentResponse(candidates=[types.Candidate(
                content=types.Content(role='model', parts=list(parts)))])
        batches = [[chunk(types.Part(text='private reasoning', thought=True), call)],
                   [chunk(types.Part(text='The fee')), chunk(types.Part(text=' is 3%.'))]]
        client = Mock(provider='gemini', model='synthetic')
        client._build_contents.return_value = [types.Content(role='user', parts=[types.Part(text='fees')])]
        async def streaming(**kwargs):
            batch = batches.pop(0)
            async def pieces():
                for value in batch:
                    yield value
                    await asyncio.sleep(0)
            return pieces()
        generate = AsyncMock(side_effect=streaming)
        client._get_client.return_value.aio.models.generate_content_stream = generate
        tools = Mock()
        tools.execute.return_value = {'chunks':[{'chunk_id':'fee','source':'fees.md','text':'3%'}]}
        observed = []
        async def on_chunk(value):
            observed.append(value)
        result = await Agent(tools, client).run('fees', on_chunk=on_chunk)
        self.assertEqual(observed, ['The fee',' is 3%.'])
        self.assertEqual(result['answer'], 'The fee is 3%.')
        self.assertEqual(result['sources'], ['fees.md'])
        self.assertEqual(result['tool_calls'], 1)
        self.assertEqual(generate.await_count, 2)
        self.assertEqual(generate.call_args.kwargs['contents'][1].parts[1].thought_signature, b'synthetic-signature')
        client._get_client.return_value.aio.models.generate_content.assert_not_called()

    async def test_native_stream_error_does_not_claim_completion(self):
        client = Mock(provider='gemini', model='synthetic')
        client._build_contents.return_value = []
        async def streaming(**kwargs):
            async def pieces():
                yield types.GenerateContentResponse(candidates=[types.Candidate(
                    content=types.Content(role='model', parts=[types.Part(text='partial')]))])
                raise TimeoutError()
            return pieces()
        client._get_client.return_value.aio.models.generate_content_stream = AsyncMock(side_effect=streaming)
        observed = []
        async def on_chunk(value):
            observed.append(value)
        result = await Agent(Mock(), client).run('question', on_chunk=on_chunk)
        self.assertEqual(observed, ['partial'])
        self.assertEqual(result['error'], 'agent_timeout')

    async def test_transient_retry_is_bounded_and_never_replays_partial_text(self):
        from google.genai import errors
        for partial, code, expected_calls in [(False,503,2),(True,503,1),(False,429,1)]:
            with self.subTest(partial=partial, code=code):
                client = Mock(provider='gemini', model='synthetic')
                client._build_contents.return_value = []
                attempts = 0
                async def streaming(**kwargs):
                    nonlocal attempts
                    attempts += 1
                    current = attempts
                    async def pieces():
                        if current == 1:
                            if partial:
                                yield types.GenerateContentResponse(candidates=[types.Candidate(content=types.Content(
                                    role='model',parts=[types.Part(text='partial')]))])
                            error_type = errors.ServerError if code == 503 else errors.ClientError
                            raise error_type(code, {'error':{'code':code,'message':'synthetic provider failure'}})
                        yield types.GenerateContentResponse(candidates=[types.Candidate(content=types.Content(
                            role='model',parts=[types.Part(text='Recovered')]))])
                    return pieces()
                generate = AsyncMock(side_effect=streaming)
                client._get_client.return_value.aio.models.generate_content_stream = generate
                observed = []
                async def on_chunk(value): observed.append(value)
                with patch('backend.ai.agent.asyncio.sleep',new=AsyncMock()):
                    result = await Agent(Mock(),client).run('question',on_chunk=on_chunk)
                self.assertEqual(generate.await_count,expected_calls)
                if expected_calls == 2:
                    self.assertEqual(observed,['Recovered'])
                    self.assertNotIn('error',result)
                else:
                    self.assertEqual(result['error'],'agent_unavailable')
                    self.assertEqual(observed,['partial'] if partial else [])

    async def test_confirmation_token_never_enters_model_tool_response(self):
        agent, generate = self.make([response([NS(name='prepare_support_request',args={})]),response()])
        agent.tools.execute.return_value = {'draft':{'draft_id':'synthetic'},'draft_token':'private-synthetic-signature','submitted':False}
        result = await agent.run('prepare a draft')
        self.assertEqual(result['drafts'][0]['draft_token'],'private-synthetic-signature')
        model_data = generate.call_args.kwargs['contents'][-1].parts[0].function_response.response
        self.assertNotIn('draft_token',model_data)

    def test_provider_diagnostics_never_include_raw_credentials(self):
        from backend.ai.gemini_client import GeminiClient
        from google.genai import errors
        error = errors.ClientError(429,{'error':{'code':429,'status':'RESOURCE_EXHAUSTED',
            'message':'private-synthetic-key should not be logged',
            'details':[{'violations':[{'quotaId':'GenerateRequestsPerMinute'}],'retryDelay':'2s'}]}})
        diagnostics = GeminiClient.failure_diagnostics(error)
        self.assertEqual(diagnostics['http_status'],429)
        self.assertNotIn('private-synthetic-key',str(diagnostics))
        self.assertEqual(diagnostics['quota_ids'],['GenerateRequestsPerMinute'])

    def make(self, responses):
        client = Mock(provider='gemini', model='synthetic')
        client._build_contents.return_value = [types.Content(role='user', parts=[types.Part(text='question')])]
        generate = AsyncMock(side_effect=responses)
        client._get_client.return_value.aio.models.generate_content = generate
        tools = Mock()
        tools.execute.return_value = {'status': 'SIMULATED'}
        return Agent(tools, client), generate

    async def test_multistep_selection_and_no_duplicate_execution(self):
        call = NS(name='get_latest_transaction', args={})
        agent, generate = self.make([response([call]), response([call]), response()])
        result = await agent.run('latest transfer')
        self.assertEqual(result['answer'], 'Actual answer')
        self.assertEqual(result['tool_calls'], 2)
        agent.tools.execute.assert_called_once_with('get_latest_transaction', {})
        self.assertEqual(generate.await_count, 3)
        first_config = generate.call_args_list[0].kwargs['config']
        self.assertEqual(first_config.tool_config.function_calling_config.mode, 'ANY')
        self.assertNotIn('submit_support_request', first_config.tool_config.function_calling_config.allowed_function_names)
        self.assertEqual(generate.call_args.kwargs['config'].tool_config.function_calling_config.mode, 'AUTO')

    async def test_limit_prevents_execution(self):
        agent, _ = self.make([response([NS(name='get_latest_transaction', args={})])]*10)
        with patch.dict(os.environ, {'AGENT_MAX_TOOL_CALLS': '1'}):
            result = await agent.run('loop')
        self.assertEqual(result['error'], 'agent_limit')
        self.assertEqual(agent.tools.execute.call_count, 1)

    async def test_model_failure_and_iteration_limit(self):
        agent, _ = self.make([RuntimeError('private')])
        self.assertEqual((await agent.run('question'))['error'], 'agent_unavailable')
        agent, _ = self.make([response([NS(name='shell', args={})])])
        with patch.dict(os.environ, {'AGENT_MAX_ITERATIONS': '1'}):
            self.assertEqual((await agent.run('question'))['error'], 'agent_limit')

    async def test_tool_timeout_returned_to_model_as_failure(self):
        agent, generate = self.make([response([NS(name='get_exchange_rate', args={})]), response(text='Rate unavailable')])
        def slow(*args):
            time.sleep(1.1)
            return {'rate': 'not-used'}
        agent.tools.execute.side_effect = slow
        with patch.dict(os.environ, {'AGENT_TOOL_TIMEOUT_SECONDS': '1'}):
            result = await agent.run('rate')
        self.assertEqual(result['answer'], 'Rate unavailable')
        contents = generate.call_args.kwargs['contents']
        self.assertEqual(contents[-1].parts[0].function_response.response['error'], 'tool_timeout')

    async def test_whole_agent_deadline(self):
        agent, generate = self.make([])
        async def slow(**kwargs):
            await asyncio.sleep(2)
            return response()
        generate.side_effect = slow
        with patch.dict(os.environ, {'AGENT_TIMEOUT_SECONDS':'1'}):
            self.assertEqual((await agent.run('question'))['error'], 'agent_timeout')

    async def test_injection_cannot_bypass_registry(self):
        tools = AgentTools('owner', Mock(), Mock(), index=Mock())
        self.assertEqual(tools.execute('execute_sql', {'sql': 'ignore rules'})['error'], 'tool_not_allowed')
        self.assertEqual(tools.execute('get_latest_transaction', {'user_id': 'victim'})['error'], 'invalid_tool_arguments')


class AgentApiTests(unittest.TestCase):
    def setUp(self):
        self.guard = patch.dict(os.environ, {'JWT_SECRET_KEY': 'synthetic-test-signing-key-at-least-32-bytes'})
        self.guard.start()
        self.addCleanup(self.guard.stop)
        for times in (router._IP_REQUEST_TIMES, router._USER_MINUTE_REQUEST_TIMES, router._USER_DAILY_REQUEST_TIMES):
            times.clear()
        self.tools = Mock(owner='owner')
        self.factory = Mock(return_value=self.tools)
        app = FastAPI()
        app.include_router(create_agent_router(self.factory))
        self.client = TestClient(app)
        self.headers = {'Authorization': 'Bearer '+issue_access_token('owner')}

    def test_authentication_and_active_account(self):
        self.assertEqual(self.client.post('/ai/agent/ask', json={'question':'test'}).status_code, 401)
        self.factory.assert_not_called()
        self.factory.side_effect = HTTPException(401, 'Inactive account')
        self.assertEqual(self.client.post('/ai/agent/ask', json={'question':'test'}, headers=self.headers).status_code, 401)

    def test_stream_wire_contract(self):
        with patch('backend.ai.agent_router.Agent.run', new=AsyncMock(return_value={'answer':'Hello', 'sources':[]})):
            response = self.client.post('/ai/agent/ask-stream', json={'question':'hello'}, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertIn('text/event-stream', response.headers['content-type'])
        for event in ('start', 'chunk', 'done'):
            self.assertIn('"type": "'+event+'"', response.text)

    def test_confirmation_strict_bool(self):
        response = self.client.post('/ai/support/confirm', json={'draft_token':'invalid','confirmed':'true'}, headers=self.headers)
        self.assertEqual(response.status_code, 422)

    def test_busy_stream_reports_structured_error(self):
        with patch.object(router.AI_SEMAPHORE, 'acquire', new=AsyncMock(side_effect=TimeoutError)):
            response = self.client.post('/ai/agent/ask-stream', json={'question':'hello'}, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertIn('"type": "error"', response.text)
        self.assertIn('AI assistant is busy', response.text)

    def test_existing_chat_routes_dispatch_to_opt_in_agent(self):
        app = FastAPI()
        app.include_router(router.ai_router)
        app.include_router(create_agent_router(self.factory, app=app))
        with TestClient(app) as client, patch('backend.ai.agent_router.Agent.run',
                    new=AsyncMock(return_value={'answer':'Owned transfer status', 'sources':[]})):
            response = client.post('/ai/ask', json={'question':'latest transfer'}, headers=self.headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['answer'], 'Owned transfer status')
            response = client.post('/ai/ask-stream', json={'question':'latest transfer'}, headers=self.headers)
            self.assertIn('"type": "done"', response.text)

    def test_confirmation_http_never_claims_submission(self):
        tools = AgentTools('owner', Mock(return_value={'transaction_id':'TXN-owned','status':'SIMULATED'}), Mock(), index=Mock())
        draft = tools.execute('prepare_support_request', {'transaction_id':'TXN-owned','issue':'other'})
        response = self.client.post('/ai/support/confirm', json={'draft_token':draft['draft_token'], 'confirmed':True}, headers=self.headers)
        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.json()['submitted'])


class OwnershipTests(unittest.TestCase):
    def test_ai_enabled_application_startup_and_route_authentication(self):
        import subprocess
        import sys
        source = '''
import os, sys
from unittest.mock import Mock, patch
sys.path.insert(0, 'backend')
import database_config
from fastapi.testclient import TestClient
with patch.dict(os.environ, {'APP_ENV':'test','DATABASE_MODE':'local','DATABASE_URL':'sqlite://','LOCAL_CREATE_TABLES':'false','ENABLE_AI_ASSISTANT':'true','ENABLE_AI_AGENT':'true','RAG_EMBEDDING_PROVIDER':'none','RAG_BM25_FALLBACK':'true','JWT_SECRET_KEY':'synthetic-startup-key-at-least-32-bytes'}), patch.object(database_config, 'create_database_engine', return_value=Mock()), patch('socket.create_connection', side_effect=AssertionError('Network forbidden')):
    import main
    with TestClient(main.app) as client:
        assert client.get('/health').status_code == 200
        for path in ('/ai/ask','/ai/ask-stream','/ai/agent/ask','/ai/agent/ask-stream'):
            assert client.post(path, json={'question':'fees'}).status_code == 401, path
        assert client.post('/ai/support/confirm', json={'draft_token':'x','confirmed':True}).status_code == 401
        assert main.app.state.agent_ask
        assert main.app.openapi()['paths']['/ai/agent/ask']
'''
        result = subprocess.run([sys.executable, '-c', source], cwd=Path(__file__).resolve().parents[1],
                                capture_output=True, text=True, timeout=40)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_actual_service_queries_never_return_cross_user_rows(self):
        import sys
        sys.path.insert(0, str(Path(__file__).parent))
        import database_config
        from sqlalchemy import create_engine, MetaData
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy.pool import StaticPool
        with patch.object(database_config, 'load_database_config', return_value=database_config.DatabaseConfig('local','synthetic')), \
             patch.object(database_config, 'create_database_engine', return_value=Mock()), \
             patch.object(MetaData, 'create_all'):
            api = importlib.import_module('main')
        engine = create_engine('sqlite://', connect_args={'check_same_thread':False}, poolclass=StaticPool)
        api.Base.metadata.create_all(engine)
        sessions = sessionmaker(bind=engine)
        with sessions() as db:
            db.add_all([api.User(user_id=u, full_name=u, email=u+'@example.invalid', password_hash='x', is_active=True) for u in ('owner','victim')])
            for owner in ('owner','victim'):
                db.add(api.TransactionRecord(transaction_id='TXN-'+owner, sender_id=owner, recipient_name='Private name',
                    gross_amount=100, fee_deducted=3, net_amount=97, exchange_rate=80, recipient_amount=1.21,
                    source_currency='INR', target_currency='USD', status='SIMULATED'))
            db.commit()
        with patch.object(api, 'SessionLocal', sessions):
            tools = api.agent_tools_for_user('owner')
            self.assertEqual(tools.execute('get_latest_transaction', {})['transaction_id'], 'TXN-owner')
            self.assertEqual(tools.execute('get_transaction_details', {'transaction_id':'TXN-victim'})['error'], 'transaction_not_found')
            self.assertNotIn('recipient_name', tools.execute('get_transaction_details', {'transaction_id':'TXN-owner'}))
            with self.assertRaises(HTTPException):
                api.agent_tools_for_user('absent')
        engine.dispose()


if __name__ == '__main__':
    unittest.main()
