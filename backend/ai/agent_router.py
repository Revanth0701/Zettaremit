"""Opt-in agent API and SSE adapter using existing client event names."""
import asyncio
import json
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, StrictBool

from .agent import Agent, confirm_support
from .router import (AskRequest, bearer_scheme, scrub_sensitive_input,
                     check_ip_rate_limit, check_user_rate_limit, AI_SEMAPHORE)
from auth import token_subject, unauthorized


class Confirmation(BaseModel):
    model_config = ConfigDict(extra='forbid')
    draft_token: str = Field(min_length=1, max_length=8192)
    confirmed: StrictBool


def create_agent_router(tools_factory, app=None):
    router = APIRouter(prefix='/ai', tags=['AI Agent'])

    async def authenticated(request: Request, credentials=Depends(bearer_scheme)):
        if credentials is None or credentials.scheme.lower() != 'bearer':
            raise unauthorized()
        owner = token_subject(credentials.credentials)
        # Check the active account in persistence before any external/model call.
        tools = await asyncio.to_thread(tools_factory, owner)
        if not check_ip_rate_limit(request.client.host if request.client else 'unknown'):
            raise HTTPException(429, 'AI rate limit exceeded')
        allowed, message = check_user_rate_limit(owner)
        if not allowed:
            raise HTTPException(429, message)
        return tools

    async def run(payload, tools, on_chunk=None):
        try:
            await asyncio.wait_for(AI_SEMAPHORE.acquire(), timeout=3)
        except TimeoutError:
            raise HTTPException(429, 'AI assistant is busy') from None
        try:
            from .rag_service import get_rag_service
            sessions = get_rag_service().sessions
            scoped = f'{tools.owner}::{payload.session_id or "default"}'
            question = scrub_sensitive_input(payload.question)
            started = time.monotonic()
            result = await Agent(tools).run(question, history=sessions.get_history(scoped), on_chunk=on_chunk)
            if not result.get('error'):
                sessions.add_turn(scoped, question, result['answer'])
            return dict(result, question=question, session_id=payload.session_id,
                        latency_seconds=round(time.monotonic()-started, 3))
        finally:
            AI_SEMAPHORE.release()

    @router.post('/agent/ask')
    async def ask(payload: AskRequest, tools=Depends(authenticated)):
        return await run(payload, tools)

    @router.post('/agent/ask-stream')
    async def stream(payload: AskRequest, tools=Depends(authenticated)):
        async def events():
            queue = asyncio.Queue(maxsize=100)
            async def on_chunk(content):
                await queue.put({'type': 'chunk', 'content': content})
            task = asyncio.create_task(run(payload, tools, on_chunk=on_chunk))
            next_chunk = asyncio.create_task(queue.get())
            emitted = False
            try:
                yield 'data: ' + json.dumps({'type': 'start', 'sources': []}) + '\n\n'
                while not task.done():
                    done, _ = await asyncio.wait([task, next_chunk], timeout=5, return_when=asyncio.FIRST_COMPLETED)
                    if not done:
                        yield ': keepalive\n\n'
                    if next_chunk in done:
                        emitted = True
                        yield 'data: ' + json.dumps(next_chunk.result()) + '\n\n'
                        next_chunk = asyncio.create_task(queue.get())
                if next_chunk.done():
                    emitted = True
                    yield 'data: ' + json.dumps(next_chunk.result()) + '\n\n'
                while not queue.empty():
                    emitted = True
                    yield 'data: ' + json.dumps(queue.get_nowait()) + '\n\n'
                result = await task
                if result.get('error'):
                    yield 'data: ' + json.dumps({'type': 'error', 'error': result['answer']}) + '\n\n'
                elif not emitted:
                    yield 'data: ' + json.dumps({'type': 'chunk', 'content': result['answer']}) + '\n\n'
                yield 'data: ' + json.dumps(dict(result, type='done')) + '\n\n'
            except HTTPException as error:
                yield 'data: ' + json.dumps({'type': 'error', 'error': str(error.detail)}) + '\n\n'
            except Exception:
                yield 'data: ' + json.dumps({'type': 'error', 'error': 'AI assistant is temporarily unavailable.'}) + '\n\n'
            finally:
                if not next_chunk.done():
                    next_chunk.cancel()
                if not task.done():
                    task.cancel()
                await asyncio.gather(task, next_chunk, return_exceptions=True)
        return StreamingResponse(events(), media_type='text/event-stream',
                                 headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})

    @router.post('/support/confirm')
    async def confirm(payload: Confirmation, tools=Depends(authenticated)):
        result = confirm_support(tools.owner, payload.draft_token, payload.confirmed)
        code = 503 if result.get('error') == 'support_backend_unavailable' else 422
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=code, content=result)

    if app is not None:
        # Existing frontend endpoints opt into the same agent without changing SSE framing.
        async def legacy_ask(payload, request, credentials):
            return await ask(payload, await authenticated(request, credentials))

        async def legacy_stream(payload, request, credentials):
            return await stream(payload, await authenticated(request, credentials))

        app.state.agent_ask = legacy_ask
        app.state.agent_stream = legacy_stream
    return router
