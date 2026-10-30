"""Explicit local launch helper: shares only the internal token via child environment.
Never imports FastAPI or accesses a database. Run manually after setup.
"""
import os
from pathlib import Path
import subprocess
import sys


def main():
    root=Path(__file__).resolve().parent.parent
    sys.path.insert(0,str(root/'backend'))
    from settings import setting
    secret=setting('INTERNAL_SERVICE_TOKEN','')
    if len(secret.encode())<32:
        raise SystemExit('Configure a strong INTERNAL_SERVICE_TOKEN first; no values displayed.')
    env={key:value for key,value in os.environ.items() if key in ('PATH','JAVA_HOME','SYSTEMROOT','WINDIR','COMSPEC','TEMP','TMP','USERPROFILE','HOME','APPDATA','LOCALAPPDATA')}
    env.update(INTERNAL_SERVICE_TOKEN=secret,PORT='8082',BIND_ADDRESS='127.0.0.1')
    directory=root/'services/transaction-service'
    command=[str(directory/('gradlew.bat' if os.name=='nt' else 'gradlew')),'bootRun','--no-daemon']
    return subprocess.call(command,cwd=directory,env=env)

if __name__=='__main__':sys.exit(main())
