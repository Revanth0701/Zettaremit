import unittest
from unittest.mock import Mock
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

if __name__=='__main__':unittest.main()
