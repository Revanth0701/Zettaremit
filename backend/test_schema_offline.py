import unittest
from unittest.mock import Mock, MagicMock, patch
import check_cloud_schema as checker

class SchemaSourceTests(unittest.TestCase):
    def test_decimal_and_composite_uniqueness_extracted_without_import(self):
        expected, notes = checker.expected_schema()
        amount = expected['transactions']['gross_amount']
        self.assertEqual((amount['kind'], amount['precision'], amount['scale']), ('decimal',18,2))
        groups = [group for column in expected['transactions'].values() for group in column.get('table_unique', [])]
        self.assertIn(('sender_id','idempotency_key'), groups)
        self.assertEqual(set(expected),set(checker.TABLES))
    def test_metadata_queries_are_read_only(self):
        connection=Mock();connection.execute.return_value.mappings.return_value=[]
        checker.read_metadata(connection)
        self.assertEqual(connection.execute.call_count,6)
        for query in checker.QUERIES.values():
            self.assertTrue(query.startswith('SELECT '));self.assertIn('information_schema.',query)

    def test_audit_uses_only_metadata_selects_and_rolls_back(self):
        engine = MagicMock()
        connection = engine.connect.return_value.__enter__.return_value
        connection.execute.return_value.mappings.return_value = []
        with patch.object(checker, 'load_cloud_config'), patch.object(checker, 'create_database_engine', return_value=engine), patch('builtins.print'):
            self.assertEqual(checker.main(), 1)
        connection.exec_driver_sql.assert_not_called()
        self.assertEqual(connection.execute.call_count, len(checker.QUERIES))
        connection.rollback.assert_called_once()
        engine.dispose.assert_called_once()

    def test_missing_legacy_table_is_optional_but_runtime_tables_are_required(self):
        expected, _ = checker.expected_schema()
        actual = {key: [] for key in checker.QUERIES}
        findings = checker.compare(expected, actual)
        self.assertEqual({row[1] for row in findings if row[0] == 'CRITICAL'},
                         {'users', 'user_verifications', 'transactions'})
        self.assertTrue(any(row[0] == 'INFO' and row[1] == 'service_transactions' for row in findings))

if __name__=='__main__':unittest.main()
