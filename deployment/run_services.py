"""Single low-cost container: only FastAPI is public; Java binds loopback.
No migration commands. Startup checks both child processes and propagates shutdown.
"""
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import time


def main():
    children=[]
    stopping=False
    def stop(*_):
        nonlocal stopping
        stopping=True
        for child in children:
            if child.poll() is None:child.terminate()
    signal.signal(signal.SIGTERM,stop)
    signal.signal(signal.SIGINT,stop)
    try:
        java_env={key:value for key,value in os.environ.items() if key in ('PATH','JAVA_HOME','LANG','HOME','INTERNAL_SERVICE_TOKEN')}
        java_env.update(PORT='8082',BIND_ADDRESS='127.0.0.1')
        children.append(subprocess.Popen(['java','-Xms32m','-Xmx160m','-XX:MaxMetaspaceSize=128m','-jar','/app/transaction-service.jar'],env=java_env))
        deadline=time.monotonic()+90
        while time.monotonic()<deadline:
            if stopping:return 0
            if children[0].poll() is not None:raise RuntimeError('Internal service startup failed')
            try:
                with socket.create_connection(('127.0.0.1',8082),timeout=1):break
            except OSError:time.sleep(0.5)
        else:raise RuntimeError('Internal service startup timed out')
        if stopping:return 0
        env=dict(os.environ,INTERNAL_SERVICE_URL='http://127.0.0.1:8082')
        port=str(int(env.get('PORT','8000')))
        children.append(subprocess.Popen([sys.executable,'-m','uvicorn','main:app','--host','0.0.0.0','--port',port,'--workers','1','--no-access-log','--no-proxy-headers'],cwd='/app/backend',env=env))
        while all(child.poll() is None for child in children):time.sleep(0.5)
        return 0 if stopping else 1
    except Exception:
        if stopping:return 0
        print('Service startup failed; configuration details suppressed.',file=sys.stderr)
        return 1
    finally:
        stop()
        for child in children:
            try:child.wait(timeout=10)
            except subprocess.TimeoutExpired:child.kill();child.wait()

if __name__=='__main__':sys.exit(main())
