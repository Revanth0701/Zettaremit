"""Transaction-list/count regressions against real in-memory SQLAlchemy queries.

No MySQL access, live Gemini calls, personal data or persistent fixture writes.
"""
import asyncio
import datetime
import importlib
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from google.genai import types
import database_config
from auth import issue_access_token


class AgentHistoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.guards = [
            patch.dict(os.environ, {'APP_ENV':'test','DATABASE_MODE':'local','LOCAL_CREATE_TABLES':'false',
                'ENABLE_AI_ASSISTANT':'false','ENABLE_AI_AGENT':'false','RAG_EMBEDDING_PROVIDER':'none',
                'GEMINI_API_KEY':'synthetic-offline-key','JWT_SECRET_KEY':'synthetic-history-test-key-at-least-32-bytes'}),
            patch.object(database_config,'load_database_config',return_value=database_config.DatabaseConfig('local','synthetic')),
            patch.object(database_config,'create_database_engine',return_value=Mock()),
            patch('pymysql.connections.Connection.connect',side_effect=AssertionError('MySQL forbidden')),
        ]
        for guard in cls.guards:
            guard.start()
        cls.api = importlib.import_module('main')

    @classmethod
    def tearDownClass(cls):
        for guard in reversed(cls.guards):
            guard.stop()

    def setUp(self):
        self.engine = create_engine('sqlite://', poolclass=StaticPool, connect_args={'check_same_thread':False})
        self.api.Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine)
        self.session_patch = patch.object(self.api, 'SessionLocal', self.sessions)
        self.session_patch.start()
        with self.sessions() as db:
            db.add_all([self.api.User(user_id=owner,full_name='Synthetic Private Name',email=owner+'@example.invalid',
                                     password_hash='unused',is_active=True) for owner in ('A','B','empty')])
            # Deliberately tie timestamps and insert out of order. Another user's
            # newer records must never enter the owner's page or count.
            for owner, number, day in [('A',2,2),('B',1,3),('A',1,1),('A',3,2),('B',2,3)]:
                db.add(self.record(owner, number, day))
            db.commit()
        def dependency():
            with self.sessions() as db:
                yield db
        self.api.app.dependency_overrides[self.api.get_db] = dependency
        self.client = TestClient(self.api.app)

    def tearDown(self):
        self.client.close()
        self.api.app.dependency_overrides.clear()
        self.session_patch.stop()
        self.engine.dispose()

    def record(self, owner, number, day):
        return self.api.TransactionRecord(transaction_id=f'TXN-{owner}-{number:03}',sender_id=owner,
            recipient_name='Private Synthetic Recipient',gross_amount=100,fee_deducted=3,net_amount=97,
            exchange_rate=80,recipient_amount=1.21,source_currency='INR',target_currency='USD',
            status='SIMULATED',created_at=datetime.datetime(2026,1,day))

    def tools(self, owner='A'):
        return self.api.agent_tools_for_user(owner)

    def page(self, **arguments):
        return self.tools().execute('list_transactions', arguments)

    def test_multiple_transactions_have_owner_scoped_total_and_minimal_fields(self):
        result = self.page()
        self.assertEqual((result['total_count'],result['returned_count']),(3,3))
        self.assertEqual([r['transaction_id'] for r in result['transactions']],['TXN-A-003','TXN-A-002','TXN-A-001'])
        self.assertFalse(result['has_more'])
        self.assertIsNone(result['next_offset'])
        self.assertEqual(result['limit'],10)
        for record in result['transactions']:
            self.assertNotIn('sender_id',record)
            self.assertNotIn('recipient_name',record)

    def test_one_record_pages_keep_total_and_stable_order_without_duplicates(self):
        pages = [self.page(limit=1,offset=i) for i in range(3)]
        self.assertTrue(all(p['total_count']==3 and p['returned_count']==1 for p in pages))
        ids = [p['transactions'][0]['transaction_id'] for p in pages]
        self.assertEqual(ids,['TXN-A-003','TXN-A-002','TXN-A-001'])
        self.assertEqual(len(set(ids)),3)
        self.assertEqual([p['next_offset'] for p in pages],[1,2,None])
        self.assertEqual([p['has_more'] for p in pages],[True,True,False])

    def test_partial_last_page_and_out_of_range_offset_do_not_change_total(self):
        last = self.page(limit=2,offset=2)
        self.assertEqual((last['total_count'],last['returned_count']),(3,1))
        self.assertFalse(last['has_more'])
        beyond = self.page(limit=2,offset=10)
        self.assertEqual((beyond['total_count'],beyond['returned_count']),(3,0))
        self.assertEqual(beyond['transactions'],[])
        self.assertFalse(beyond['has_more'])
        self.assertIsNone(beyond['next_offset'])

    def test_empty_account_returns_zero_instead_of_missing_or_fabricated_records(self):
        result = self.tools('empty').execute('list_transactions', {})
        self.assertEqual((result['total_count'],result['returned_count']),(0,0))
        self.assertEqual(result['transactions'],[])
        self.assertFalse(result['has_more'])

    def test_history_pagination_and_identity_arguments_are_validated(self):
        for arguments in [{'user_id':'B'},{'sender_id':'B'},{'limit':0},{'limit':51},{'limit':'1'},
                          {'limit':True},{'offset':-1},{'offset':1.5},{'offset':100001}]:
            with self.subTest(arguments=arguments):
                result = self.tools().execute('list_transactions', arguments)
                self.assertEqual(result,{'error':'invalid_tool_arguments'})

    def test_list_latest_and_details_enforce_same_owner(self):
        tools = self.tools('B')
        result = tools.execute('list_transactions',{'limit':1})
        self.assertEqual((result['total_count'],result['returned_count']),(2,1))
        self.assertEqual(result['transactions'][0]['transaction_id'],'TXN-B-002')
        self.assertEqual(tools.execute('get_latest_transaction',{})['transaction_id'],'TXN-B-002')
        self.assertEqual(tools.execute('get_transaction_details',{'transaction_id':'TXN-A-003'})['error'],'transaction_not_found')

    def test_deactivated_user_cannot_use_previously_prepared_history_callback(self):
        tools = self.tools()
        with self.sessions() as db:
            db.query(self.api.User).filter(self.api.User.user_id=='A').first().is_active = False
            db.commit()
        self.assertEqual(tools.execute('list_transactions',{}),{'error':'tool_unavailable'})

    def test_dashboard_history_contract_and_order_match_agent_page(self):
        headers = {'Authorization':'Bearer '+issue_access_token('A')}
        result = self.client.get('/transactions/', headers=headers)
        self.assertEqual(result.status_code,200)
        self.assertIsInstance(result.json(),list)
        self.assertEqual([r['transaction_id'] for r in result.json()],
                         [r['transaction_id'] for r in self.page()['transactions']])
        limited = self.client.get('/transactions/?limit=1', headers=headers)
        self.assertEqual(len(limited.json()),1)
        self.assertEqual(self.page(limit=1)['total_count'],3)
        self.assertEqual(self.client.get('/transactions/?sender_id=B',headers=headers).status_code,403)
        self.assertEqual(self.client.get('/transactions/').status_code,401)

    def test_total_exceeds_default_api_and_agent_page_limits(self):
        with self.sessions() as db:
            db.add_all([self.record('A',i,2) for i in range(4,56)])
            db.commit()
        headers = {'Authorization':'Bearer '+issue_access_token('A')}
        self.assertEqual(len(self.client.get('/transactions/',headers=headers).json()),50)
        page = self.page()
        self.assertEqual((page['total_count'],page['returned_count']),(55,10))
        end = self.page(limit=10,offset=50)
        self.assertEqual((end['total_count'],end['returned_count']),(55,5))
        self.assertFalse(end['has_more'])

    def test_unconfigured_history_does_not_substitute_latest_as_a_total(self):
        from ai.agent import AgentTools
        tools = AgentTools('A',Mock(),Mock(return_value={'transaction_id':'one'}),index=Mock())
        self.assertEqual(tools.execute('list_transactions',{}),{'error':'transaction_history_unavailable'})

    def test_agent_receives_total_separately_from_limited_page(self):
        from ai.agent import Agent
        from ai.gemini_client import GeminiClient
        client = Mock(provider='gemini',model='synthetic')
        client._build_contents.side_effect = GeminiClient(api_key='synthetic')._build_contents
        def response(part):
            return types.GenerateContentResponse(candidates=[types.Candidate(
                content=types.Content(role='model',parts=[part]))])
        generate = AsyncMock(side_effect=[
            response(types.Part.from_function_call(name='list_transactions',args={'limit':1,'offset':0})),
            response(types.Part(text='Synthetic model completion'))])
        client._get_client.return_value.aio.models.generate_content = generate
        result = asyncio.run(Agent(self.tools(),client).run('Recent transactions and total?',history=[
            {'role':'assistant','content':'Previously only the latest transaction was returned.'}]))
        self.assertNotIn('error',result)
        payload = generate.call_args.kwargs['contents'][-1].parts[0].function_response.response
        self.assertEqual((payload['total_count'],payload['returned_count']),(3,1))
        self.assertTrue(payload['has_more'])
        self.assertEqual(len(payload['transactions']),1)

    def test_authenticated_chat_json_and_sse_dispatch_owned_history(self):
        from fastapi import FastAPI
        from ai.router import ai_router, _IP_REQUEST_TIMES, _USER_MINUTE_REQUEST_TIMES, _USER_DAILY_REQUEST_TIMES
        from ai.agent_router import create_agent_router
        from ai.gemini_client import GeminiClient
        for times in (_IP_REQUEST_TIMES,_USER_MINUTE_REQUEST_TIMES,_USER_DAILY_REQUEST_TIMES): times.clear()
        app=FastAPI()
        app.include_router(ai_router)
        app.include_router(create_agent_router(self.api.agent_tools_for_user,app=app))
        def response(part):
            return types.GenerateContentResponse(candidates=[types.Candidate(content=types.Content(role='model',parts=[part]))])
        for path in ('/ai/ask','/ai/ask-stream'):
            sdk=Mock(provider='gemini',model='synthetic')
            sdk._build_contents.side_effect=GeminiClient(api_key='synthetic')._build_contents
            generate=AsyncMock(side_effect=[
                response(types.Part.from_function_call(name='list_transactions',args={'limit':2,'offset':0})),
                response(types.Part(text='You have 3 simulated transfers; showing 2.'))])
            with TestClient(app) as client, patch('ai.agent.GeminiClient',return_value=sdk), \
                    patch('ai.agent.Agent._generate',new=generate):
                result=client.post(path,json={'question':'Show my recent transactions'},
                                   headers={'Authorization':'Bearer '+issue_access_token('A')})
                self.assertEqual(client.post(path,json={'question':'Show my recent transactions'}).status_code,401)
            self.assertEqual(result.status_code,200)
            payload=generate.call_args.args[0][-1].parts[0].function_response.response
            self.assertEqual((payload['total_count'],payload['returned_count']),(3,2))
            self.assertTrue(all(row['transaction_id'].startswith('TXN-A-') for row in payload['transactions']))
            if path.endswith('stream'):
                self.assertIn('You have 3 simulated transfers; showing 2.',result.text)
                self.assertIn('"type": "done"',result.text)
            else:self.assertEqual(result.json()['answer'],'You have 3 simulated transfers; showing 2.')
            self.assertEqual(generate.call_count,2)


if __name__ == '__main__':
    unittest.main()
