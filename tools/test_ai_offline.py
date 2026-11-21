"""Run AI/backend regression suites with synthetic configuration and no paid key.

The developer's enabled backend/.env is never changed. Use this entry point for
offline tests while the local app is configured for hosted Gemini embeddings.
"""
from datetime import datetime, timezone
from decimal import Decimal
import importlib
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]


def main():
    os.chdir(ROOT)
    sys.path.insert(0, str(ROOT / 'backend'))
    sys.path.insert(0, str(ROOT))
    configuration = {
        'APP_ENV': 'test', 'DATABASE_MODE': 'local', 'DATABASE_URL': 'sqlite://',
        'LOCAL_CREATE_TABLES': 'false', 'ENABLE_AI_ASSISTANT': 'false',
        'ENABLE_AI_AGENT': 'false', 'RAG_EMBEDDING_PROVIDER': 'none',
        'RAG_EMBEDDING_MODEL': 'gemini-embedding-001',
        'JWT_SECRET_KEY': 'synthetic-offline-test-key-at-least-32-bytes',
        'GEMINI_API_KEY': 'synthetic-offline-key',
    }
    with patch.dict(os.environ, configuration):
        suite = unittest.defaultTestLoader.discover('backend', pattern='test_*offline.py')
        result = unittest.TextTestRunner(verbosity=1).run(suite)
        from exchange_rates import RateSnapshot
        now = datetime.now(timezone.utc)
        provider = Mock()
        provider.get_rate.return_value = RateSnapshot(Decimal('80'), now, now, now, now)
        api = importlib.import_module('main')
        with patch('exchange_rates.get_exchange_rate_provider', return_value=provider), \
             patch.object(api, '_get_shared_rate_provider', return_value=provider):
            extra = unittest.defaultTestLoader.loadTestsFromNames(['test_ai_rate_integration', 'test_sec_fixes'])
            result2 = unittest.TextTestRunner(verbosity=1).run(extra)
        return int(not (result.wasSuccessful() and result2.wasSuccessful()))


if __name__ == '__main__':
    raise SystemExit(main())
