"""Explicit local-only synthetic E2E. Starts Java on loopback, never cloud database."""
import importlib
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import time
import threading
from unittest.mock import Mock, patch
from urllib.request import build_opener, ProxyHandler


def main():
    sys.dont_write_bytecode=True
    root=Path(__file__).resolve().parent.parent
    jars=[p for p in (root/'services/transaction-service/build/libs').glob('*-SNAPSHOT.jar') if not p.name.endswith('-plain.jar')]
    if not jars:raise RuntimeError('Build Java first')
    with socket.socket() as probe:
        probe.bind(('127.0.0.1',0));port=probe.getsockname()[1]
    service_secret=secrets.token_hex(32)
    env={key:value for key,value in os.environ.items() if key in ('PATH','JAVA_HOME','SYSTEMROOT','WINDIR','COMSPEC','TEMP','TMP')}
    env.update(INTERNAL_SERVICE_TOKEN=service_secret,PORT=str(port),BIND_ADDRESS='127.0.0.1')
    java=shutil.which('java')
    if not java:raise RuntimeError('Java 21 is required')
    child=subprocess.Popen([java,'-Xmx192m','-jar',str(jars[0])],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    logs=[]
    def drain():
        for line in child.stdout:logs.append(line.decode('utf-8',errors='ignore'))
    threading.Thread(target=drain,daemon=True).start()
    engine=None
    api=None
    try:
        deadline=time.monotonic()+60
        while time.monotonic()<deadline:
            if child.poll() is not None:
                output=''.join(logs)
                categories={'UnsupportedClassVersionError':'JVM version mismatch','PortInUseException':'Loopback port unavailable','BeanCreationException':'Java application context failed','ClassNotFoundException':'Java classpath failure','OutOfMemoryError':'Java memory limit','Unable to access jarfile':'Java artifact unavailable','Unrecognized VM option':'Java VM option mismatch'}
                category=next((label for marker,label in categories.items() if marker in output),'Java startup failed')
                import re
                print('Java exit code: '+str(child.returncode))
                classes=re.findall(r'(?:Caused by: )?([A-Za-z][A-Za-z0-9_.]*(?:Exception|Error))',output)
                print('Java diagnostic exception classes: '+(', '.join(dict.fromkeys(classes)) if classes else 'none'))
                print('Sanitized Java startup category: '+category)
                raise RuntimeError('Java startup failed')
            try:
                with build_opener(ProxyHandler({})).open('http://127.0.0.1:'+str(port)+'/health',timeout=1) as response:
                    if response.status==200:break
            except OSError:time.sleep(.25)
        else:
            output=''.join(logs)
            print('Java diagnostics: listening marker='+str('Tomcat started on port' in output)+', application-started marker='+str('Started TransactionServiceApplication' in output))
            raise RuntimeError('Java startup timeout')
        sys.path.insert(0,str(root/'backend'))
        import database_config
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy.pool import StaticPool
        from fastapi.testclient import TestClient
        engine=create_engine('sqlite://',poolclass=StaticPool,connect_args={'check_same_thread':False})
        # No developer credentials or environment-file values are used by the test.
        settings={'APP_ENV':'test','JWT_SECRET_KEY':secrets.token_hex(32),'DATABASE_MODE':'local','LOCAL_CREATE_TABLES':'false','INTERNAL_SERVICE_TOKEN':service_secret,'INTERNAL_SERVICE_URL':'http://127.0.0.1:'+str(port)}
        with patch.dict(os.environ,settings),patch.object(database_config,'load_database_config',return_value=database_config.DatabaseConfig('local','synthetic')),patch.object(database_config,'create_database_engine',return_value=engine),patch('pymysql.connections.Connection.connect',side_effect=AssertionError('MySQL forbidden')):
            api=importlib.import_module('main')
            api.Base.metadata.create_all(engine)
            factory=sessionmaker(bind=engine,autoflush=False)
            with factory() as db:
                db.add(api.User(user_id='SYNTHETIC-E2E',full_name='Synthetic',email='synthetic@example.com',password_hash='not-used',is_active=True));db.commit()
            def session():
                with factory() as db:yield db
            api.app.dependency_overrides[api.get_db]=session
            from datetime import datetime, timedelta, timezone
            from decimal import Decimal
            from exchange_rates import RateSnapshot
            now=datetime.now(timezone.utc).replace(microsecond=0)
            provider=Mock()
            provider.get_rate.return_value=RateSnapshot(Decimal('83.50000000'),now,now+timedelta(hours=24),now,now+timedelta(hours=24))
            api.app.dependency_overrides[api.get_exchange_rate_provider]=lambda:provider
            headers={'Authorization':'Bearer '+api.issue_access_token('SYNTHETIC-E2E'),'Idempotency-Key':'synthetic-e2e-request-0001'}
            with TestClient(api.app) as client:
                payload={'recipient_name':'Synthetic','gross_amount':'1000.00'}
                quote=client.post('/simulation/quote',json=payload,headers=headers)
                assert quote.status_code==200
                payload['quote_token']=quote.json()['quote_token']
                first=client.post('/transactions/create',json=payload,headers=headers)
                assert first.status_code==201
                body=first.json()['transaction']
                assert body['recipient_amount']=='11.62' and body['status']=='SIMULATED'
                repeat=client.post('/transactions/create',json=payload,headers=headers)
                assert repeat.status_code==201 and repeat.json()['transaction']['transaction_id']==body['transaction_id']
                history=client.get('/transactions/',headers=headers)
                assert history.status_code==200 and len(history.json())==1
            print('PASS: loopback Java authentication, FastAPI coordination, decimal quote, idempotent replay and synthetic history. No cloud database access.')
    finally:
        if api is not None:api.app.dependency_overrides.clear()
        if engine is not None:engine.dispose()
        if child.poll() is None:child.terminate()
        try:child.wait(timeout=10)
        except subprocess.TimeoutExpired:child.kill();child.wait()

if __name__=='__main__':
    try:main()
    except Exception as error:
        print('FAIL: synthetic loopback integration; category='+type(error).__name__+'; details suppressed')
        raise SystemExit(1)
