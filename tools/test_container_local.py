"""Synthetic Docker runtime audit. No host mounts, published ports or external network.
Build image first. Uses only temporary synthetic keys/CA and in-memory SQLite fixtures.
"""
import argparse
import json
from pathlib import Path
import secrets
import subprocess
import sys
import time
import uuid

IMAGE = "zettaremit-review:local"

BOOTSTRAP = r"""
import datetime, os, sys
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
key = rsa.generate_private_key(public_exponent=65537,key_size=2048)
name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'synthetic-test-ca')])
now = datetime.datetime.now(datetime.timezone.utc)
cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
        .serial_number(x509.random_serial_number()).not_valid_before(now-datetime.timedelta(minutes=1))
        .not_valid_after(now+datetime.timedelta(days=1))
        .add_extension(x509.BasicConstraints(ca=True,path_length=None),critical=True).sign(key,hashes.SHA256()))
with open('/tmp/synthetic-ca.pem','wb') as stream: stream.write(cert.public_bytes(serialization.Encoding.PEM))
if os.environ.get('SYNTHETIC_SQLITE_FIXTURE') == 'true':
    sys.path.insert(0,'/app/backend')
    import main
    main.Base.metadata.create_all(main.engine) # Ephemeral /tmp SQLite fixture only.
    with main.SessionLocal() as db:
        db.add_all([main.User(user_id='SYNTHETIC-A',full_name='Synthetic',email='a@example.com',password_hash='unused',is_active=True),main.User(user_id='SYNTHETIC-B',full_name='Synthetic',email='b@example.com',password_hash='unused',is_active=True)])
        db.commit()
    main.engine.dispose()
os.execv(sys.executable,[sys.executable,'/app/run_services.py'])
"""

PROBE = r"""
import json, os, socket, sys
from pathlib import Path
from urllib.request import build_opener, ProxyHandler, Request
from urllib.error import HTTPError
opener = build_opener(ProxyHandler({}))
def get(path,port=8000,headers=None,data=None):
    try:
        with opener.open(Request('http://127.0.0.1:'+str(port)+path,headers=headers or {},data=data),timeout=10) as response:
            return response.status,json.loads(response.read())
    except HTTPError as error:
        return error.code,None
assert os.getuid()!=0
assert get('/health')[0]==200
assert get('/transactions/')[0]==401
assert get('/transactions/',headers={'Authorization':'Bearer invalid'})[0]==401
assert get('/internal/v1/quote',8082,data=b'{}')[0]==401
assert get('/internal/v1/quote',8082,headers={'Authorization':'Bearer wrong'},data=b'{}')[0]==401
assert get('/api/v1/transactions',8082,headers={'Authorization':'Bearer '+os.environ['INTERNAL_SERVICE_TOKEN']})[0]==404
# Confirm private binding from kernel socket table, not only the config file.
listeners=[]
for name in ('tcp','tcp6'):
    for row in (Path('/proc/net')/name).read_text().splitlines()[1:]:
        fields=row.split()
        if fields[3]=='0A':listeners.append(fields[1])
java_sockets=[value.split(':')[0] for value in listeners if value.endswith(':1F92')]
allowed={'0100007F','0000000000000000FFFF00000100007F','00000000000000000000000001000000'}
assert java_sockets and all(value in allowed for value in java_sockets)
# Java's environment must not receive JWT or Aiven settings.
java_pids=[]
for entry in Path('/proc').iterdir():
    if entry.name.isdigit():
        try:
            if (entry/'comm').read_text().strip()=='java':java_pids.append(entry.name)
        except OSError:pass
assert len(java_pids)==1
keys={value.split(b'=',1)[0] for value in (Path('/proc')/java_pids[0]/'environ').read_bytes().split(b'\0') if value}
assert b'JWT_SECRET_KEY' not in keys and not any(key.startswith(b'AIVEN_') for key in keys)
# Image must contain no copied environment files or customer reports/databases.
for root,dirs,files in os.walk('/app'):
    assert not any(name.startswith('.env') or name.endswith(('.pem','.sql','.db','.csv','.dump','.key')) for name in files)
sys.path.insert(0,'/app/backend')
from database_config import load_cloud_config
import ssl
config=load_cloud_config()
assert config.connect_args['ssl'].verify_mode==ssl.CERT_REQUIRED
assert config.connect_args['ssl'].check_hostname
print(json.dumps({'health':200,'missing_token':401,'invalid_token':401,'java_missing_token':401,'java_wrong_token':401,'legacy_java_path':404,'java_loopback_only':True,'java_secret_isolation':True,'non_root':True,'strict_tls':True}))
"""

SYNTHETIC = r"""
import asyncio,json,sys
from unittest.mock import patch
sys.path.insert(0,'/app/backend')
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
# MySQL access is forbidden even though the synthetic configuration selects cloud.
with patch('pymysql.connections.Connection.connect',side_effect=AssertionError('MySQL forbidden')):
    import main
    engine=create_engine('sqlite://',poolclass=StaticPool,connect_args={'check_same_thread':False})
    main.Base.metadata.create_all(engine) # Synthetic in-memory fixture only, not a migration.
    factory=sessionmaker(bind=engine,autoflush=False)
    with factory() as db:
        db.add_all([main.User(user_id='SYNTHETIC-A',full_name='Synthetic',email='a@example.com',password_hash='unused',is_active=True), main.User(user_id='SYNTHETIC-B',full_name='Synthetic',email='b@example.com',password_hash='unused',is_active=True)])
        db.commit()
    def session():
        with factory() as db:yield db
    main.app.dependency_overrides[main.get_db]=session
    token=main.issue_access_token('SYNTHETIC-A')
    async def request(method,path,body=None,query=b'',key='synthetic-request-0001'):
        data=json.dumps(body).encode() if body is not None else b''
        headers=[(b'authorization',('Bearer '+token).encode()),(b'content-type',b'application/json'),(b'idempotency-key',key.encode())]
        scope={'type':'http','asgi':{'version':'3.0'},'http_version':'1.1','method':method,'scheme':'http','path':path,'raw_path':path.encode(),'query_string':query,'root_path':'','headers':headers,'client':('127.0.0.1',1),'server':('127.0.0.1',8000)}
        sent=[];done=False
        async def receive():
            nonlocal done
            if not done:done=True;return {'type':'http.request','body':data,'more_body':False}
            await asyncio.Event().wait()
        async def send(message):sent.append(message)
        await main.app(scope,receive,send)
        status=next(message['status'] for message in sent if message['type']=='http.response.start')
        content=b''.join(message.get('body',b'') for message in sent if message['type']=='http.response.body')
        return status,json.loads(content)
    async def run():
        payload={'recipient_name':'Synthetic','gross_amount':'1000.00'}
        status,created=await request('POST','/transactions/create',payload)
        assert status==201 and created['transaction']['recipient_amount']=='11.62'
        status,replay=await request('POST','/transactions/create',payload)
        assert status==201 and replay['transaction']['transaction_id']==created['transaction']['transaction_id']
        status,history=await request('GET','/transactions/')
        assert status==200 and len(history)==1 and all(row['sender_id']=='SYNTHETIC-A' for row in history)
        status,_=await request('GET','/transactions/',query=b'sender_id=SYNTHETIC-B')
        assert status==403
        # Bounded sequential workload exercises Java/Python without real data or endpoints on the host.
        for i in range(40):
            status,_=await request('POST','/transactions/create',payload,key='synthetic-load-'+str(i).zfill(8))
            assert status==201
        with factory() as db:assert db.query(main.TransactionRecord).count()==41
    try:asyncio.run(run())
    finally:main.app.dependency_overrides.clear();engine.dispose();main.engine.dispose()
print(json.dumps({'synthetic_transfer':201,'synthetic_history':200,'synthetic_cross_user':403,'decimal_and_idempotency':True,'sequential_simulations':41,'mysql_connections':0}))
"""


BLACKBOX = r"""
import json,sys
from urllib.request import build_opener,ProxyHandler,Request
from urllib.error import HTTPError
sys.path.insert(0,'/app/backend')
from auth import issue_access_token
opener=build_opener(ProxyHandler({}))
token=issue_access_token('SYNTHETIC-A')
headers={'Authorization':'Bearer '+token,'Idempotency-Key':'synthetic-http-request-0001','Content-Type':'application/json'}
def request(path,body=None):
    data=json.dumps(body).encode() if body is not None else None
    try:
        with opener.open(Request('http://127.0.0.1:8000'+path,data=data,headers=headers),timeout=15) as response:return response.status,json.loads(response.read())
    except HTTPError as error:return error.code,None
payload={'recipient_name':'Synthetic','gross_amount':'1000.00'}
status,first=request('/transactions/create',payload)
assert status==201 and first['transaction']['recipient_amount']=='11.62'
status,replay=request('/transactions/create',payload)
assert status==201 and first['transaction']['transaction_id']==replay['transaction']['transaction_id']
status,history=request('/transactions/')
assert status==200 and len(history)==1 and all(row['sender_id']=='SYNTHETIC-A' for row in history)
assert request('/transactions/?sender_id=SYNTHETIC-B')[0]==403
for i in range(40):
    headers['Idempotency-Key']='synthetic-http-load-'+str(i).zfill(8)
    assert request('/transactions/create',payload)[0]==201
status,history=request('/transactions/')
assert status==200 and len(history)==41
print(json.dumps({'synthetic_transfer':201,'synthetic_history':200,'synthetic_cross_user':403,'decimal_and_idempotency':True,'sequential_simulations':41,'mysql_connections':0,'transport':'real HTTP to running Uvicorn','database':'ephemeral SQLite fixture'}))
"""


CONCURRENT = r"""
import json,sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0,'/app/backend')
from internal_service import calculate_transfer
from money import TransferRequest
request=TransferRequest(recipient_name='Synthetic',gross_amount='1000.00')
def one(index):
    result=calculate_transfer('SYNTHETIC-LOAD',request,'synthetic-concurrent-'+str(index).zfill(8))
    assert str(result['recipientAmount'])=='11.62'
with ThreadPoolExecutor(max_workers=4) as pool:
    assert len(list(pool.map(one,range(80))))==80
print(json.dumps({'parallel_workers':4,'successful_stateless_quotes':80}))
"""


def docker(*args, input=None, timeout=180):
    result=subprocess.run(['docker',*args],input=input,text=True,capture_output=True,timeout=timeout)
    if result.returncode:
        # Never render arguments/environment or raw container output.
        error=RuntimeError('Docker operation failed: '+args[0])
        import re
        error.safe_classes=list(dict.fromkeys(re.findall(r'\b([A-Za-z_][A-Za-z0-9_]*(?:Error|Exception))\b',result.stderr)))
        raise error
    return result.stdout + result.stderr if args[0] == 'logs' else result.stdout


def inspect(container):
    return json.loads(docker('inspect',container))[0]


def metrics(container):
    code="import json;from pathlib import Path;p=Path('/sys/fs/cgroup');print(json.dumps({n:int((p/n).read_text()) for n in ['memory.current','memory.peak','memory.max']}))"
    return json.loads(docker('exec',container,'python','-c',code))


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--memory-mib',type=int,default=512)
    parser.add_argument('--failure-mode', choices=['none','java','api'], default='none')
    parser.add_argument('--fixture-db',action='store_true',help='Use only an ephemeral SQLite fixture for live HTTP checks')
    args=parser.parse_args()
    name='zettaremit-synthetic-'+uuid.uuid4().hex[:10]
    environment={'APP_ENV':'production','DATABASE_MODE':'cloud','SCHEMA_REVISION':'20261023_01',
        'LOCAL_CREATE_TABLES':'false','JWT_SECRET_KEY':secrets.token_hex(32),
        'INTERNAL_SERVICE_TOKEN':secrets.token_hex(32),'CORS_ORIGINS':'https://synthetic.example.com',
        'AIVEN_HOST':'synthetic.invalid','AIVEN_PORT':'3306','AIVEN_DATABASE':'synthetic',
        'AIVEN_USER':'synthetic','AIVEN_PASSWORD':secrets.token_hex(32),'AIVEN_CA_PATH':'/tmp/synthetic-ca.pem'}
    if args.fixture_db:
        environment.update(APP_ENV='test',DATABASE_MODE='local',DATABASE_URL='sqlite:////tmp/synthetic-fixture.db',SYNTHETIC_SQLITE_FIXTURE='true')
    report={'memory_limit_mib':args.memory_mib,'network':'none','published_ports':False,'host_mounts':False,'failure_mode':args.failure_mode,'fixture_db':args.fixture_db}
    created=False
    try:
        command=['create','--name',name,'--network','none','--memory',str(args.memory_mib)+'m','--memory-swap',str(args.memory_mib)+'m','--cpus','1','--pids-limit','256','--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=64m','-i','--entrypoint','python']
        for key,value in environment.items():command+=['--env',key+'='+value]
        command += [IMAGE,'-u','-c',BOOTSTRAP]
        docker(*command);created=True
        docker('start',name)
        started=time.monotonic();ready=False
        for _ in range(120):
            state=inspect(name)['State']
            if not state['Running']:break
            try:
                result=json.loads(docker('exec',name,'python','-c',"import json;from urllib.request import build_opener,ProxyHandler; r=build_opener(ProxyHandler({})).open('http://127.0.0.1:8000/health',timeout=1);print(json.dumps({'status':r.status}))",timeout=5))
                if result['status']==200:ready=True;break
            except (RuntimeError,subprocess.TimeoutExpired):pass
            time.sleep(1)
        if not ready:
            raw=docker('logs',name)
            categories={'password cannot be longer than 72 bytes':'bcrypt/passlib compatibility','libjli.so':'Java shared-library dependency','error while loading shared libraries':'Java system library dependency','OutOfMemoryError':'Java memory exhaustion','Authentication signing configuration unavailable':'Signing configuration failure'}
            report['startup_failure']=next((label for marker,label in categories.items() if marker in raw),'Unclassified startup failure')
            import re
            report['exception_classes']=list(dict.fromkeys(re.findall(r'\b([A-Za-z_][A-Za-z0-9_]*(?:Error|Exception))\b',raw)))
            report['state']={key:inspect(name)['State'][key] for key in ('ExitCode','OOMKilled')}
            raise RuntimeError('Container startup failed')
        report['startup_seconds']=round(time.monotonic()-started,2)
        cfg=inspect(name)
        assert cfg['HostConfig']['NetworkMode']=='none' and not cfg['HostConfig'].get('PortBindings') and all(m['Type']=='tmpfs' for m in cfg['Mounts'])
        report['baseline_memory']=metrics(name)
        # Check runtime bcrypt compatibility without loading any user password hashes.
        crypto="from passlib.context import CryptContext;c=CryptContext(schemes=['bcrypt']);h=c.hash('synthetic-password');assert c.verify('synthetic-password',h);print('ok')"
        assert docker('exec',name,'python','-c',crypto).strip()=='ok'
        report['password_hash_compatibility']=True
        report['stage']='security probe'
        report['security']=json.loads(docker('exec','-i',name,'python','-',input=PROBE))
        report['stage']='synthetic integration'
        report['integration']=json.loads(docker('exec','-i',name,'python','-',input=BLACKBOX if args.fixture_db else SYNTHETIC))
        report['concurrent_calculator']=json.loads(docker('exec','-i',name,'python','-',input=CONCURRENT))
        report['loaded_memory']=metrics(name)
        for label in ('baseline_memory','loaded_memory'):
            report[label+'_mib']={key:round(value/(1024*1024),2) for key,value in report[label].items()}
        report['image_id']=cfg['Image']
        if args.failure_mode == 'none':
            # Requested stop must be graceful and must not require Docker SIGKILL.
            docker('stop','--time','20',name)
            expected_exit=0
        else:
            # Signal only a child belonging to this newly created isolated container.
            target='java' if args.failure_mode=='java' else 'uvicorn'
            code="import os,signal;from pathlib import Path;target="+repr(target)+";matches=[]\nfor p in Path('/proc').iterdir():\n if p.name.isdigit():\n  try:\n   raw=(p/'cmdline').read_bytes().split(bytes([0]));comm=(p/'comm').read_text().strip()\n   if (target=='java' and comm=='java') or (target=='uvicorn' and b'uvicorn' in raw):matches.append(int(p.name))\n  except OSError:pass\nassert len(matches)==1;os.kill(matches[0],signal.SIGTERM)"
            docker('exec',name,'python','-c',code)
            deadline=time.monotonic()+25
            while inspect(name)['State']['Running'] and time.monotonic()<deadline:time.sleep(.5)
            expected_exit=1
        state=inspect(name)['State']
        report['stage']='shutdown'
        report['shutdown_exit_code']=state['ExitCode'];report['oom_killed']=state['OOMKilled']
        report['passed']=not state['Running'] and state['ExitCode']==expected_exit and not state['OOMKilled']
    except Exception as error:
        report['passed']=False;report['failure_category']=type(error).__name__
        report['exception_classes']=getattr(error,'safe_classes',[])
    finally:
        if created:
            try:docker('stop','--time','10',name)
            except Exception:pass
            try:docker('rm',name)
            except Exception:pass
        filename=('CONTAINER_HTTP_RESULTS.json' if args.fixture_db else 'CONTAINER_RESULTS.json') if args.failure_mode=='none' else 'CONTAINER_'+args.failure_mode.upper()+'_FAILURE_RESULTS.json'
        path=Path(__file__).resolve().parent.parent/'docs'/filename
        path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,indent=2))
    return 0 if report.get('passed') else 1

if __name__=='__main__':sys.exit(main())
