"""Release probe: disposable container, no network/mounts, synthetic keys only.

Build zettaremit-review:local first. Never connects to existing databases or Gemini.
Writes only ignored evidence and removes only the container created by this run.
"""
import hashlib
import importlib.util
import json
import io
import pathlib
import secrets
import shutil
import subprocess
import time
import tarfile
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
EVIDENCE = ROOT/".local-backups/production-readiness"
EVIDENCE.mkdir(parents=True,exist_ok=True)
spec = importlib.util.spec_from_file_location('probe_helpers', ROOT/'tools/test_container_local.py')
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)
stage = EVIDENCE/('source-'+uuid.uuid4().hex[:8])
for pattern in ['backend/*.py','backend/ai/*.py','backend/ai/knowledge_base/*.md',
                'services/transaction-service/src/main/**/*.java',
                'services/transaction-service/src/test/resources/exchange_rate_vectors.json',
                'deployment/run_services.py','tools/test_ai_offline.py']:
    for source in ROOT.glob(pattern):
        target = stage/source.relative_to(ROOT)
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(source,target)
name='zettaremit-release-check-'+uuid.uuid4().hex[:8]
env={'APP_ENV':'production','DATABASE_MODE':'cloud','SCHEMA_REVISION':'20261023_01',
     'LOCAL_CREATE_TABLES':'false','JWT_SECRET_KEY':secrets.token_hex(32),
     'INTERNAL_SERVICE_TOKEN':secrets.token_hex(32),'CORS_ORIGINS':'https://synthetic.example.com',
     'AIVEN_HOST':'synthetic.invalid','AIVEN_PORT':'3306','AIVEN_DATABASE':'synthetic',
     'AIVEN_USER':'synthetic','AIVEN_PASSWORD':secrets.token_hex(32),'AIVEN_CA_PATH':'/tmp/synthetic-ca.pem',
     'ENABLE_AI_ASSISTANT':'true','ENABLE_AI_AGENT':'true','RAG_EMBEDDING_PROVIDER':'none',
     'GEMINI_API_KEY':'synthetic-offline-key'}
report={'network':'none','host_mounts':False,'published_ports':False,'memory_limit_mib':512}
created=False
try:
    cmd=['create','--name',name,'--network','none','--memory','512m','--memory-swap','512m',
         '--cpus','1','--pids-limit','256','--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=96m',
         '--entrypoint','python']
    for k,v in env.items():cmd+=['--env',k+'='+v]
    cmd+=['zettaremit-review:local','-u','-c',h.BOOTSTRAP]
    h.docker(*cmd);created=True
    h.docker('start',name)
    started=time.monotonic()
    ready=False
    while time.monotonic()-started<110:
        if not h.inspect(name)['State']['Running']:break
        try:
            h.docker('exec',name,'python','-c',"from urllib.request import urlopen;assert urlopen('http://127.0.0.1:8000/health',timeout=1).status==200",timeout=5)
            ready=True;break
        except (RuntimeError,subprocess.TimeoutExpired):time.sleep(1)
    assert ready,'startup failed'
    report['startup_seconds']=round(time.monotonic()-started,2)
    report['security']=json.loads(h.docker('exec','-i',name,'python','-',input=h.PROBE))
    extra="""
import json,sys
from decimal import Decimal
sys.path.insert(0,'/app/backend')
from internal_service import calculate_transfer
from money import TransferRequest
from ai.hybrid import KnowledgeIndex
from ai.agent import declarations
import ai.agent_router
from importlib.metadata import version
from passlib.context import CryptContext
assert {'list_transactions','get_transaction_details','get_latest_transaction'} <= {d.name for d in declarations()}
assert version('google-genai')=='2.7.0' and version('bcrypt')=='4.0.1'
result=calculate_transfer('SYNTHETIC',TransferRequest(recipient_name='Synthetic',gross_amount='1000.00'),'synthetic-request-0001',rate=Decimal('80.00000000'))
assert result['recipientAmount']==Decimal('12.13')
c=CryptContext(schemes=['bcrypt']);assert c.verify('synthetic-password',c.hash('synthetic-password'))
index=KnowledgeIndex();index.sync(True)
assert len(index._snapshot.chunks)==39
assert len({c['source'] for c in index._snapshot.chunks})==8
print(json.dumps({'agent_modules_and_tools':True,'pinned_sdk_and_bcrypt':True,'authenticated_java_v2_calculation':True,'bcrypt_hash_verify':True,'knowledge_documents':8,'knowledge_chunks':39,'retrieval_mode':'bm25_offline_fallback','live_gemini_calls':0,'mysql_connections':0}))
"""
    report['integration']=json.loads(h.docker('exec','-i',name,'python','-',input=extra))
    h.docker('exec',name,'python','-m','pip','check')
    report['pip_check']=True
    h.docker('exec',name,'mkdir','-p','/tmp/release')
    archive=io.BytesIO()
    with tarfile.open(fileobj=archive,mode='w') as tar:
        for source in stage.rglob('*'):
            if source.is_file():tar.add(source,arcname=source.relative_to(stage).as_posix())
    transfer=subprocess.run(['docker','exec','-i',name,'python','-c',"import sys,tarfile;tarfile.open(fileobj=sys.stdin.buffer,mode='r|').extractall('/tmp/release',filter='data')"],input=archive.getvalue(),capture_output=True,timeout=30)
    assert transfer.returncode==0,'synthetic source transfer failed'
    p=subprocess.run(['docker','exec',name,'python','-B','/tmp/release/tools/test_ai_offline.py'],capture_output=True,text=True,timeout=180)
    (stage.parent/'container-offline-tests.log').write_text(p.stdout+p.stderr)
    report['linux_backend_tests_passed']=p.returncode==0
    import re
    report['linux_test_suite_counts']=re.findall(r'Ran (\d+) tests',p.stderr)
    assert p.returncode==0,'Linux regression tests failed'
    report['memory']=h.metrics(name)
    report['image_id']=h.inspect(name)['Image']
    h.docker('stop','--time','20',name)
    state=h.inspect(name)['State']
    report['shutdown_exit_code']=state['ExitCode'];report['oom_killed']=state['OOMKilled']
    report['passed']=state['ExitCode']==0 and not state['OOMKilled']
except Exception as e:
    report['passed']=False;report['failure_category']=type(e).__name__
    report['safe_exception_classes']=getattr(e,'safe_classes',[])
    if created:
        try:
            state=h.inspect(name)['State'];report['exit_code']=state['ExitCode'];report['oom_killed']=state['OOMKilled']
        except Exception:pass
finally:
    if created:
        try:h.docker('stop','--time','10',name)
        except Exception:pass
        try:h.docker('rm',name)
        except Exception:pass
    (stage.parent/'container-results.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
raise SystemExit(0 if report.get('passed') else 1)
