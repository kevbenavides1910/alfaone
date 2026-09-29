#!/usr/bin/env python3
"""
Script para n8n: Busca licitaciones de SEGURIDAD/VIGILANCIA en SICOP
- Visita el detalle de cada licitacion para extraer campos adicionales
- Envia resultados a Alfa One (/api/ventas/oportunidades/ingest)
- Imprime JSON para que n8n notifique via Telegram
"""
import urllib.request
import urllib.parse
import json
import sys
import re
import http.cookiejar
from datetime import datetime, timedelta

# === Config Alfa One ===
import os

ALFA_ONE_URL = os.environ.get(
    "ALFA_ONE_URL",
    "http://127.0.0.1:3000/api/ventas/oportunidades/ingest",
)
ALFA_ONE_SECRET = os.environ.get("ALFA_ONE_SECRET", "")

def make_opener():
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    return opener

def visit_base(opener):
    base_url = "https://www.sicop.go.cr/moduloOferta/search/EP_SEJ_COQ600.jsp?stateSearch=Y"
    req = urllib.request.Request(base_url)
    req.add_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
    try:
        opener.open(req, timeout=15).read()
    except Exception:
        pass

def search_sicop(opener, keyword, date_from, date_to, openbid_from, openbid_to):
    base_url = "https://www.sicop.go.cr/moduloOferta/search/EP_SEJ_COQ600.jsp?stateSearch=Y"
    url = (
        "https://www.sicop.go.cr/moduloOferta/search/EP_SEJ_COQ601.jsp"
        "?cartelTestYn=Y"
        "&cartelNm=" + urllib.parse.quote(keyword) +
        "&proceType=&cartelInstCd=&instNm="
        "&regDtFrom=" + urllib.parse.quote(date_from) +
        "&regDtTo=" + urllib.parse.quote(date_to) +
        "&openbidDtFrom=" + urllib.parse.quote(openbid_from) +
        "&openbidDtTo=" + urllib.parse.quote(openbid_to) +
        "&instCartelNo=&cartelNo=&stateSearch=Y&searchCartelStat="
    )
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
    req.add_header("Referer", base_url)
    req.add_header("Accept-Language", "es-CR,es;q=0.9")

    try:
        with opener.open(req, timeout=15) as response:
            html = response.read().decode("utf-8", errors="ignore")
    except Exception as e:
        sys.stderr.write("Error fetching " + keyword + ": " + str(e) + "\n")
        return []

    if len(html) < 2000:
        sys.stderr.write("Response too short (" + str(len(html)) + " bytes) for " + keyword + ".\n")
        return []

    tenders = []
    row_pattern = re.compile(
        r'<tr>\s*'
        r'<td\s+class="eptdl">(.*?)</td>\s*'
        r'<td\s+class="eptdl">(.*?)</td>\s*'
        r'<td\s+class="eptdc">(.*?)</td>\s*'
        r'<td\s+class="eptdc">(.*?)</td>\s*'
        r'<td\s+class="eptdc">(.*?)</td>\s*'
        r'</tr>',
        re.DOTALL | re.IGNORECASE
    )

    for match in row_pattern.finditer(html):
        cell1 = match.group(1)
        cell2 = match.group(2)
        cell3 = match.group(3)
        cell5 = match.group(5)

        num_match = re.search(r'<b>(.*?)</b>', cell1)
        number = num_match.group(1).strip() if num_match else ""

        inst_match = re.search(r'<br[^>]*>(.*?)$', cell1)
        institution = inst_match.group(1).strip() if inst_match else ""

        desc_match = re.search(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', cell2, re.DOTALL)
        description = ""
        enlace = ""
        if desc_match:
            href_raw = desc_match.group(1)
            description = desc_match.group(2).strip()
            description = description.replace('\xa0', ' ').replace('&nbsp;', ' ')
            description = re.sub(r'\s+', ' ', description).strip()
            cp = re.search(r"js_cartelSearch\('(\d+)','(\d+)'\)", href_raw)
            if cp:
                enlace = "https://www.sicop.go.cr/moduloOferta/search/EP_SEJ_COQ600.jsp?stateSearch=Y&cartelNoType=01&cartelNoNm=" + number

        kw = ["SEGURIDAD", "VIGILANCIA", "GUARD", "ALARMA", "MONITOREO"]
        desc_upper = description.upper()
        if not any(k in desc_upper for k in kw):
            continue

        pub_date = cell3.strip().replace('\xa0', ' ').replace('&nbsp;', ' ').strip()
        status = cell5.strip().replace('\xa0', ' ').replace('&nbsp;', ' ').strip()

        tenders.append({
            "description": description,
            "institution": institution,
            "number": number,
            "publication_date": pub_date,
            "status": status,
            "enlace": enlace,
            "cartel_no": cp.group(1) if cp else "",
            "cartel_seq": cp.group(2) if cp else "",
        })

    return tenders


def fetch_detail(opener, cartel_no, cartel_seq, referer_url):
    """Visita la pagina de detalle de la licitacion y extrae campos adicionales."""
    detail_url = "https://www.sicop.go.cr/moduloOferta/search/EP_SEJ_COQ603.jsp?cartelNo=" + cartel_no + "&cartelSeq=" + cartel_seq
    req = urllib.request.Request(detail_url)
    req.add_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
    req.add_header("Referer", referer_url)

    try:
        with opener.open(req, timeout=15) as response:
            html = response.read().decode("utf-8", errors="ignore")
    except Exception as e:
        sys.stderr.write("Error fetching detail for " + cartel_no + ": " + str(e) + "\n")
        return {}

    if len(html) < 2000:
        return {}

    detail = {}

    # Inicio de recepcion de ofertas
    m = re.search(r'Inicio de recepci[o\xf3]n de ofertas.*?<td[^>]*>(.*?)</td>', html, re.DOTALL | re.IGNORECASE)
    if m:
        val = re.sub(r'<[^>]+>', '', m.group(1)).replace('&nbsp;', ' ').strip()
        val = re.sub(r'\s+', ' ', val)
        if val:
            detail["inicioRecepcion"] = val

    # Cierre de recepcion de ofertas
    m = re.search(r'Cierre de recepci[o\xf3]n de ofertas.*?<td[^>]*>(.*?)</td>', html, re.DOTALL | re.IGNORECASE)
    if m:
        val = re.sub(r'<[^>]+>', '', m.group(1)).replace('&nbsp;', ' ').strip()
        val = re.sub(r'\s+', ' ', val)
        if val:
            detail["cierreRecepcion"] = val

    # Monto total estimado
    m = re.search(r'Monto total estimado.*?<td[^>]*>(.*?)</td>', html, re.DOTALL | re.IGNORECASE)
    if m:
        val = re.sub(r'<[^>]+>', '', m.group(1)).replace('&nbsp;', ' ').strip()
        val = re.sub(r'\s+', ' ', val)
        if val:
            detail["montoContratacion"] = val

    # Fecha/hora limite de recepcion de aclaracion
    m = re.search(r'Fecha/hora l[i\xed]mite de recepci[o\xf3]n de aclaraci[o\xf3]n.*?<td[^>]*>(.*?)</td>', html, re.DOTALL | re.IGNORECASE)
    if m:
        val = re.sub(r'<[^>]+>', '', m.group(1)).replace('&nbsp;', ' ').strip()
        # Only take the date part (first 16 chars: dd/mm/yyyy HH:MM)
        date_match = re.match(r'(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2})', val)
        if date_match:
            detail["fechaAclaracion"] = date_match.group(1)

    # Fecha/hora limite de recepcion de objeciones
    m = re.search(r'Fecha/hora l[i\xed]mite de recepci[o\xf3]n de objeciones.*?<td[^>]*>(.*?)</td>', html, re.DOTALL | re.IGNORECASE)
    if m:
        val = re.sub(r'<[^>]+>', '', m.group(1)).replace('&nbsp;', ' ').strip()
        date_match = re.match(r'(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2})', val)
        if date_match:
            detail["fechaObjeciones"] = date_match.group(1)

    return detail


def send_to_alfa_one(tenders):
    if not tenders:
        return {"sent": 0, "created": 0, "updated": 0, "skipped": 0, "error": None}

    licitaciones = []
    for t in tenders:
        pub_date_str = t.get("publication_date", "")
        try:
            parts = pub_date_str.split("/")
            if len(parts) == 3:
                # Format: dd/mm/yyyy HH:MM
                date_part = parts[2].split(" ")[0]
                time_part = parts[2].split(" ")[1] if " " in parts[2] else "00:00"
                pub_date = datetime(int(date_part), int(parts[1]), int(parts[0]),
                                    int(time_part.split(":")[0]), int(time_part.split(":")[1]))
                fecha_presentacion = (pub_date + timedelta(days=15)).strftime("%Y-%m-%dT%H:%M:%S")
            else:
                fecha_presentacion = (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%dT%H:%M:%S")
        except Exception:
            fecha_presentacion = (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%dT%H:%M:%S")

        item = {
            "licitacionNo": t["number"],
            "cliente": t["institution"],
            "descripcion": t["description"],
            "fechaPresentacion": fecha_presentacion,
            "enlace": t.get("enlace", ""),
        }

        # Add detail fields if available
        detail = t.get("detail", {})
        if detail:
            # Convert dd/mm/yyyy HH:MM to ISO format for the API
            for field in ["inicioRecepcion", "cierreRecepcion", "fechaAclaracion", "fechaObjeciones"]:
                if field in detail:
                    val = detail[field]
                    try:
                        dt = datetime.strptime(val, "%d/%m/%Y %H:%M")
                        item[field] = dt.strftime("%Y-%m-%dT%H:%M:%S")
                    except Exception:
                        pass

            if "montoContratacion" in detail:
                item["montoContratacion"] = detail["montoContratacion"]

        licitaciones.append(item)

    payload = json.dumps({"licitaciones": licitaciones}).encode("utf-8")

    req = urllib.request.Request(
        ALFA_ONE_URL,
        data=payload,
        headers={
            "Authorization": "Bearer " + ALFA_ONE_SECRET,
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
            sys.stderr.write("Alfa One ingest: " + str(result) + "\n")
            data = result.get("data", result)
            return {
                "sent": len(licitaciones),
                "created": data.get("created", 0),
                "updated": data.get("updated", 0),
                "skipped": data.get("skipped", 0),
                "error": None,
            }
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        sys.stderr.write("Alfa One error " + str(e.code) + ": " + body[:300] + "\n")
        return {"sent": len(licitaciones), "created": 0, "updated": 0, "skipped": 0, "error": "HTTP " + str(e.code)}
    except Exception as e:
        sys.stderr.write("Alfa One error: " + str(e) + "\n")
        return {"sent": len(licitaciones), "created": 0, "updated": 0, "skipped": 0, "error": str(e)}


def main():
    today = datetime.now()
    week_ago = today - timedelta(days=7)
    date_from = week_ago.strftime("%d/%m/%Y")
    date_to = today.strftime("%d/%m/%Y")
    # Ventana de apertura de ofertas: 6 meses atrás → 12 meses adelante (evita hardcode que expira).
    openbid_from = (today - timedelta(days=180)).strftime("%d/%m/%Y")
    openbid_to = (today + timedelta(days=365)).strftime("%d/%m/%Y")

    opener = make_opener()
    visit_base(opener)

    all_tenders = []
    seen = set()

    for kw in ["SEGURIDAD", "VIGILANCIA"]:
        try:
            results = search_sicop(opener, kw, date_from, date_to, openbid_from, openbid_to)
            for t in results:
                if t["number"] not in seen:
                    seen.add(t["number"])
                    all_tenders.append(t)
        except Exception as e:
            sys.stderr.write("Error '" + kw + "': " + str(e) + "\n")

    # Now visit detail page for each tender to get extra fields
    sys.stderr.write("Fetching details for " + str(len(all_tenders)) + " tenders...\n")
    search_url = "https://www.sicop.go.cr/moduloOferta/search/EP_SEJ_COQ601.jsp"
    for t in all_tenders:
        if t.get("cartel_no") and t.get("cartel_seq"):
            try:
                detail = fetch_detail(opener, t["cartel_no"], t["cartel_seq"], search_url)
                t["detail"] = detail
                if detail:
                    sys.stderr.write("  " + t["number"] + ": " + str(len(detail)) + " fields extracted\n")
                else:
                    sys.stderr.write("  " + t["number"] + ": no detail extracted\n")
            except Exception as e:
                sys.stderr.write("  " + t["number"] + ": ERROR " + str(e) + "\n")
                t["detail"] = {}

    ingest_result = send_to_alfa_one(all_tenders)

    result = {
        "search_date": today.strftime("%d/%m/%Y %H:%M"),
        "date_range": date_from + " - " + date_to,
        "total_found": len(all_tenders),
        "tenders": all_tenders,
        "alfa_one": ingest_result,
    }

    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
