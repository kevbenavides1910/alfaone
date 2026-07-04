#!/usr/bin/env bash
# Instala cron de réplica expdp Oracle→Ubuntu en 10.1.1.6 (ejecutar como oracle)
set -euo pipefail

CRON_FILE=/tmp/oracle_rsync_cron

cat > "$CRON_FILE" <<'EOF'
# Réplica expdp Codisa → Ubuntu 10.1.1.229 (tras export ~21:30 CR)
0 5 * * * EXPDP_RETENTION_DAYS=7 /home/oracle/rms/rsync_oracle_to_ubuntu.sh
EOF

crontab "$CRON_FILE"
rm -f "$CRON_FILE"
echo "Crontab oracle:"
crontab -l
