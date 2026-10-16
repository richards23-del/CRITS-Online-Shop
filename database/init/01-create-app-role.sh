#!/bin/sh
set -eu

psql --username "$POSTGRES_USER" --dbname postgres --set=ON_ERROR_STOP=1 --set=app_password="$CRITS_DB_APP_PASSWORD" <<'SQL'
CREATE ROLE crits_app LOGIN PASSWORD :'app_password';
CREATE DATABASE crits_db OWNER crits_app;
SQL

psql --username "$POSTGRES_USER" --dbname crits_db --set=ON_ERROR_STOP=1 <<'SQL'
ALTER SCHEMA public OWNER TO crits_app;
SQL
