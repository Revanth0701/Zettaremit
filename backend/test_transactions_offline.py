"""Isolated in-memory database only. Never reads an existing MySQL database."""
import datetime
from decimal import Decimal
import importlib
import os
from pathlib import Path
import secrets
import sys
import unittest
from unittest.mock import Mock, patch

sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
import database_config
from money import amounts, TransferRequest
from internal_service import ServiceUnavailable

class TransactionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.guards=[patch.dict(os.environ,{'JWT_SECRET_KEY':secrets.token_hex(32)}),
            patch('socket.create_connection',side_effect=AssertionError('Network forbidden')),
            patch('pymysql.connections.Connection.connect',side_effect=AssertionError('MySQL forbidden')),
            patch.object(database_config,'load_database_config',return_value=database_config.DatabaseConfig('local','synthetic')),
            patch.object(database_config,'create_database_engine',return_value=Mock())]
        for guard in cls.guards:guard.start()
        cls.api=importlib.import_module('main')
    @classmethod
    def tearDownClass(cls):
        cls.api.app.dependency_overrides.clear()
        for guard in reversed(cls.guards):guard.stop()
    def setUp(self):
        self.api.limiter.entries.clear()
        self.engine=create_engine('sqlite://',poolclass=StaticPool,connect_args={'check_same_thread':False})
        self.api.Base.metadata.create_all(self.engine)
        from sqlalchemy.orm import sessionmaker
        self.factory=sessionmaker(bind=self.engine,autoflush=False)
        with self.factory() as db:
            db.add_all([self.api.User(user_id='A',full_name='Synthetic',email='a@example.com',password_hash='not-used',is_active=True),self.api.User(user_id='B',full_name='Synthetic',email='b@example.com',password_hash='not-used',is_active=True)])
            db.commit()
        def dependency():
            with self.factory() as db:yield db
        self.api.app.dependency_overrides[self.api.get_db]=dependency
        self.client=TestClient(self.api.app)
        self.quote=patch.object(self.api,'calculate_transfer',side_effect=self.calculate)
        self.calculator=self.quote.start()
        self.payload={'recipient_name':'Synthetic','gross_amount':'1000.00'}
    def tearDown(self):
        self.quote.stop();self.client.close();self.api.app.dependency_overrides.clear();self.engine.dispose()
    def calculate(self,owner,request,key):
        fee,net,received=amounts(request.gross_amount)
        return dict(feeDeducted=fee,netAmount=net,recipientAmount=received,exchangeRate=Decimal('83.50000000'))
    def headers(self,user='A',key='synthetic-request-0001'):
        return {'Authorization':'Bearer '+self.api.issue_access_token(user),'Idempotency-Key':key}
    def post(self,payload=None,headers=None):
        return self.client.post('/transactions/create',json=payload or self.payload,headers=headers or self.headers())
    def test_persist_history_and_nonempty_owner_filter(self):
        first=self.post();self.assertEqual(first.status_code,201)
        self.assertEqual(first.json()['transaction']['recipient_amount'],'11.62')
        self.assertEqual(first.json()['transaction']['status'],'SIMULATED')
        other=self.post(headers=self.headers('B'));self.assertEqual(other.status_code,201)
        result=self.client.get('/transactions/',headers=self.headers())
        self.assertEqual(result.status_code,200);self.assertEqual(len(result.json()),1)
        self.assertTrue(all(row['sender_id']=='A' for row in result.json()))
    def test_duplicate_and_conflicting_request(self):
        a=self.post();b=self.post();self.assertEqual(a.json()['transaction']['transaction_id'],b.json()['transaction']['transaction_id'])
        self.assertEqual(self.calculator.call_count,1)
        self.assertEqual(self.post(dict(self.payload,gross_amount='2000.00')).status_code,409)
        with self.factory() as db:self.assertEqual(db.query(self.api.TransactionRecord).count(),1)
    def test_service_failure_retry_records_once(self):
        self.calculator.side_effect=ServiceUnavailable()
        self.assertEqual(self.post().status_code,503)
        with self.factory() as db:self.assertEqual(db.query(self.api.TransactionRecord).count(),0)
        self.calculator.side_effect=self.calculate
        self.assertEqual(self.post().status_code,201)
        self.assertEqual(self.post().status_code,201)
        with self.factory() as db:self.assertEqual(db.query(self.api.TransactionRecord).count(),1)
    def test_amount_validation_and_sender_spoofing(self):
        for value in ['0','-1','1000000.01','1.001','NaN','Infinity']:
            self.assertEqual(self.post(dict(self.payload,gross_amount=value)).status_code,422)
        self.assertEqual(self.post(dict(self.payload,sender_id='B')).status_code,422)
        self.calculator.assert_not_called()
    def test_missing_idempotency_key(self):
        headers=self.headers();del headers['Idempotency-Key']
        self.assertEqual(self.post(headers=headers).status_code,422)
    def test_decimal_rounding(self):
        self.assertEqual(amounts(Decimal('0.50'))[0],Decimal('0.02'))
        self.assertEqual(amounts(Decimal('1000'))[2],Decimal('11.62'))
    def test_internal_transport_auth_tls_and_response_checks(self):
        import internal_service
        settings={'INTERNAL_SERVICE_TOKEN':'synthetic-token-at-least-32-characters','INTERNAL_SERVICE_URL':'https://internal.example.com'}
        response=Mock();response.__enter__=Mock(return_value=response);response.__exit__=Mock(return_value=False)
        response.read.return_value=b'{"ownerId":"A","requestId":"synthetic-request-0001","feeDeducted":"30.00","netAmount":"970.00","recipientAmount":"11.62","exchangeRate":"83.50000000","status":"SIMULATED"}'
        opener=Mock();opener.open.return_value=response
        request=TransferRequest(**self.payload)
        with patch.object(internal_service,'setting',side_effect=lambda k,d=None:settings.get(k,d)),patch.object(internal_service,'build_opener',return_value=opener) as build:
            result=internal_service.calculate_transfer('A',request,'synthetic-request-0001')
            self.assertEqual(result['recipientAmount'],Decimal('11.62'))
            self.assertEqual(build.call_args.args[0].proxies,{})
            self.assertEqual(opener.open.call_args.args[0].get_header('Authorization'),'Bearer '+settings['INTERNAL_SERVICE_TOKEN'])
            settings['INTERNAL_SERVICE_URL']='http://remote.example.com'
            with self.assertRaises(ServiceUnavailable):internal_service.calculate_transfer('A',request,'synthetic-request-0001')
    def test_idempotency_commit_race_recovers_existing_record(self):
        from sqlalchemy.exc import IntegrityError
        from types import SimpleNamespace
        fee,net,received=amounts(Decimal('1000'))
        from money import fingerprint
        existing=SimpleNamespace(transaction_id='synthetic-existing',sender_id='A',recipient_name='Synthetic',gross_amount=Decimal('1000'),fee_deducted=fee,net_amount=net,recipient_amount=received,exchange_rate=Decimal('83.5'),source_currency='INR',target_currency='USD',status='SIMULATED',created_at=datetime.datetime(2026,1,1),request_hash=fingerprint(TransferRequest(**self.payload)))
        fake=Mock()
        fake.query.return_value.filter.return_value.first.return_value=SimpleNamespace(user_id='A',is_active=True)
        # First owner+key lookup misses; after simulated unique-index race it finds the winner.
        fake.query.return_value.filter.return_value.filter.return_value.first.side_effect=[None,existing]
        fake.commit.side_effect=IntegrityError('synthetic',{},Exception('synthetic'))
        def dependency():yield fake
        self.api.app.dependency_overrides[self.api.get_db]=dependency
        result=self.post()
        self.assertEqual(result.status_code,201)
        self.assertEqual(result.json()['transaction']['transaction_id'],'synthetic-existing')
        fake.rollback.assert_called_once()

    def test_registration_is_generic_and_validates_password(self):
        invalid={'full_name':'Synthetic','email':'synthetic@example.com','password':'short'}
        self.assertEqual(self.client.post('/users/register',json=invalid).status_code,422)
        valid=dict(invalid,password='long-synthetic-password')
        first=self.client.post('/users/register',json=valid)
        duplicate=self.client.post('/users/register',json=valid)
        self.assertEqual(first.status_code,201);self.assertEqual(first.json(),duplicate.json())
        self.assertEqual(set(first.json()),{'message'})

    def test_internal_rejects_tampered_result_and_network_errors(self):
        import internal_service
        request=TransferRequest(**self.payload)
        response=Mock();response.__enter__=Mock(return_value=response);response.__exit__=Mock(return_value=False)
        response.read.return_value=b'{"ownerId":"other","status":"COMPLETED"}'
        opener=Mock();opener.open.return_value=response
        options={'INTERNAL_SERVICE_TOKEN':'synthetic-token-at-least-32-characters','INTERNAL_SERVICE_URL':'https://internal.example.com'}
        with patch.object(internal_service,'setting',side_effect=lambda key,default=None:options.get(key,default)),patch.object(internal_service,'build_opener',return_value=opener):
            with self.assertRaises(ServiceUnavailable):internal_service.calculate_transfer('A',request,'synthetic-request-0001')
            opener.open.side_effect=TimeoutError('sensitive upstream details')
            with self.assertRaises(ServiceUnavailable) as error:internal_service.calculate_transfer('A',request,'synthetic-request-0001')
            self.assertEqual(str(error.exception),'')

    def test_throttle(self):
        from rate_limit import Limiter
        from fastapi import HTTPException
        limiter=Limiter();limiter.check('synthetic',limit=1)
        with self.assertRaises(HTTPException) as error:limiter.check('synthetic',limit=1)
        self.assertEqual(error.exception.status_code,429)

if __name__=='__main__':unittest.main()
