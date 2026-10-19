#!/bin/sh
set -eu
set -o pipefail

: "${RESTIC_REPOSITORY:?Set RESTIC_REPOSITORY to a remote encrypted repository.}"
: "${RESTIC_PASSWORD:?Set RESTIC_PASSWORD from the host secret manager.}"

backup_host=${CRITS_BACKUP_HOST:-crits-production}

case "${1:-backup}" in
  init)
    exec restic init
    ;;
  list-database)
    exec restic snapshots --tag database
    ;;
  list-media)
    exec restic snapshots --tag media
    ;;
  check)
    exec restic check --read-data-subset=5%
    ;;
  backup)
    : "${DATABASE_URL:?Set DATABASE_URL to the production PostgreSQL URL.}"
    if [ ! -d /media ]; then
      echo "The persistent media volume is not mounted at /media." >&2
      exit 1
    fi
    ;;
  *)
    echo "Usage: crits-backup [init|backup|list-database|list-media|check]" >&2
    exit 2
    ;;
esac

echo "Backing up the CRITS PostgreSQL database to the encrypted repository."
pg_dump --no-owner --format=custom "$DATABASE_URL" \
  | restic backup --stdin --stdin-filename crits-database.dump --tag database --host "$backup_host"

echo "Backing up product and property media."
restic backup /media --tag media --host "$backup_host"

echo "Applying backup retention: 14 daily, 8 weekly, and 12 monthly snapshots."
restic forget --host "$backup_host" --tag database --keep-daily 14 --keep-weekly 8 --keep-monthly 12
restic forget --host "$backup_host" --tag media --keep-daily 14 --keep-weekly 8 --keep-monthly 12
restic prune
restic check

echo "Encrypted CRITS database and media backups completed."
