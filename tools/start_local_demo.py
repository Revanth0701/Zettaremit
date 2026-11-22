"""Start the documented local services hidden, preserving their PIDs and logs.

No schema changes or account creation. Only zettaremit_ai_dev is permitted.
Processes intentionally remain running for a manual local demonstration.
"""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / '.local-backups/browser-verification'
sys.path.insert(0, str(ROOT / 'backend'))


def main():
    from settings import setting
    from database_config import load_database_config, create_database_engine
    from sqlalchemy.engine import make_url
    from sqlalchemy import text
    import httpx
    from dotenv import dotenv_values

    cfg = load_database_config()
    url = make_url(cfg.url)
    if not (cfg.mode == 'local' and url.host == '127.0.0.1' and (url.port or 3306) == 3306
            and url.database == 'zettaremit_ai_dev' and setting('APP_ENV') == 'development'
            and setting('LOCAL_CREATE_TABLES') == 'false'):
        raise SystemExit('Refusing to start: isolated development configuration required.')
    for key, expected in [('ENABLE_AI_ASSISTANT','true'), ('ENABLE_AI_AGENT','true'),
                          ('RAG_EMBEDDING_PROVIDER','gemini')]:
        if setting(key) != expected:
            raise SystemExit('Local AI configuration is incomplete: '+key)
    public = dotenv_values(ROOT/'frontend/.env.local', interpolate=False)
    if public.get('EXPO_PUBLIC_API_URL') != 'http://127.0.0.1:8000':
        raise SystemExit('Refusing to start: frontend local API target must be explicit.')
    if os.environ.get('EXPO_PUBLIC_API_URL', public['EXPO_PUBLIC_API_URL']) != public['EXPO_PUBLIC_API_URL']:
        raise SystemExit('Conflicting frontend process environment.')
    for port in (8000,8081):
        with socket.socket() as sock:
            if sock.connect_ex(('127.0.0.1',port)) == 0:
                raise SystemExit('Port already occupied; inspect the existing process before starting: '+str(port))
    engine = create_database_engine(cfg)
    with engine.connect() as connection:
        if connection.execute(text('SELECT DATABASE()')).scalar_one() != 'zettaremit_ai_dev':
            raise SystemExit('Unexpected database selection.')
    engine.dispose()
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    if subprocess.run(['git','check-ignore','--quiet','--',str(ARTIFACTS/'sample.png')],cwd=ROOT).returncode:
        raise SystemExit('Test artifacts must be Git ignored.')
    common = dict(os.environ)
    frontend_env = {k:v for k,v in os.environ.items() if k in ('PATH','SYSTEMROOT','WINDIR','COMSPEC','TEMP','TMP',
                    'USERPROFILE','APPDATA','LOCALAPPDATA','HOME','NODE_OPTIONS')}
    frontend_env.update(CI='1', BROWSER='none', EXPO_PUBLIC_API_URL='http://127.0.0.1:8000')
    commands = {
        'backend': ([sys.executable,'-B','-m','uvicorn','main:app','--host','127.0.0.1','--port','8000','--no-access-log'], ROOT/'backend', common, 8000, '/health'),
        'frontend': (['node',str(ROOT/'frontend/node_modules/expo/bin/cli'),'start','--web','--localhost','--port','8081','--clear'], ROOT/'frontend', frontend_env, 8081, '/'),
    }
    processes = {}
    with httpx.Client(timeout=3, trust_env=False) as client:
        for name,(command,directory,environment,port,path) in commands.items():
            with (ARTIFACTS/(name+'.log')).open('ab') as log:
                child = subprocess.Popen(command,cwd=directory,env=environment,stdin=subprocess.DEVNULL,
                    stdout=log,stderr=subprocess.STDOUT,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            processes[name] = {'pid':child.pid,'port':port}
            (ARTIFACTS/'services.json').write_text(json.dumps(processes,indent=2),encoding='utf-8')
            ready = False
            deadline = time.monotonic()+100
            while child.poll() is None and time.monotonic() < deadline:
                try:
                    if client.get(f'http://127.0.0.1:{port}'+path).status_code == 200:
                        ready = True
                        break
                except httpx.HTTPError:
                    pass
                time.sleep(.5)
            print(json.dumps({'service':name,'ready':ready,'port':port}),flush=True)
            if not ready:
                raise SystemExit('Local service startup failed; inspect its private log. No automatic retry.')
    print('Local demo running at http://127.0.0.1:8081',flush=True)


if __name__ == '__main__':
    main()
