"""Explicit local setup helper. Never rotates existing values or prints secrets."""
from pathlib import Path
from io import StringIO
import secrets
import subprocess
from dotenv.parser import parse_stream


def main():
    root=Path(__file__).resolve().parent.parent
    path=root/'backend/.env'
    if subprocess.run(['git','check-ignore','--quiet','--','backend/.env'],cwd=root).returncode:
        raise SystemExit('Refusing to write: backend/.env is not ignored')
    raw=path.read_bytes()
    parsed=list(parse_stream(StringIO(raw.decode('utf-8-sig'))))
    if any(value.error for value in parsed):raise SystemExit('Refusing to change malformed environment file')
    keys={value.key for value in parsed}
    missing=[name for name in ('JWT_SECRET_KEY','INTERNAL_SERVICE_TOKEN') if name not in keys]
    if not missing:
        print('Existing signing and service keys preserved.');return
    newline=b'\r\n' if b'\r\n' in raw else b'\n'
    addition=(b'' if not raw or raw.endswith(b'\n') else newline)
    for key in missing:addition+=key.encode()+b'='+secrets.token_hex(32).encode()+newline
    with path.open('ab') as stream:stream.write(addition)
    print('Missing local secrets configured without displaying values; existing settings preserved.')

if __name__=='__main__':main()
