#!/usr/bin/env python3
"""Pull ZK attendance → alfa_biometric_punch (UTC + device_time).

El reloj entrega hora de pared CR. Odoo guarda check_time en UTC naive y
device_time con la hora del reloj. Un INSERT crudo con la pared en check_time
hace que el cuadro reste 6 h y muestre 00:48 en vez de 06:48.
"""
import os
from datetime import datetime, timedelta, timezone

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None

from zk import ZK
import psycopg2

DSN = os.environ["ODOO_BIOMETRIC_DATABASE_URL"]
DEVICES = [
    ("10.1.1.80", "Piso 01"),
    ("10.1.1.81", "Piso 02"),
    ("10.2.2.10", "Alajuela"),
]
_TZ_CR = ZoneInfo("America/Costa_Rica") if ZoneInfo else None
cutoff = datetime.now() - timedelta(days=7)


def wall_and_utc(ts):
    """ZK timestamp → (device_time str, check_time UTC naive)."""
    wall = ts.replace(tzinfo=None) if getattr(ts, "tzinfo", None) else ts
    device_time = wall.strftime("%Y-%m-%d %H:%M:%S")
    if _TZ_CR is not None:
        utc = (
            wall.replace(tzinfo=_TZ_CR)
            .astimezone(timezone.utc)
            .replace(tzinfo=None)
        )
    else:
        utc = wall + timedelta(hours=6)
    return device_time, utc


conn = psycopg2.connect(DSN)
conn.autocommit = False
cur = conn.cursor()

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
            device_time, check_time = wall_and_utc(a.timestamp)
            cur.execute(
                """
                INSERT INTO alfa_biometric_punch (
                  att_user_id, badge, person_name, device_time, check_time,
                  check_type, sensor_id, device_id, source,
                  create_date, write_date
                ) VALUES (
                  %s, %s, NULL, %s, %s,
                  %s, NULL, %s, 'device',
                  (NOW() AT TIME ZONE 'UTC'), (NOW() AT TIME ZONE 'UTC')
                )
                ON CONFLICT (att_user_id, check_time, source) DO NOTHING
                """,
                (
                    uid,
                    badge,
                    device_time,
                    check_time,
                    str(getattr(a, "punch", "")),
                    did,
                ),
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
