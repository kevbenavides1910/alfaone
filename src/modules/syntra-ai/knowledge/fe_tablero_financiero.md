# Facturación electrónica 4.4 y Tablero Financiero (Syntra)

Texto interno original. No es documentación de Odoo Enterprise.

## Tablero Financiero
1. Abra **Financiero → Tablero**.
2. Cada tarjeta es un diario (ventas, compras, banco).
3. En ventas: **Nuevo** crea una factura de cliente. Si FE CR está instalado, use el enlace de configuración 4.4.
4. En compras: **Subir** o **Nuevo**. El OCR es el asistente local «Extraer desde documento», no IAP de Odoo.
5. En banco: importe OFX/CSV o use la sincronización por archivo/URL. No hay Plaid.
6. Los informes interactivos (P&amp;G, balance, IVA) están en **Financiero → Reportes** (account_ce_reports / MIS).

## Facturación electrónica CR 4.4
1. Configure el certificado y ambiente en el menú de FE (Qwerty / cr_electronic_invoice).
2. Cree la factura de cliente en borrador, complete receptor y líneas CABYS.
3. Publique y envíe a Hacienda desde los botones de la factura (no desde este chat).
4. Revise el estado (aceptada / rechazada) en la propia factura o en el listado FE.
5. Para facturas de proveedor con XML de Hacienda, use el importador `cr_import_vendor_bills`. El OCR es solo para PDF/imagen sin XML.

## Qué no hace este asistente
- No publica facturas ni envía a Hacienda.
- No escribe en el ORM de forma libre.
- No usa IAP ni ChatGPT del editor Enterprise.
