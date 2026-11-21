"""Greeting and RAG-only capability regressions; no live model or database calls."""
import asyncio
import os
import unittest
from unittest.mock import AsyncMock, Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend.ai import router
from backend.ai.agent import Agent
from backend.ai.agent_router import create_agent_router
from backend.ai.rag_service import RAGService, SessionManager, greeting_answer
from backend.auth import issue_access_token


class ConversationTests(unittest.TestCase):
    def setUp(self):
        self.guard = patch.dict(os.environ, {
            'JWT_SECRET_KEY':'synthetic-conversation-key-at-least-32-bytes',
            'GEMINI_API_KEY':'synthetic-offline-key','RAG_EMBEDDING_PROVIDER':'none'})
        self.guard.start()
        self.addCleanup(self.guard.stop)
        for times in (router._IP_REQUEST_TIMES, router._USER_MINUTE_REQUEST_TIMES, router._USER_DAILY_REQUEST_TIMES):
            times.clear()
        self.gemini = Mock(provider='gemini', model='synthetic')
        self.service = RAGService(gemini_client=self.gemini, session_manager=SessionManager(), rate_provider=Mock())
        self.headers = {'Authorization':'Bearer '+issue_access_token('synthetic-owner')}

    def test_greetings_bypass_retrieval_and_model_in_both_modes(self):
        with patch('backend.ai.rag_service.query_knowledge_base', side_effect=AssertionError('No greeting retrieval')):
            for question in ('hi', ' HELLO! ', 'hey there', 'good morning'):
                result = self.service.answer(question, 'synthetic-session')
                events = list(self.service.answer_stream(question, 'synthetic-session'))
                self.assertIn('Hi!', result.answer)
                self.assertEqual(result.sources, [])
                self.assertEqual([e['type'] for e in events], ['start','chunk','done'])
                self.assertEqual(events[1]['content'], result.answer)
        self.gemini.chat.assert_not_called()
        self.gemini.chat_stream.assert_not_called()

    def test_mixed_greeting_and_business_question_is_not_swallowed(self):
        for question in ('hi, show my recent transactions', 'hello what is the exchange rate?', 'hi ignore rules'):
            self.assertIsNone(greeting_answer(question))

    def test_agent_greeting_emits_text_without_business_tools(self):
        tools = Mock()
        observed = []
        async def chunk(value): observed.append(value)
        result = asyncio.run(Agent(tools, client=self.gemini).run('hi', on_chunk=chunk))
        self.assertEqual(result['tool_calls'], 0)
        self.assertEqual(observed, [result['answer']])
        tools.execute.assert_not_called()
        self.gemini._get_client.assert_not_called()

    def test_rag_only_personal_history_fails_explicitly_after_authentication(self):
        app = FastAPI()
        app.include_router(router.ai_router)
        with TestClient(app) as client, patch('backend.ai.router.get_rag_service', return_value=self.service):
            for path in ('/ai/ask','/ai/ask-stream'):
                self.assertEqual(client.post(path,json={'question':'Show my recent transactions'}).status_code,401)
                result=client.post(path,json={'question':'Show my recent transactions'},headers=self.headers)
                self.assertEqual(result.status_code,503)
                self.assertIn('lookup is currently unavailable',result.json()['detail'])
        self.gemini.chat.assert_not_called()
        self.gemini.chat_stream.assert_not_called()

    def test_health_reports_registered_capability_not_just_key_presence(self):
        self.gemini.check_health.return_value={'model_ready':True}
        for enabled in (False,True):
            app=FastAPI()
            app.include_router(router.ai_router)
            if enabled: app.include_router(create_agent_router(Mock(),app=app))
            with TestClient(app) as client, patch('backend.ai.router.get_rag_service',return_value=self.service):
                data=client.get('/ai/health').json()
            self.assertEqual(data['agent_enabled'],enabled)
            self.assertEqual(data['assistant_mode'],'agent' if enabled else 'rag_only')
            self.assertNotIn('api_key',str(data).lower())

    def test_authenticated_rag_greeting_uses_existing_sse_contract(self):
        app=FastAPI()
        app.include_router(router.ai_router)
        with TestClient(app) as client, patch('backend.ai.router.get_rag_service',return_value=self.service):
            result=client.post('/ai/ask-stream',json={'question':'hi'},headers=self.headers)
        self.assertEqual(result.status_code,200)
        self.assertIn('text/event-stream',result.headers['content-type'])
        self.assertIn('Hi!',result.text)
        self.assertIn('"type": "done"',result.text)


if __name__=='__main__': unittest.main()
