#!/usr/bin/env python3
"""
Migration Helper Script: SQLite to PostgreSQL for SprintPulse.

Usage:
  1. Dump data from SQLite:
     python3 migrate_to_postgres.py --dump

  2. Load dumped data into PostgreSQL (Make sure PostgreSQL is running & database created):
     python3 migrate_to_postgres.py --load --db-url "postgres://username:password@localhost:5432/sprintpulse"
"""

import sys
import os
import subprocess
import argparse

def dump_data():
    print("📦 Dumping SQLite database contents to datadump.json...")
    cmd = [
        sys.executable, "manage.py", "dumpdata",
        "--natural-foreign", "--natural-primary",
        "-e", "contenttypes",
        "-e", "auth.Permission",
        "--indent", "2",
        "-o", "datadump.json"
    ]
    env = os.environ.copy()
    env["DB_ENGINE"] = "sqlite"
    res = subprocess.run(cmd, env=env)
    if res.returncode == 0:
        print("✅ Data successfully exported to datadump.json")
    else:
        print("❌ Failed to dump SQLite data.")
        sys.exit(res.returncode)

def load_data(db_url=None):
    if not os.path.exists("datadump.json"):
        print("⚠️ datadump.json not found. Dumping SQLite data first...")
        dump_data()

    print("🚀 Applying migrations on PostgreSQL database...")
    env = os.environ.copy()
    env["DB_ENGINE"] = "postgres"
    if db_url:
        env["DATABASE_URL"] = db_url

    res_migrate = subprocess.run([sys.executable, "manage.py", "migrate"], env=env)
    if res_migrate.returncode != 0:
        print("❌ PostgreSQL migration failed. Check database connection parameters.")
        sys.exit(res_migrate.returncode)

    print("📥 Loading datadump.json into PostgreSQL...")
    res_load = subprocess.run([sys.executable, "manage.py", "loaddata", "datadump.json"], env=env)
    if res_load.returncode == 0:
        print("🎉 Data successfully migrated to PostgreSQL!")
    else:
        print("❌ Failed to load data into PostgreSQL.")
        sys.exit(res_load.returncode)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate SprintPulse from SQLite to PostgreSQL")
    parser.add_argument("--dump", action="store_true", help="Dump SQLite data to JSON")
    parser.add_argument("--load", action="store_true", help="Migrate schema and load data into PostgreSQL")
    parser.add_argument("--db-url", type=str, help="PostgreSQL connection string (e.g., postgres://user:pass@localhost:5432/dbname)")

    args = parser.parse_args()

    if args.dump:
        dump_data()
    elif args.load:
        load_data(args.db_url)
    else:
        # Default behavior: dump and show next steps
        dump_data()
        print("\nNext step: To load into PostgreSQL, ensure your PostgreSQL service is running and run:")
        print("  python3 migrate_to_postgres.py --load --db-url 'postgres://postgres:password@localhost:5432/sprintpulse'\n")
