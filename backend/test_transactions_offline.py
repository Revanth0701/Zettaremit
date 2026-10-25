"""Isolated in-memory database only. Never reads an existing MySQL database."""
import datetime
from decimal import Decimal
import importlib
import os
from pathlib import Path
import secrets
import sys
import unittest
import json
import tempfile
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import Mock, patch

sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
import database_config
from money import amounts, TransferRequest, RATE
from internal_service import ServiceUnavailable
from exchange_rates import RateSnapshot
import quotes

class TransactionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.guards=[patch.dict(os.environ,{'JWT_SECRET_KEY':secrets.token_hex(32),'APP_ENV':'test','LOCAL_CREATE_TABLES':'false'}),
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
        self.quote_now=datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
        self.payload['quote_token']=self.mint()
    def tearDown(self):
        self.quote.stop();self.client.close();self.api.app.dependency_overrides.clear();self.engine.dispose()
    def calculate(self,owner,request,key,*,rate):
        fee,net,received=amounts(request.gross_amount, rate)
        return dict(feeDeducted=fee,netAmount=net,recipientAmount=received,exchangeRate=rate)
    def mint(self,owner='A',gross='1000.00',rate=RATE):
        request=TransferRequest(recipient_name='Synthetic',gross_amount=gross)
        snapshot=RateSnapshot(rate,self.quote_now-datetime.timedelta(hours=12),self.quote_now+datetime.timedelta(hours=12),
                              self.quote_now,self.quote_now+datetime.timedelta(hours=84))
        return quotes.issue_quote(owner,request,snapshot,self.calculate(owner,request,'synthetic',rate=rate),
                                  'QUOTE-'+secrets.token_hex(16),now=self.quote_now).quote_token
    def headers(self,user='A',key='synthetic-request-0001'):
        return {'Authorization':'Bearer '+self.api.issue_access_token(user),'Idempotency-Key':key}
    def post(self,payload=None,headers=None):
        return self.client.post('/transactions/create',json=payload or self.payload,headers=headers or self.headers())
    def test_persist_history_and_nonempty_owner_filter(self):
        first=self.post();self.assertEqual(first.status_code,201)
        self.assertEqual(first.json()['transaction']['recipient_amount'],'11.62')
        self.assertEqual(first.json()['transaction']['status'],'SIMULATED')
        other=self.post(dict(self.payload,quote_token=self.mint('B')),headers=self.headers('B'));self.assertEqual(other.status_code,201)
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
        self.assertEqual(amounts(Decimal('0.50'), RATE)[0],Decimal('0.02'))
        self.assertEqual(amounts(Decimal('1000'), RATE)[2],Decimal('11.62'))
    def test_internal_transport_auth_tls_and_response_checks(self):
        import internal_service
        settings={'INTERNAL_SERVICE_TOKEN':'synthetic-token-at-least-32-characters','INTERNAL_SERVICE_URL':'https://internal.example.com'}
        response=Mock();response.__enter__=Mock(return_value=response);response.__exit__=Mock(return_value=False)
        response.read.return_value=b'{"ownerId":"A","requestId":"synthetic-request-0001","feeDeducted":"30.00","netAmount":"970.00","recipientAmount":"11.62","exchangeRate":"83.50000000","status":"SIMULATED"}'
        opener=Mock();opener.open.return_value=response
        request=TransferRequest(recipient_name='Synthetic',gross_amount='1000.00')
        with patch.object(internal_service,'setting',side_effect=lambda k,d=None:settings.get(k,d)),patch.object(internal_service,'build_opener',return_value=opener) as build:
            result=internal_service.calculate_transfer('A',request,'synthetic-request-0001',rate=RATE)
            self.assertEqual(result['recipientAmount'],Decimal('11.62'))
            self.assertEqual(build.call_args.args[0].proxies,{})
            self.assertEqual(opener.open.call_args.args[0].get_header('Authorization'),'Bearer '+settings['INTERNAL_SERVICE_TOKEN'])
            settings['INTERNAL_SERVICE_URL']='http://remote.example.com'
            with self.assertRaises(ServiceUnavailable):internal_service.calculate_transfer('A',request,'synthetic-request-0001',rate=RATE)
    def test_idempotency_commit_race_recovers_existing_record(self):
        from sqlalchemy.exc import IntegrityError
        from types import SimpleNamespace
        fee,net,received=amounts(Decimal('1000'), RATE)
        from money import submission_fingerprint
        existing=SimpleNamespace(transaction_id='synthetic-existing',sender_id='A',recipient_name='Synthetic',gross_amount=Decimal('1000'),fee_deducted=fee,net_amount=net,recipient_amount=received,exchange_rate=Decimal('83.5'),source_currency='INR',target_currency='USD',status='SIMULATED',created_at=datetime.datetime(2026,1,1),request_hash=submission_fingerprint(self.api.TransactionCreate(**self.payload)))
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
        request=TransferRequest(recipient_name='Synthetic',gross_amount='1000.00')
        response=Mock();response.__enter__=Mock(return_value=response);response.__exit__=Mock(return_value=False)
        response.read.return_value=b'{"ownerId":"other","status":"COMPLETED"}'
        opener=Mock();opener.open.return_value=response
        options={'INTERNAL_SERVICE_TOKEN':'synthetic-token-at-least-32-characters','INTERNAL_SERVICE_URL':'https://internal.example.com'}
        with patch.object(internal_service,'setting',side_effect=lambda key,default=None:options.get(key,default)),patch.object(internal_service,'build_opener',return_value=opener):
            with self.assertRaises(ServiceUnavailable):internal_service.calculate_transfer('A',request,'synthetic-request-0001',rate=RATE)
            opener.open.side_effect=TimeoutError('sensitive upstream details')
            with self.assertRaises(ServiceUnavailable) as error:internal_service.calculate_transfer('A',request,'synthetic-request-0001',rate=RATE)
            self.assertEqual(str(error.exception),'')

    def test_throttle(self):
        from rate_limit import Limiter
        from fastapi import HTTPException
        limiter=Limiter();limiter.check('synthetic',limit=1)
        with self.assertRaises(HTTPException) as error:limiter.check('synthetic',limit=1)
        self.assertEqual(error.exception.status_code,429)

    def test_new_transaction_requires_quote(self):
        body={k:v for k,v in self.payload.items() if k!='quote_token'}
        self.assertEqual(self.post(body).status_code,422)
        self.calculator.assert_not_called()
        with self.factory() as db:self.assertEqual(db.query(self.api.TransactionRecord).count(),0)

    def test_expired_tampered_wrong_owner_and_mismatched_quotes(self):
        token=self.payload['quote_token']
        for body in (dict(self.payload,quote_token='invalid'),dict(self.payload,quote_token=self.mint('B')),
                     dict(self.payload,recipient_name='Other'),dict(self.payload,gross_amount='1001.00'),
                     dict(self.payload,quote_token=token[:-10]+'invalidsig')):
            self.assertEqual(self.post(body).status_code,422)
        with patch.object(quotes,'utc_now',return_value=self.quote_now+datetime.timedelta(minutes=5)):
            self.assertEqual(self.post().status_code,422)
        self.calculator.assert_not_called()

    def test_submission_never_fetches_or_reprices_and_persists_quote(self):
        self.payload['quote_token']=self.mint(rate=Decimal('80.00000000'))
        with patch.object(self.api,'get_exchange_rate_provider',side_effect=AssertionError('No fetch on submission')), \
             patch('exchange_rates.ExchangeRateProvider.get_rate',side_effect=AssertionError('No rate access on submission')):
            result=self.post()
        self.assertEqual(result.status_code,201)
        self.assertEqual(result.json()['transaction']['recipient_amount'],'12.13')
        self.assertEqual(result.json()['transaction']['exchange_rate'],'80.00000000')
        self.assertEqual(self.calculator.call_args.kwargs['rate'],Decimal('80.00000000'))

    def test_retry_before_after_expiry_and_after_signing_key_rotation(self):
        first=self.post();self.assertEqual(first.status_code,201)
        self.assertEqual(self.post().json()['transaction'],first.json()['transaction'])
        with patch.object(quotes,'utc_now',return_value=self.quote_now+datetime.timedelta(days=5)):
            self.assertEqual(self.post().json()['transaction'],first.json()['transaction'])
            self.assertEqual(self.post(headers=self.headers(key='synthetic-new-key-0001')).status_code,422)
        # Authenticate using the new access key; stored token digest still proves replay.
        with patch.dict(os.environ,{'JWT_SECRET_KEY':secrets.token_hex(32)}):
            self.assertEqual(self.post(headers=self.headers()).json()['transaction'],first.json()['transaction'])
        self.assertEqual(self.calculator.call_count,1)

    def test_same_key_different_quote_conflicts(self):
        self.assertEqual(self.post().status_code,201)
        self.assertEqual(self.post(dict(self.payload,quote_token=self.mint())).status_code,409)

    def test_signed_but_inconsistent_currency_fee_and_payout_rejected(self):
        import jwt
        original=jwt.decode(self.payload['quote_token'],quotes._key(),algorithms=['HS256'],audience=quotes.AUDIENCE)
        for field,value in (('source_currency','USD'),('target_currency','INR'),('fee_deducted','0.00'),('recipient_amount','999.99')):
            claims=json.loads(json.dumps(original))
            claims['quote'][field]=value
            token=jwt.encode(claims,quotes._key(),algorithm='HS256',headers={'typ':'zettaremit-quote+jwt'})
            self.assertEqual(self.post(dict(self.payload,quote_token=token)).status_code,422)
        self.calculator.assert_not_called()

    def test_java_disagreement_cannot_record_an_accepted_quote(self):
        self.calculator.return_value={}
        self.calculator.side_effect=None
        self.assertEqual(self.post().status_code,503)
        with self.factory() as db:self.assertEqual(db.query(self.api.TransactionRecord).count(),0)

    def test_quote_expiring_during_java_calculation_does_not_commit(self):
        def slow(owner,request,key,*,rate):
            clock.return_value=self.quote_now+datetime.timedelta(minutes=5)
            return self.calculate(owner,request,key,rate=rate)
        with patch.object(quotes,'utc_now',return_value=self.quote_now) as clock:
            self.calculator.side_effect=slow
            self.assertEqual(self.post().status_code,422)
        with self.factory() as db:self.assertEqual(db.query(self.api.TransactionRecord).count(),0)

    def test_all_shared_rounding_vectors_are_stored_exactly(self):
        from types import SimpleNamespace
        vectors=Path(__file__).resolve().parent.parent/'services/transaction-service/src/test/resources/exchange_rate_vectors.json'
        # SQLite NUMERIC uses binary floats at extreme limits. Inspect exact
        # bound Decimal values with a synthetic session for those shared cases.
        fake=Mock()
        fake.query.return_value.filter.return_value.first.return_value=SimpleNamespace(user_id='A',is_active=True)
        fake.query.return_value.filter.return_value.filter.return_value.first.return_value=None
        def session():yield fake
        self.api.app.dependency_overrides[self.api.get_db]=session
        for index,vector in enumerate(json.loads(vectors.read_text())):
            body=dict(self.payload,gross_amount=vector['gross'],quote_token=self.mint(gross=vector['gross'],rate=Decimal(vector['rate'])))
            result=self.post(body,headers=self.headers(key='synthetic-rounding-'+str(index).zfill(4)))
            self.assertEqual(result.status_code,201)
            stored=result.json()['transaction']
            self.assertEqual(Decimal(stored['exchange_rate']),Decimal(vector['rate']))
            self.assertEqual(stored['fee_deducted'],vector['fee'])
            self.assertEqual(stored['net_amount'],vector['net'])
            self.assertEqual(stored['recipient_amount'],vector['payout'])
            self.assertEqual(fake.add.call_args.args[0].exchange_rate,Decimal(vector['rate']))

    def test_rate_refresh_between_quote_endpoint_and_submission_keeps_original(self):
        snapshot=RateSnapshot(Decimal('80.00000000'),self.quote_now-datetime.timedelta(hours=12),
            self.quote_now+datetime.timedelta(hours=12),self.quote_now,self.quote_now+datetime.timedelta(hours=84))
        provider=Mock()
        provider.get_rate.return_value=snapshot
        self.api.app.dependency_overrides[self.api.get_exchange_rate_provider]=lambda:provider
        body={'recipient_name':'Synthetic','gross_amount':'1000.00'}
        first=self.client.post('/simulation/quote',json=body,headers=self.headers())
        self.assertEqual(first.status_code,200)
        from dataclasses import replace
        provider.get_rate.return_value=replace(snapshot,inr_per_usd=Decimal('90.00000000'))
        updated=self.client.post('/simulation/quote',json=body,headers=self.headers())
        self.assertEqual(updated.json()['exchange_rate'],'90.00000000')
        created=self.post(dict(body,quote_token=first.json()['quote_token']))
        self.assertEqual(created.status_code,201)
        self.assertEqual(created.json()['transaction']['exchange_rate'],'80.00000000')
        self.assertEqual(provider.get_rate.call_count,2)

    def test_legacy_history_and_identical_legacy_replay_remain_unchanged(self):
        from money import fingerprint
        record=self.api.TransactionRecord(transaction_id='historical-synthetic',sender_id='A',recipient_name='Synthetic',
            gross_amount=Decimal('1000'),fee_deducted=Decimal('30'),net_amount=Decimal('970'),exchange_rate=RATE,
            recipient_amount=Decimal('80995'),source_currency='USD',target_currency='INR',status='LEGACY',
            idempotency_key='synthetic-request-0001',request_hash=fingerprint(TransferRequest(recipient_name='Synthetic',gross_amount='1000')))
        with self.factory() as db:db.add(record);db.commit()
        old={k:v for k,v in self.payload.items() if k!='quote_token'}
        result=self.post(old);self.assertEqual(result.status_code,201)
        self.assertEqual(result.json()['transaction']['recipient_amount'],'80995.00')
        self.assertEqual(self.client.get('/transactions/',headers=self.headers()).json()[0]['source_currency'],'USD')
        self.assertEqual(self.post(old,headers=self.headers(key='synthetic-new-legacy-key')).status_code,422)
        self.calculator.assert_not_called()

    def concurrent_results(self,payloads):
        from sqlalchemy.orm import sessionmaker
        temp=tempfile.TemporaryDirectory(prefix='zettaremit-synthetic-')
        self.addCleanup(temp.cleanup)
        self.engine.dispose()
        self.engine=create_engine('sqlite:///'+str(Path(temp.name)/'synthetic.db'),connect_args={'check_same_thread':False,'timeout':20})
        self.api.Base.metadata.create_all(self.engine)
        self.factory=sessionmaker(bind=self.engine,autoflush=False)
        with self.factory() as db:
            db.add(self.api.User(user_id='A',full_name='Synthetic',email='synthetic@example.com',password_hash='unused',is_active=True));db.commit()
        barrier=Barrier(2)
        def calculate(owner,request,key,*,rate):
            barrier.wait(timeout=10)
            return self.calculate(owner,request,key,rate=rate)
        self.calculator.side_effect=calculate
        headers=self.headers()
        def submit(_):
            with TestClient(self.api.app) as client:
                response=client.post('/transactions/create',json=payloads[_],headers=headers)
                return response.status_code,response.json().get('transaction',{}).get('transaction_id')
        with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(submit,range(2)))
        return results

    def test_real_concurrent_duplicates_commit_one_record(self):
        results=self.concurrent_results([self.payload,self.payload])
        self.assertEqual([r[0] for r in results],[201,201])
        self.assertEqual(results[0][1],results[1][1])
        with self.factory() as db:self.assertEqual(db.query(self.api.TransactionRecord).count(),1)

    def test_real_concurrent_conflicting_requests_record_only_the_winner(self):
        other=dict(self.payload,gross_amount='2000.00',quote_token=self.mint(gross='2000.00'))
        results=self.concurrent_results([self.payload,other])
        self.assertEqual(sorted(r[0] for r in results),[201,409])
        with self.factory() as db:self.assertEqual(db.query(self.api.TransactionRecord).count(),1)

if __name__=='__main__':unittest.main()
