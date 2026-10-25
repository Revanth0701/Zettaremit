"""Offline security tests: synthetic sessions only; sockets and engines are blocked."""
import datetime
import importlib
import os
from pathlib import Path
import secrets
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import jwt
from fastapi.testclient import TestClient
from sqlalchemy import MetaData
import database_config
import auth


class Query:
    def __init__(self, rows):
        self.rows = rows

    def filter(self, expression):
        return Query([r for r in self.rows
                      if getattr(r, expression.left.key) == expression.right.value])

    def first(self):
        return self.rows[0] if self.rows else None

    def order_by(self, *args):
        return self

    def limit(self, value):
        return Query(self.rows[:value])

    def all(self):
        return self.rows


class AuthenticationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.guards = [
            patch.dict(os.environ, {'JWT_SECRET_KEY': secrets.token_hex(32)}),
            patch('socket.create_connection', side_effect=AssertionError('Network forbidden')),
            patch('pymysql.connections.Connection.connect', side_effect=AssertionError('DB forbidden')),
            patch('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('DB forbidden')),
            patch.object(database_config, 'load_database_config', return_value=database_config.DatabaseConfig('local', 'synthetic')),
            patch.object(database_config, 'create_database_engine', return_value=Mock()),
            patch.object(MetaData, 'create_all'),
        ]
        for guard in cls.guards:
            guard.start()
        cls.api = importlib.import_module('main')
        cls.password = 'offline-password-example'
        cls.password_hash = cls.api.pwd_context.hash(cls.password)

    @classmethod
    def tearDownClass(cls):
        cls.api.app.dependency_overrides.clear()
        for guard in reversed(cls.guards):
            guard.stop()

    def setUp(self):
        self.api.limiter.entries.clear()
        self.alice = SimpleNamespace(user_id='USR-ALICE', email='alice@example.com',
            full_name='Alice', is_active=True, password_hash=self.password_hash,
            otp_code='hidden', document_number='hidden')
        self.bob = SimpleNamespace(user_id='USR-BOB', email='bob@example.com',
            full_name='Bob', is_active=True, password_hash=self.password_hash)
        self.records = [self.record('USR-ALICE'), self.record('USR-BOB')]
        self.db = Mock()
        self.db.query.side_effect = lambda model: Query([self.alice,self.bob] if model is self.api.User else self.records)
        def refresh(record):
            record.created_at = datetime.datetime(2026,1,1)
        self.db.refresh.side_effect = refresh
        def session():
            yield self.db
        self.api.app.dependency_overrides[self.api.get_db] = session
        self.client = TestClient(self.api.app)

    def tearDown(self):
        self.client.close()
        self.api.app.dependency_overrides.clear()

    def record(self, sender):
        return SimpleNamespace(transaction_id='TX-'+sender, sender_id=sender,
            recipient_name='Synthetic',gross_amount=100.0,fee_deducted=3.0,
            net_amount=97.0,exchange_rate=83.5,recipient_amount=1.16,source_currency='INR',target_currency='USD',
            status='Processing',created_at=datetime.datetime(2026,1,1),
            password_hash='must-not-leak',otp_code='must-not-leak',document_number='must-not-leak')

    def headers(self, user='USR-ALICE'):
        return {'Authorization':'Bearer '+auth.issue_access_token(user)}

    def test_successful_login_and_response_allowlist(self):
        result=self.client.post('/users/login',json={'email':self.alice.email,'password':self.password})
        self.assertEqual(result.status_code,200)
        data=result.json()
        self.assertEqual(set(data),{'message','user_id','full_name','access_token','token_type','expires_in'})
        self.assertEqual(auth.token_subject(data['access_token']),'USR-ALICE')
        self.assertEqual(data['expires_in'],900)

    def test_wrong_password(self):
        self.assertEqual(self.client.post('/users/login',json={'email':self.alice.email,'password':'wrong'}).status_code,401)

    def test_missing_and_malformed_tokens(self):
        for headers in ({},{'Authorization':'Basic invalid'},{'Authorization':'Bearer invalid'}):
            with self.subTest(headers=bool(headers)):
                result=self.client.get('/transactions/',headers=headers)
                self.assertEqual(result.status_code,401)
                self.assertEqual(result.headers['www-authenticate'],'Bearer')

    def test_invalid_expired_algorithm_and_claims(self):
        now=datetime.datetime.now(datetime.timezone.utc)
        base=dict(sub='USR-ALICE',iat=now,nbf=now,exp=now+datetime.timedelta(minutes=15),iss=auth.ISSUER,aud=auth.AUDIENCE)
        cases=[(dict(base),secrets.token_hex(32),'HS256'),
               (dict(base,exp=now-datetime.timedelta(seconds=1)),auth.signing_key(),'HS256'),
               (dict(base),auth.signing_key(),'HS384'),
               (dict(base,aud='other'),auth.signing_key(),'HS256'),
               (dict(base,sub=''),auth.signing_key(),'HS256'),
               (dict(base,exp=[]),auth.signing_key(),'HS256')]
        missing=dict(base);del missing['exp'];cases.append((missing,auth.signing_key(),'HS256'))
        for claims,key,algorithm in cases:
            token=jwt.encode(claims,key,algorithm=algorithm)
            self.assertEqual(self.client.get('/transactions/',headers={'Authorization':'Bearer '+token}).status_code,401)

    def test_deleted_and_inactive_users(self):
        self.assertEqual(self.client.get('/transactions/',headers=self.headers('USR-MISSING')).status_code,401)
        self.alice.is_active=False
        self.assertEqual(self.client.get('/transactions/',headers=self.headers()).status_code,401)
        self.assertEqual(self.client.post('/users/login',json={'email':self.alice.email,'password':self.password}).status_code,401)

    def test_history_is_owned_and_filtered(self):
        result=self.client.get('/transactions/',headers=self.headers())
        self.assertEqual(result.status_code,200)
        self.assertEqual(len(result.json()),1)
        self.assertEqual(result.json()[0]['sender_id'],'USR-ALICE')
        self.assertNotIn('password_hash',result.json()[0])
        self.assertNotIn('otp_code',result.json()[0])
        self.assertNotIn('document_number',result.json()[0])

    def test_cross_user_access_and_creation_denied(self):
        self.assertEqual(self.client.get('/transactions/?sender_id=USR-BOB',headers=self.headers()).status_code,403)
        result=self.client.post('/transactions/create?sender_id=USR-BOB',headers={**self.headers(),'Idempotency-Key':'synthetic-key-00001'},json={'recipient_name':'Synthetic','gross_amount':100})
        self.assertEqual(result.status_code,403)
        self.db.add.assert_not_called();self.db.commit.assert_not_called()

    def test_creation_uses_authenticated_identity(self):
        from decimal import Decimal
        self.db.query.side_effect = lambda model: Query([self.alice,self.bob] if model is self.api.User else [])
        quote = dict(feeDeducted=Decimal("3"),netAmount=Decimal("97"),exchangeRate=Decimal("83.5"),recipientAmount=Decimal("1.16"))
        from exchange_rates import RateSnapshot
        from money import TransferRequest
        import quotes
        now=datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
        snapshot=RateSnapshot(Decimal('83.50000000'),now-datetime.timedelta(hours=12),now+datetime.timedelta(hours=12),now,now+datetime.timedelta(hours=84))
        accepted=quotes.issue_quote(self.alice.user_id,TransferRequest(recipient_name='Synthetic',gross_amount='100.00'),snapshot,quote,'QUOTE-'+'a'*32)
        with patch.object(self.api,'calculate_transfer',return_value=quote):
            result=self.client.post('/transactions/create',headers={**self.headers(),'Idempotency-Key':'synthetic-key-00001'},json={'recipient_name':'Synthetic','gross_amount':'100.00','quote_token':accepted.quote_token})
        self.assertEqual(result.status_code,201)
        self.assertEqual(result.json()['transaction']['sender_id'],'USR-ALICE')
        self.assertEqual(self.db.add.call_args.args[0].sender_id,'USR-ALICE')

    def test_creation_requires_token(self):
        result=self.client.post('/transactions/create',json={'recipient_name':'Synthetic','gross_amount':100})
        self.assertEqual(result.status_code,401)
        self.db.commit.assert_not_called()

    def test_validation_errors_do_not_echo_sensitive_input(self):
        result=self.client.post('/users/login',json={'email':'synthetic','password':{'secret':'must-not-echo'}})
        self.assertEqual(result.status_code,422)
        self.assertNotIn('must-not-echo',result.text)
        self.assertNotIn('input',result.json()['detail'][0])

    def test_missing_secret_fails_closed(self):
        with patch.object(auth,'signing_key',side_effect=auth.HTTPException(status_code=503,detail='Authentication signing configuration unavailable')):
            self.assertEqual(self.client.get('/transactions/',headers={'Authorization':'Bearer invalid'}).status_code,503)


if __name__ == '__main__':
    unittest.main()
