# Alfa One — procedimientos clave

Plataforma web en https://one.grupocorporativoalfa.com

## Módulos principales

- **Contratos** (`/contracts`): licitaciones, clientes, ubicaciones, puestos, zonas operativas.
- **Gastos** (`/expenses`): solicitudes, aprobaciones, distribución por contrato.
- **Facturación y cobro** (`/facturacion`): generación mensual, cuentas por cobrar.
- **Pagos** (`/pagos`): calendario APEX + gastos programados; cola «Pago proveedores» para asignar fecha.
- **Empleados NAF** (`/empleados-naf`): nómina Oracle NAF, planillas, cargas sociales.
- **Disciplinario** (`/disciplinario`): marcas, apercibimientos, omisiones.
- **SIG** (`/sig`): documentos, riesgos, incidentes, auditorías.
- **Tickets TI** (`/tickets-ti`): soporte interno.

## Reglas de negocio

- NAF es la fuente de verdad para nómina y datos operativos Oracle.
- Cada administración (compañía) se maneja por aparte; no mezclar datos entre cías.
- Zonas operativas vienen de NAF5.AROPZO (pantalla 89-Zonas), no de zonas geográficas.
- Sync de ubicaciones: solo contratos ACTIVE y roles AROPMR con ESTATUS='A'.

## Asistente

El usuario puede decir «recuerda …» para guardar hechos, «aprende …» para crear skills de procedimiento, y «olvida …» para archivar memoria.
