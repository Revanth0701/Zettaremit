"""Registration contract regressions. Disposable SQLite; MySQL and outbound sockets blocked."""
import importlib
from pathlib import Path
import secrets
import sys
import unittest
from unittest.mock import Mock, patch

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
import auth
import database_config


class RegistrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.guards = [
            patch('settings.setting', lambda name, default=None: default),
            patch.object(auth, 'signing_key', return_value=secrets.token_hex(32)),
            patch('socket.create_connection', side_effect=AssertionError('Outbound network forbidden')),
            patch('pymysql.connections.Connection.connect', side_effect=AssertionError('MySQL forbidden')),
            patch.object(database_config, 'load_database_config', return_value=database_config.DatabaseConfig('local', 'synthetic')),
            patch.object(database_config, 'create_database_engine', return_value=Mock()),
        ]
        for guard in cls.guards:
            guard.start()
        cls.api = importlib.import_module('main')

    @classmethod
    def tearDownClass(cls):
        for guard in reversed(cls.guards):
            guard.stop()

    def setUp(self):
        self.api.limiter.entries.clear()
        self.engine = create_engine('sqlite://', poolclass=StaticPool, connect_args={'check_same_thread': False})
        self.api.Base.metadata.create_all(self.engine)
        self.factory = sessionmaker(bind=self.engine, autoflush=False)
        def dependency():
            with self.factory() as db:
                yield db
        self.api.app.dependency_overrides[self.api.get_db] = dependency
        self.client = TestClient(self.api.app, raise_server_exceptions=False)
        self.payload = dict(full_name='Synthetic User', email='synthetic@example.com', password='Synthetic-original-password')

    def tearDown(self):
        self.client.close()
        self.api.app.dependency_overrides.clear()
        self.engine.dispose()

    def register(self, **updates):
        return self.client.post('/users/register', json={**self.payload, **updates})

    def login(self, password=None):
        return self.client.post('/users/login', json=dict(email=self.payload['email'], password=password or self.payload['password']))

    def assert_empty(self):
        with self.factory() as db:
            self.assertEqual(db.query(self.api.User).count(), 0)
            self.assertEqual(db.query(self.api.UserVerification).count(), 0)

    def test_new_account_commits_user_and_kyc_and_logs_in(self):
        response = self.register()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json(), dict(status='created', message='Account created. Please sign in.'))
        with self.factory() as db:
            user = db.query(self.api.User).one()
            kyc = db.query(self.api.UserVerification).one()
            self.assertEqual(kyc.user_id, user.user_id)
            self.assertEqual(kyc.document_status, 'SIMULATED')
            self.assertIsNone(kyc.document_number)
            self.assertTrue(self.api.pwd_context.verify(self.payload['password'], user.password_hash))
        self.assertEqual(self.login().status_code, 200)

    def test_duplicate_returns_409_and_preserves_original_credentials(self):
        self.assertEqual(self.register().status_code, 201)
        with self.factory() as db:
            original_hash = db.query(self.api.User).one().password_hash
        response = self.register(password='Synthetic-replacement-password')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['detail'], self.api.REGISTRATION_CONFLICT)
        with self.factory() as db:
            self.assertEqual(db.query(self.api.User).one().password_hash, original_hash)
            self.assertEqual(db.query(self.api.UserVerification).count(), 1)
        self.assertEqual(self.login('Synthetic-replacement-password').status_code, 401)
        self.assertEqual(self.login().status_code, 200)

    def test_kyc_integrity_failure_rolls_back_user_insert(self):
        # A real KYC constraint failure must also undo the already-flushed user.
        with self.factory() as db:
            db.add(self.api.User(user_id='seed', full_name='Seed', email='seed@example.com', password_hash='unused'))
            db.add(self.api.UserVerification(verification_id='KYC-COLLISION', user_id='seed'))
            db.commit()
        with patch.object(self.api.uuid, 'uuid4', return_value=Mock(hex='collision')):
            response = self.register()
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), dict(detail=self.api.REGISTRATION_FAILURE))
        with self.factory() as db:
            self.assertIsNone(db.query(self.api.User).filter_by(email=self.payload['email']).first())
            self.assertEqual(db.query(self.api.UserVerification).count(), 1)
        self.assertEqual(self.login().status_code, 401)

    def test_duplicate_race_is_identified_from_committed_email_after_rollback(self):
        self.assertEqual(self.register().status_code, 201)
        original_query = Session.query
        calls = []
        def query(db, *args, **kwargs):
            calls.append(1)
            if len(calls) == 1:
                result = Mock()
                result.filter.return_value.first.return_value = None
                return result
            return original_query(db, *args, **kwargs)
        with patch.object(Session, 'query', autospec=True, side_effect=query):
            response = self.register(password='Synthetic-replacement-password')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.login().status_code, 200)
        with self.factory() as db:
            self.assertEqual(db.query(self.api.User).count(), 1)
            self.assertEqual(db.query(self.api.UserVerification).count(), 1)

    def test_unexpected_commit_failure_rolls_back_flushed_records(self):
        original_rollback = Session.rollback
        def fail(db):
            db.flush()
            raise RuntimeError('synthetic-private-driver-detail')
        with patch.object(Session, 'commit', autospec=True, side_effect=fail), patch.object(Session, 'rollback', autospec=True, side_effect=original_rollback) as rollback:
            response = self.register()
        self.assertGreaterEqual(rollback.call_count, 1)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), dict(detail=self.api.REGISTRATION_FAILURE))
        self.assert_empty()

    def test_rollback_failure_keeps_public_error_safe(self):
        with patch.object(Session, 'commit', side_effect=RuntimeError('synthetic-secret')), patch.object(Session, 'rollback', side_effect=RuntimeError('synthetic-rollback-secret')):
            response = self.register()
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), dict(detail=self.api.REGISTRATION_FAILURE))
        self.assert_empty()

    def test_registration_rate_limit_still_applies(self):
        self.assertEqual(self.register().status_code, 201)
        for _ in range(4):
            self.assertEqual(self.register().status_code, 409)
        self.assertEqual(self.register().status_code, 429)


if __name__ == '__main__':
    if '--serve' in sys.argv:
        # Browser regression fixture: loopback only, same disposable database/guards.
        import uvicorn
        RegistrationTests.setUpClass()
        fixture = RegistrationTests('test_new_account_commits_user_and_kyc_and_logs_in')
        fixture.setUp()
        try:
            uvicorn.run(fixture.api.app, host='127.0.0.1', port=8011, access_log=False, log_level='error')
        finally:
            fixture.tearDown()
            RegistrationTests.tearDownClass()
    else:
        unittest.main()
