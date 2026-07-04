#!/usr/bin/env python3
"""Envía correo de alerta/reporte de salud vía SMTP (sin dependencias externas)."""
from __future__ import annotations

import os
import smtplib
import socket
import ssl
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path


def load_env_file(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    if not path.is_file():
        return data
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        data[key.strip()] = val.strip().strip('"').strip("'")
    return data


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, "").strip() or default


TLS_SERVERNAME_BY_HOST = {
    "webmail.seguridadalfa.com": "mail.seguridadalfa.com",
    "seguridadalfa.com": "mail.seguridadalfa.com",
}


def tls_servername_for(host: str) -> str | None:
    return TLS_SERVERNAME_BY_HOST.get(host.strip().lower())


def main() -> int:
    if len(sys.argv) < 3:
        print("Uso: send-health-alert-email.py <asunto> <cuerpo-texto> [cuerpo-html]", file=sys.stderr)
        return 2

    subject = sys.argv[1]
    body_text = sys.argv[2]
    body_html = sys.argv[3] if len(sys.argv) > 3 else ""

    config_paths = [
        Path(env("HEALTH_ALERT_ENV")),
        Path("/etc/alfa-one/health-alert.env"),
        Path(__file__).resolve().parent.parent / "config" / "health-alert.env",
    ]
    cfg: dict[str, str] = {}
    for p in config_paths:
        if p and str(p) != ".":
            cfg.update(load_env_file(p))

    def get(key: str, default: str = "") -> str:
        return env(key, cfg.get(key, default))

    to_raw = get("HEALTH_ALERT_TO")
    if not to_raw:
        print("HEALTH_ALERT_TO no configurado; omitiendo correo.", file=sys.stderr)
        return 0

    smtp_host = get("SMTP_HOST")
    smtp_user = get("SMTP_USER")
    smtp_pass = get("SMTP_PASS")
    smtp_from = get("HEALTH_ALERT_FROM") or smtp_user
    if not smtp_host or not smtp_from:
        print("SMTP_HOST y HEALTH_ALERT_FROM requeridos.", file=sys.stderr)
        return 1

    smtp_port = int(get("SMTP_PORT", "587") or "587")
    use_tls = get("SMTP_TLS", "1").lower() in ("1", "true", "yes")

    recipients = [a.strip() for a in to_raw.replace(";", ",").split(",") if a.strip()]

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = smtp_from
    msg["To"] = ", ".join(recipients)
    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    if body_html:
        msg.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        _orig_getaddrinfo = socket.getaddrinfo

        def _ipv4_getaddrinfo(host, port, family=0, st=0, proto=0, flags=0):
            return _orig_getaddrinfo(host, port, socket.AF_INET, st, proto, flags)

        socket.getaddrinfo = _ipv4_getaddrinfo
        tls_name = tls_servername_for(smtp_host)
        try:
            server = smtplib.SMTP(timeout=30)
            server.connect(smtp_host, smtp_port)
            server.ehlo()
            if use_tls:
                ctx = ssl.create_default_context()
                server.sock = ctx.wrap_socket(
                    server.sock,
                    server_hostname=tls_name or smtp_host,
                )
                server.file = None
                server.ehlo_resp = None
                server.helo_resp = None
                server.ehlo()
            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, recipients, msg.as_string())
            server.quit()
        finally:
            socket.getaddrinfo = _orig_getaddrinfo
    except Exception as e:
        print(f"Error SMTP: {e}", file=sys.stderr)
        return 1

    print(f"OK enviado a {', '.join(recipients)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
