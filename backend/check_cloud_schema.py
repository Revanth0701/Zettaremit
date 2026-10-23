"""Cloud-only schema audit. Reads source and information_schema; never imports main."""
import ast
from pathlib import Path
import re
import sys

from sqlalchemy import text
from sqlalchemy.pool import NullPool
from database_config import load_cloud_config, create_database_engine, safe_error_summary

TABLES = ('users', 'user_verifications', 'transactions', 'service_transactions')
ROOT = Path(__file__).resolve().parent.parent


def literal(node, fallback=None):
    try:
        return ast.literal_eval(node)
    except (ValueError, TypeError):
        return fallback


def python_expectations(source):
    result, notes = {}, []
    for cls in ast.parse(source).body:
        if not isinstance(cls, ast.ClassDef):
            continue
        assignments = {n.targets[0].id: n.value for n in cls.body
                       if isinstance(n, ast.Assign) and len(n.targets) == 1
                       and isinstance(n.targets[0], ast.Name)}
        table = literal(assignments.get('__tablename__'))
        if table not in TABLES:
            continue
        columns = {}
        for name, value in assignments.items():
            if not isinstance(value, ast.Call) or not isinstance(value.func, ast.Name) or value.func.id != 'Column':
                continue
            kwargs = {k.arg: literal(k.value) for k in value.keywords}
            args = list(value.args)
            if args and isinstance(args[0], ast.Constant) and isinstance(args[0].value, str):
                name = args.pop(0).value
            kind = args.pop(0) if args else None
            # Resolve the portable base type without importing application modules.
            if isinstance(kind, ast.Call) and isinstance(kind.func, ast.Attribute) and kind.func.attr == 'with_variant':
                kind = kind.func.value
            type_name = kind.id if isinstance(kind, ast.Name) else kind.func.id if isinstance(kind, ast.Call) and isinstance(kind.func, ast.Name) else None
            family = {'String': 'varchar', 'Float': 'float', 'DateTime': 'datetime', 'Boolean': 'boolean', 'Numeric': 'decimal'}.get(type_name)
            length = literal(kind.args[0]) if type_name == 'String' and isinstance(kind, ast.Call) and kind.args else None
            pk = kwargs.get('primary_key', False)
            column = dict(kind=family, length=length, nullable=kwargs.get('nullable', not pk),
                          pk=pk, unique=kwargs.get('unique', False), index=kwargs.get('index', False), identity=False, fk=None)
            for arg in args:
                if isinstance(arg, ast.Call) and isinstance(arg.func, ast.Name) and arg.func.id == 'ForeignKey':
                    target = literal(arg.args[0]) if arg.args else None
                    options = {k.arg: literal(k.value) for k in arg.keywords}
                    if isinstance(target, str) and target.count('.') == 1:
                        column['fk'] = (*target.split('.'), options.get('ondelete', 'RESTRICT'))
                    else:
                        notes.append(('UNVERIFIED', table, name, 'foreign key target cannot be resolved'))
            if not family:
                notes.append(('UNVERIFIED', table, name, 'unsupported SQLAlchemy type'))
            if any(k.arg not in {'primary_key','nullable','unique','index','default'} for k in value.keywords):
                notes.append(('UNVERIFIED', table, name, 'additional Column options need review'))
            if type_name == 'Numeric' and isinstance(kind, ast.Call) and len(kind.args) >= 2:
                column['precision'] = literal(kind.args[0])
                column['scale'] = literal(kind.args[1])
            columns[name] = column
        if '__table_args__' in assignments:
            table_args = assignments['__table_args__']
            if isinstance(table_args, ast.Tuple):
                for constraint in table_args.elts:
                    if isinstance(constraint, ast.Call) and isinstance(constraint.func, ast.Name) and constraint.func.id == 'UniqueConstraint':
                        names = tuple(literal(arg) for arg in constraint.args)
                        if names and all(name in columns for name in names):
                            columns[names[0]].setdefault('table_unique', []).append(names)
                        else:
                            notes.append(('UNVERIFIED',table,'','composite unique constraint could not be resolved'))
                    else:
                        notes.append(('UNVERIFIED',table,'','unsupported table constraint'))
            else:
                notes.append(('UNVERIFIED',table,'','unsupported table options'))
        result[table] = columns
    return result, notes


def java_expectations(source):
    # Deliberately support only the simple annotated fields in this project's entity.
    source = re.sub(r'/\*.*?\*/|//[^\n]*', '', source, flags=re.S)
    table_match = re.search(r'@Table\s*\(\s*name\s*=\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*\)', source)
    if not table_match or table_match[1] != 'service_transactions':
        return {}, [('UNVERIFIED','service_transactions','','table annotation not resolved')]
    columns, notes = {}, []
    fields = re.findall(r'((?:\s*@\w+(?:\([^)]*\))?\s*)+)private\s+(\w+)\s+(\w+)\s*(?:=[^;]*)?;', source)
    for annotations, java_type, field in fields:
        named = re.search(r'\bname\s*=\s*"([A-Za-z_][A-Za-z0-9_]*)"', annotations)
        pk = bool(re.search(r'@Id\b', annotations))
        if not named and not pk:
            notes.append(('UNVERIFIED','service_transactions','','implicit Java column naming requires review'))
            continue
        name = named[1] if named else field
        kind = {'Long':'bigint','String':'varchar','Double':'double','LocalDateTime':'datetime'}.get(java_type)
        size = re.search(r'\blength\s*=\s*(\d+)', annotations)
        nullable = not pk and not bool(re.search(r'nullable\s*=\s*false', annotations))
        columns[name] = dict(kind=kind, length=int(size[1]) if size else 255 if kind == 'varchar' else None,
                             nullable=nullable, pk=pk, unique=bool(re.search(r'unique\s*=\s*true', annotations)),
                             index=False, identity='GenerationType.IDENTITY' in annotations, fk=None)
        if not kind or any(token in annotations for token in ('columnDefinition','@JoinColumn','@Convert')):
            notes.append(('UNVERIFIED','service_transactions',name,'Java mapping requires provider-specific review'))
    if any(token in source for token in ('@Index','@UniqueConstraint','@ManyToOne','@OneToOne','@Embedded')):
        notes.append(('UNVERIFIED','service_transactions','','additional JPA constraints or associations need review'))
    notes.append(('UNVERIFIED','service_transactions','','Hibernate dialect-dependent timestamp precision and exact floating-point DDL'))
    return {'service_transactions':columns}, notes


def expected_schema():
    py, notes = python_expectations((ROOT/'backend/main.py').read_text(encoding='utf-8-sig'))
    java, more = java_expectations((ROOT/'services/transaction-service/src/main/java/com/zettaremit/transaction/model/Transaction.java').read_text(encoding='utf-8-sig'))
    py.update(java)
    return py, notes + more


QUERIES = {
    'tables': 'SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()',
    'columns': 'SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()',
    'constraints': 'SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE()',
    'keys': 'SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, ORDINAL_POSITION, REFERENCED_TABLE_SCHEMA = DATABASE() AS TARGET_IS_CURRENT, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE CONSTRAINT_SCHEMA = DATABASE() ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION',
    'foreign': 'SELECT TABLE_NAME, CONSTRAINT_NAME, DELETE_RULE, UPDATE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE()',
    'indexes': 'SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, SUB_PART, IS_VISIBLE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX',
}


def read_metadata(connection):
    # Every statement here is a SELECT; no model imports, reflection DDL, or user rows.
    return {key: [dict(row) for row in connection.execute(text(query)).mappings()]
            for key, query in QUERIES.items()}


def compare(expected, actual):
    findings = []
    def report(level, table, column, message):
        findings.append((level, table, column, message))
    for table in TABLES:
        if not expected.get(table):
            report('UNVERIFIED',table,'','model could not be resolved from source')
            continue
        table_rows = [r for r in actual['tables'] if r['TABLE_NAME'] == table]
        if not table_rows:
            report('CRITICAL',table,'','table missing or not visible to this account')
            continue
        if table_rows[0]['TABLE_TYPE'] != 'BASE TABLE':
            report('CRITICAL',table,'','expected a base table')
        cols = {r['COLUMN_NAME']:r for r in actual['columns'] if r['TABLE_NAME']==table}
        keys = [r for r in actual['keys'] if r['TABLE_NAME']==table]
        constraints = {r['CONSTRAINT_NAME']:r['CONSTRAINT_TYPE'] for r in actual['constraints'] if r['TABLE_NAME']==table}
        groups = {}
        for row in keys:
            groups.setdefault(row['CONSTRAINT_NAME'],[]).append(row)
        primary = [tuple(r['COLUMN_NAME'] for r in rows) for name,rows in groups.items() if constraints.get(name)=='PRIMARY KEY']
        wanted_pk = tuple(n for n,c in expected[table].items() if c['pk'])
        if primary != [wanted_pk]:
            report('CRITICAL',table,'','primary key differs from model')
        unique = {tuple(r['COLUMN_NAME'] for r in rows) for name,rows in groups.items() if constraints.get(name) in ('UNIQUE','PRIMARY KEY')}
        indexes = {}
        for row in actual['indexes']:
            if row['TABLE_NAME']==table:
                indexes.setdefault(row['INDEX_NAME'],[]).append(row)
        for name, column in expected[table].items():
            if name not in cols:
                report('CRITICAL',table,name,'column missing')
                continue
            row = cols[name]
            kind = row['DATA_TYPE'].lower()
            wanted = column['kind']
            if wanted == 'boolean':
                if kind not in ('tinyint','bit','boolean','bool'):
                    report('CRITICAL',table,name,'incompatible boolean storage type')
                elif kind == 'tinyint' and row['COLUMN_TYPE'].lower() not in ('tinyint(1)', 'tinyint(1) unsigned'):
                    report('UNVERIFIED',table,name,'boolean integer width differs from usual mapping')
                elif kind == 'bit':
                    report('UNVERIFIED',table,name,'BIT boolean driver conversion needs validation')
            elif wanted and kind != wanted:
                if wanted == 'float' and kind == 'double':
                    report('MINOR',table,name,'floating-point storage has wider precision')
                else:
                    report('CRITICAL',table,name,'data type differs from model')
            if wanted == 'decimal' and column.get('precision') is not None:
                precision, scale = row.get('NUMERIC_PRECISION'), row.get('NUMERIC_SCALE')
                if precision is None or scale is None:
                    report('UNVERIFIED',table,name,'decimal precision metadata unavailable')
                elif scale < column['scale'] or precision-scale < column['precision']-column['scale']:
                    report('CRITICAL',table,name,'decimal capacity is smaller than model')
                elif (precision,scale) != (column['precision'],column['scale']):
                    report('MINOR',table,name,'decimal precision exceeds model')
            if column['length'] is not None:
                length = row['CHARACTER_MAXIMUM_LENGTH']
                if length is None or length < column['length']:
                    report('CRITICAL',table,name,'string capacity is smaller than model')
                elif length > column['length']:
                    report('MINOR',table,name,'string capacity exceeds model')
            nullable = row['IS_NULLABLE']=='YES'
            if nullable != column['nullable']:
                report('MINOR' if nullable else 'CRITICAL',table,name,'nullability differs from model')
            if column['identity'] and 'auto_increment' not in row['EXTRA'].lower():
                report('CRITICAL',table,name,'required auto-increment identity missing')
            if 'unsigned' in row['COLUMN_TYPE'].lower():
                report('UNVERIFIED',table,name,'unsigned range differs from implicit signed model type')
            if column['unique'] and (name,) not in unique:
                report('CRITICAL',table,name,'single-column uniqueness missing')
            if column['index'] and not any(rows[0]['COLUMN_NAME']==name and rows[0]['SUB_PART'] is None and rows[0]['IS_VISIBLE']=='YES' for rows in indexes.values()):
                report('MINOR',table,name,'usable full-column leading index missing')
            if column['fk']:
                target_table,target_column,delete = column['fk']
                matches = [rows for key,rows in groups.items() if constraints.get(key)=='FOREIGN KEY' and len(rows)==1 and rows[0]['COLUMN_NAME']==name and rows[0]['REFERENCED_TABLE_NAME']==target_table and rows[0]['REFERENCED_COLUMN_NAME']==target_column]
                if not matches:
                    report('CRITICAL',table,name,'expected foreign key missing or incompatible')
                else:
                    key=matches[0][0]
                    rule=next((r for r in actual['foreign'] if r['TABLE_NAME']==table and r['CONSTRAINT_NAME']==key['CONSTRAINT_NAME']),None)
                    if not rule:
                        report('UNVERIFIED',table,name,'foreign-key actions unavailable')
                    elif rule['DELETE_RULE'] not in ({'RESTRICT','NO ACTION'} if delete=='RESTRICT' else {delete}):
                        report('CRITICAL',table,name,'foreign-key delete action differs')
                    if rule and rule['UPDATE_RULE'] not in ('RESTRICT','NO ACTION'):
                        report('CRITICAL',table,name,'unexpected cascading update action')
                    if not key['TARGET_IS_CURRENT']:
                        report('CRITICAL',table,name,'foreign key references another database')
        for name,row in cols.items():
            if name not in expected[table]:
                required = row['IS_NULLABLE']=='NO' and row['COLUMN_DEFAULT'] is None and not any(x in row['EXTRA'].lower() for x in ('auto_increment','generated'))
                report('CRITICAL' if required else 'MINOR',table,'','extra required column blocks inserts' if required else 'additional optional column')
        expected_unique = {(n,) for n,c in expected[table].items() if c['unique']} | {wanted_pk}
        for column in expected[table].values():
            for group in column.get('table_unique', []):
                expected_unique.add(tuple(group))
                if tuple(group) not in unique:
                    report('CRITICAL',table,'','composite uniqueness missing; idempotency is not guaranteed')
        if unique - expected_unique:
            report('CRITICAL',table,'','additional uniqueness may reject application inserts')
        for name,rows in groups.items():
            if constraints.get(name)=='FOREIGN KEY' and not any(c['fk'] and len(rows)==1 and rows[0]['COLUMN_NAME']==n for n,c in expected[table].items()):
                report('CRITICAL',table,'','unexpected foreign key may restrict writes')
        if any(kind=='CHECK' for kind in constraints.values()):
            report('UNVERIFIED',table,'','additional CHECK constraints require review')
        expected_indexes = {(n,) for n,c in expected[table].items() if c['index'] or c['unique']} | {wanted_pk}
        expected_indexes |= expected_unique
        if any(tuple(r['COLUMN_NAME'] for r in rows) not in expected_indexes for rows in indexes.values()):
            report('MINOR',table,'','additional indexes exist; names are not compared')
    return findings


def main():
    engine = None
    try:
        expected, notes = expected_schema()
        config = load_cloud_config()
        engine = create_database_engine(config, poolclass=NullPool)
        with engine.connect() as connection:
            try:
                connection.exec_driver_sql('START TRANSACTION READ ONLY')
                actual = read_metadata(connection)
            finally:
                connection.rollback()
        findings = notes + compare(expected,actual)
        for level,table,column,message in findings:
            # Identifiers originate only in project source, never server error text.
            print(f'{level}: {table}' + (f'.{column}' if column else '') + ': ' + message)
        counts = {level:sum(item[0]==level for item in findings) for level in ('CRITICAL','MINOR','UNVERIFIED')}
        print('Summary: ' + ', '.join(f'{count} {level.lower()}' for level,count in counts.items()))
        print('Metadata-only audit; review decimal precision, composite uniqueness, defaults, collations, triggers and provider DDL separately. This is not a release approval.')
        return 1 if counts['CRITICAL'] else 2 if counts['UNVERIFIED'] else 0
    except Exception as error:
        print('Schema check could not complete: ' + safe_error_summary(error))
        return 3
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == '__main__':
    sys.exit(main())