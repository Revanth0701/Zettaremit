from datetime import date
import pandas as pd
from database_config import load_database_config, create_database_engine, safe_error_summary

def run_etl():
    print("🚀 Starting ETL Pipeline...")

    engine = None
    try:
        config = load_database_config()
        engine = create_database_engine(config)
    except Exception as error:
        print("Database configuration failed: " + safe_error_summary(error))
        return

    query = "SELECT created_at, gross_amount, net_amount, source_currency, target_currency FROM transactions"
    try:
        df = pd.read_sql(query, engine)
        print(f"✅ Successfully extracted {len(df)} transactions.")
    except Exception as e:
        print("Extraction failed: " + safe_error_summary(e))
        return
    finally:
        if engine is not None:
            engine.dispose()

# ==========================================
    # Phase 2: TRANSFORM
    # ==========================================
    print("⚙️ Transforming and aggregating data...")
    
    # Standardize timestamp to date
    if 'created_at' in df.columns:
        df['date'] = pd.to_datetime(df['created_at']).dt.date
    else:
        df['date'] = date.today()

    # Aggregate volumes across actual database columns
    summary_df = (
        df.groupby(['date', 'source_currency', 'target_currency'])[['gross_amount', 'net_amount']]
        .sum()
        .reset_index()
    )
    
    # Format column names for the final analytics CSV
    summary_df.rename(columns={
        'gross_amount': 'gross_volume_source',
        'net_amount': 'net_volume_source'
    }, inplace=True)
    
    print("✅ Transformation complete.")

    # ==========================================
    # Phase 3: LOAD
    # ==========================================
    output_file = ("daily_remittance_summary.cloud.csv" if config.mode == "cloud"
                   else "daily_remittance_summary.csv")
    print(f"📤 Exporting daily summary report to: {output_file}...")
    summary_df.to_csv(output_file, index=False)
    
    print(f"🎉 ETL Complete! Report generated successfully.")
    print("\n--- Daily Remittance Summary Preview ---")
    print("Report includes simulated and legacy records grouped by currency; no customer rows logged.")

if __name__ == "__main__":
    run_etl()