"""Explicit cloud-only, read-only connection test; never imports the API."""
import sys
from pymysql.err import MySQLError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.pool import NullPool
from database_config import (ConfigurationError, load_cloud_config,
                             create_database_engine, safe_error_summary)

TABLES = ("users", "user_verifications", "transactions", "service_transactions")


def main():
    try:
        config = load_cloud_config()
    except ConfigurationError as error:
        print(str(error))
        return 1
    engine = None
    stage = "opening connection"
    try:
        engine = create_database_engine(config, poolclass=NullPool)
        with engine.connect() as connection:
            try:
                stage = "starting read-only transaction"
                connection.exec_driver_sql("START TRANSACTION READ ONLY")
                stage = "reading database metadata"
                database = connection.exec_driver_sql("SELECT DATABASE()").scalar_one()
                version = connection.exec_driver_sql("SELECT VERSION()").scalar_one()
                counts = {}
                for table in TABLES:
                    # Identifiers come only from the fixed allowlist above.
                    stage = "counting rows in " + table
                    counts[table] = connection.exec_driver_sql(
                        f"SELECT COUNT(*) FROM `{table}`"
                    ).scalar_one()
            finally:
                connection.rollback()
        print("Connected with CA certificate and hostname verification enabled.")
        print(f"Database: {database}")
        print(f"MySQL version: {version}")
        for table, count in counts.items():
            print(f"{table}: {count} rows")
        return 0
    except (ConfigurationError, SQLAlchemyError, MySQLError, OSError, ValueError) as error:
        # Never render the exception, its arguments, SQL, or connection parameters.
        print("Connection test failed: " + safe_error_summary(error))
        print("Stage: " + stage)
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    sys.exit(main())
