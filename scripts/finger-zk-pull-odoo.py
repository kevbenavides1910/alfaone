import os
from datetime import datetime, timedelta
from zk import ZK
import psycopg2

DSN = os.environ["ODOO_BIOMETRIC_DATABASE_URL"]
DEVICES = [
    ("10.1.1.80", "Piso 01"),
    ("10.1.1.81", "Piso 02"),
    ("10.2.2.10", "Alajuela"),
]
cutoff = datetime.now() - timedelta(days=2)
conn = psycopg2.connect(DSN)
conn.autocommit = False
cur = conn.cursor()

# map ip -> device id
cur.execute("SELECT id, ip FROM alfa_biometric_device")
dev_by_ip = {r[1]: r[0] for r in cur.fetchall()}

inserted = 0
skipped = 0
for ip, name in DEVICES:
    print("===", name, ip, flush=True)
    zk = ZK(ip, port=4370, timeout=20, force_udp=False, ommit_ping=True)
    try:
        zc = zk.connect()
        att = zc.get_attendance() or []
        recent = [a for a in att if a.timestamp and a.timestamp >= cutoff]
        print("recent", len(recent), flush=True)
        did = dev_by_ip.get(ip)
        for a in recent:
            badge = str(a.user_id)
            try:
                uid = int(badge)
            except Exception:
                continue
            cur.execute(
                """
                INSERT INTO alfa_biometric_punch (
                  att_user_id, badge, person_name, check_time, check_type,
                  sensor_id, device_id, source, create_date, write_date
                ) VALUES (
                  %s, %s, NULL, %s, %s,
                  NULL, %s, 'device', (NOW() AT TIME ZONE 'UTC'), (NOW() AT TIME ZONE 'UTC')
                )
                ON CONFLICT (att_user_id, check_time, source) DO NOTHING
                """,
                (uid, badge, a.timestamp, str(getattr(a, "punch", "")), did),
            )
            if cur.rowcount:
                inserted += 1
            else:
                skipped += 1
        zc.disconnect()
        conn.commit()
    except Exception as e:
        conn.rollback()
        print("ERR", e, flush=True)

print("DONE inserted", inserted, "skipped", skipped, flush=True)
cur.close()
conn.close()
