-- Facturación Electrónica Costa Rica (módulo FE, 1:1 con companies)

CREATE TYPE "FeAmbiente" AS ENUM ('STAGING', 'PRODUCCION');
CREATE TYPE "FeFacturaEstado" AS ENUM ('BORRADOR', 'PENDIENTE_ENVIO', 'ENVIADA', 'ACEPTADA', 'ACEPTADA_PARCIALMENTE', 'RECHAZADA', 'ERROR', 'ANULADA');
CREATE TYPE "FeComprobanteTipo" AS ENUM ('FACTURA_ELECTRONICA', 'NOTA_DEBITO', 'NOTA_CREDITO', 'TIQUETE_ELECTRONICO', 'MENSAJE_RECEPTOR');
CREATE TYPE "FeEstadoHaciendaCodigo" AS ENUM ('PENDIENTE', 'RECIBIDO', 'PROCESANDO', 'ACEPTADO', 'ACEPTADO_PARCIALMENTE', 'RECHAZADO', 'ERROR');
CREATE TYPE "FeCondicionVenta" AS ENUM ('CONTADO', 'CREDITO', 'CONSIGNACION', 'APARTADO', 'ARRENDAMIENTO_OPCION_COMPRA', 'ARRENDAMIENTO_FUNCION_FINANCIERA', 'OTROS');
CREATE TYPE "FeMedioPago" AS ENUM ('EFECTIVO', 'TARJETA', 'CHEQUE', 'TRANSFERENCIA_DEPOSITO', 'RECAUDADO_TERCEROS', 'SINPE_MOVIL', 'PLATAFORMA_DIGITAL', 'OTROS');
CREATE TYPE "FeMoneda" AS ENUM ('CRC', 'USD', 'EUR');
CREATE TYPE "FeIdentificacionTipo" AS ENUM ('FISICA', 'JURIDICA', 'DIMEX', 'NITE', 'EXTRANJERO');
CREATE TYPE "FeHistorialEnvioOperacion" AS ENUM ('GENERAR_XML', 'FIRMAR_XML', 'OBTENER_TOKEN', 'ENVIAR_COMPROBANTE', 'CONSULTAR_ESTADO', 'REENVIAR_CORREO', 'GENERAR_PDF', 'ERROR');
CREATE TYPE "FeHistorialEnvioResultado" AS ENUM ('EXITO', 'ERROR', 'REINTENTO');
CREATE TYPE "FeAdjuntoOrigen" AS ENUM ('GENERADO', 'RESPUESTA_HACIENDA', 'IMPORTADO');
CREATE TYPE "FeAuditoriaAccion" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'RESTORE', 'ENVIAR', 'ANULAR');
CREATE TYPE "FeJobTipo" AS ENUM ('REINTENTO_ENVIO', 'CONSULTA_ESTADO', 'REENVIO_CORREO', 'LIMPIEZA_ERRORES', 'GENERACION_LOGS');

CREATE TABLE "fe_empresas" (
    "id" UUID NOT NULL,
    "companyCode" TEXT NOT NULL,
    "nombreComercial" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "cedulaJuridica" TEXT NOT NULL,
    "actividadEconomica" TEXT,
    "ambiente" "FeAmbiente" NOT NULL DEFAULT 'STAGING',
    "certificadoPath" TEXT,
    "certificadoFileName" TEXT,
    "certificadoExpiresAt" TIMESTAMP(3),
    "certificadoPasswordEnc" TEXT,
    "correoRemitente" TEXT,
    "correoNombre" TEXT,
    "logoPath" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "direccionProvincia" TEXT,
    "direccionCanton" TEXT,
    "direccionDistrito" TEXT,
    "direccionOtras" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    CONSTRAINT "fe_empresas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fe_sucursales" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "codigo" VARCHAR(3) NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    CONSTRAINT "fe_sucursales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fe_puntos_venta" (
    "id" UUID NOT NULL,
    "sucursalId" UUID NOT NULL,
    "codigo" VARCHAR(5) NOT NULL,
    "nombre" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    CONSTRAINT "fe_puntos_venta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fe_consecutivos" (
    "id" UUID NOT NULL,
    "puntoVentaId" UUID NOT NULL,
    "tipoComprobante" "FeComprobanteTipo" NOT NULL,
    "ultimoNumero" BIGINT NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "fe_consecutivos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fe_clientes" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "tipoIdentificacion" "FeIdentificacionTipo" NOT NULL,
    "identificacion" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "email" TEXT,
    "emailCopia" TEXT,
    "telefono" TEXT,
    "direccionProvincia" TEXT,
    "direccionCanton" TEXT,
    "direccionDistrito" TEXT,
    "direccionOtras" TEXT,
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    CONSTRAINT "fe_clientes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fe_comprobantes_electronicos" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "puntoVentaId" UUID NOT NULL,
    "tipo" "FeComprobanteTipo" NOT NULL,
    "claveNumerica" VARCHAR(50) NOT NULL,
    "consecutivo" VARCHAR(20) NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "estadoHaciendaActual" "FeEstadoHaciendaCodigo" NOT NULL DEFAULT 'PENDIENTE',
    "mensajeHacienda" TEXT,
    "detalleHacienda" TEXT,
    "xmlSinFirmaPath" TEXT,
    "xmlFirmadoPath" TEXT,
    "xmlRespuestaPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    CONSTRAINT "fe_comprobantes_electronicos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fe_facturas" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "puntoVentaId" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "comprobanteId" UUID,
    "fecha" TIMESTAMP(3) NOT NULL,
    "moneda" "FeMoneda" NOT NULL DEFAULT 'CRC',
    "tipoCambio" DECIMAL(18,5) NOT NULL DEFAULT 1,
    "condicionVenta" "FeCondicionVenta" NOT NULL,
    "medioPago" "FeMedioPago" NOT NULL,
    "plazoCredito" INTEGER,
    "observaciones" TEXT,
    "subtotal" DECIMAL(18,5) NOT NULL,
    "totalDescuentos" DECIMAL(18,5) NOT NULL DEFAULT 0,
    "totalImpuestos" DECIMAL(18,5) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,5) NOT NULL,
    "estado" "FeFacturaEstado" NOT NULL DEFAULT 'BORRADOR',
    "asientoContableRef" TEXT,
    "contabilizadoAt" TIMESTAMP(3),
    "facturaMensualId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    CONSTRAINT "fe_facturas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fe_factura_detalles" (
    "id" UUID NOT NULL,
    "facturaId" UUID NOT NULL,
    "numeroLinea" INTEGER NOT NULL,
    "codigo" TEXT,
    "codigoCabys" VARCHAR(13),
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(18,5) NOT NULL,
    "unidadMedida" VARCHAR(10) NOT NULL,
    "precioUnitario" DECIMAL(18,5) NOT NULL,
    "montoDescuento" DECIMAL(18,5) NOT NULL DEFAULT 0,
    "codigoImpuesto" VARCHAR(2) NOT NULL DEFAULT '08',
    "tarifaImpuesto" DECIMAL(5,2) NOT NULL DEFAULT 13,
    "montoImpuesto" DECIMAL(18,5) NOT NULL DEFAULT 0,
    "totalLinea" DECIMAL(18,5) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "fe_factura_detalles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fe_notas_credito" (
    "id" UUID NOT NULL,
    "comprobanteId" UUID,
    "facturaReferenciaId" UUID NOT NULL,
    "claveReferencia" VARCHAR(50) NOT NULL,
    "razon" TEXT NOT NULL,
    "subtotal" DECIMAL(18,5) NOT NULL,
    "totalDescuentos" DECIMAL(18,5) NOT NULL DEFAULT 0,
    "totalImpuestos" DECIMAL(18,5) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,5) NOT NULL,
    "estado" "FeFacturaEstado" NOT NULL DEFAULT 'BORRADOR',
    "asientoContableRef" TEXT,
    "contabilizadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    CONSTRAINT "fe_notas_credito_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fe_nota_credito_detalles" (
    "id" UUID NOT NULL,
    "notaCreditoId" UUID NOT NULL,
    "numeroLinea" INTEGER NOT NULL,
    "codigo" TEXT,
    "codigoCabys" VARCHAR(13),
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(18,5) NOT NULL,
    "unidadMedida" VARCHAR(10) NOT NULL,
    "precioUnitario" DECIMAL(18,5) NOT NULL,
    "montoDescuento" DECIMAL(18,5) NOT NULL DEFAULT 0,
    "codigoImpuesto" VARCHAR(2) NOT NULL DEFAULT '08',
    "tarifaImpuesto" DECIMAL(5,2) NOT NULL DEFAULT 13,
    "montoImpuesto" DECIMAL(18,5) NOT NULL DEFAULT 0,
    "totalLinea" DECIMAL(18,5) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "fe_nota_credito_detalles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fe_notas_debito" (
    "id" UUID NOT NULL,
    "comprobanteId" UUID,
    "facturaReferenciaId" UUID NOT NULL,
    "claveReferencia" VARCHAR(50) NOT NULL,
    "razon" TEXT NOT NULL,
    "subtotal" DECIMAL(18,5) NOT NULL,
    "totalDescuentos" DECIMAL(18,5) NOT NULL DEFAULT 0,
    "totalImpuestos" DECIMAL(18,5) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,5) NOT NULL,
    "estado" "FeFacturaEstado" NOT NULL DEFAULT 'BORRADOR',
    "asientoContableRef" TEXT,
    "contabilizadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    CONSTRAINT "fe_notas_debito_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fe_nota_debito_detalles" (
    "id" UUID NOT NULL,
    "notaDebitoId" UUID NOT NULL,
    "numeroLinea" INTEGER NOT NULL,
    "codigo" TEXT,
    "codigoCabys" VARCHAR(13),
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(18,5) NOT NULL,
    "unidadMedida" VARCHAR(10) NOT NULL,
    "precioUnitario" DECIMAL(18,5) NOT NULL,
    "montoDescuento" DECIMAL(18,5) NOT NULL DEFAULT 0,
    "codigoImpuesto" VARCHAR(2) NOT NULL DEFAULT '08',
    "tarifaImpuesto" DECIMAL(5,2) NOT NULL DEFAULT 13,
    "montoImpuesto" DECIMAL(18,5) NOT NULL DEFAULT 0,
    "totalLinea" DECIMAL(18,5) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "fe_nota_debito_detalles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fe_mensajes_receptor" (
    "id" UUID NOT NULL,
    "comprobanteId" UUID,
    "claveComprobante" VARCHAR(50) NOT NULL,
    "tipoMensaje" TEXT NOT NULL,
    "detalleMensaje" TEXT,
    "montoTotalImpuesto" DECIMAL(18,5),
    "montoTotal" DECIMAL(18,5),
    "estado" "FeFacturaEstado" NOT NULL DEFAULT 'BORRADOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    CONSTRAINT "fe_mensajes_receptor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fe_estados_hacienda" (
    "id" UUID NOT NULL,
    "comprobanteId" UUID NOT NULL,
    "estado" "FeEstadoHaciendaCodigo" NOT NULL,
    "codigoRespuesta" TEXT,
    "mensaje" TEXT,
    "detalle" TEXT,
    "consultadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "fe_estados_hacienda_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fe_historial_envios" (
    "id" UUID NOT NULL,
    "comprobanteId" UUID NOT NULL,
    "operacion" "FeHistorialEnvioOperacion" NOT NULL,
    "resultado" "FeHistorialEnvioResultado" NOT NULL,
    "intento" INTEGER NOT NULL DEFAULT 1,
    "httpStatus" INTEGER,
    "duracionMs" INTEGER,
    "requestMeta" TEXT,
    "responseMeta" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "fe_historial_envios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fe_adjuntos_xml" (
    "id" UUID NOT NULL,
    "comprobanteId" UUID NOT NULL,
    "origen" "FeAdjuntoOrigen" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/xml',
    "sha256" VARCHAR(64),
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "fe_adjuntos_xml_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fe_adjuntos_pdf" (
    "id" UUID NOT NULL,
    "comprobanteId" UUID NOT NULL,
    "origen" "FeAdjuntoOrigen" NOT NULL DEFAULT 'GENERADO',
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sha256" VARCHAR(64),
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "fe_adjuntos_pdf_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fe_auditorias" (
    "id" UUID NOT NULL,
    "empresaId" UUID,
    "entidad" TEXT NOT NULL,
    "entidadId" UUID NOT NULL,
    "accion" "FeAuditoriaAccion" NOT NULL,
    "userId" TEXT,
    "previousData" TEXT,
    "newData" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "fe_auditorias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fe_job_queue" (
    "id" UUID NOT NULL,
    "empresaId" UUID,
    "comprobanteId" UUID,
    "jobType" "FeJobTipo" NOT NULL,
    "payload" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "fe_job_queue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fe_empresas_companyCode_key" ON "fe_empresas"("companyCode");
CREATE INDEX "fe_empresas_deletedAt_idx" ON "fe_empresas"("deletedAt");
CREATE INDEX "fe_empresas_ambiente_idx" ON "fe_empresas"("ambiente");

CREATE UNIQUE INDEX "fe_sucursales_empresaId_codigo_key" ON "fe_sucursales"("empresaId", "codigo");
CREATE INDEX "fe_sucursales_empresaId_idx" ON "fe_sucursales"("empresaId");
CREATE INDEX "fe_sucursales_deletedAt_idx" ON "fe_sucursales"("deletedAt");

CREATE UNIQUE INDEX "fe_puntos_venta_sucursalId_codigo_key" ON "fe_puntos_venta"("sucursalId", "codigo");
CREATE INDEX "fe_puntos_venta_sucursalId_idx" ON "fe_puntos_venta"("sucursalId");
CREATE INDEX "fe_puntos_venta_deletedAt_idx" ON "fe_puntos_venta"("deletedAt");

CREATE UNIQUE INDEX "fe_consecutivos_puntoVentaId_tipoComprobante_key" ON "fe_consecutivos"("puntoVentaId", "tipoComprobante");
CREATE INDEX "fe_consecutivos_puntoVentaId_idx" ON "fe_consecutivos"("puntoVentaId");

CREATE UNIQUE INDEX "fe_clientes_empresaId_identificacion_key" ON "fe_clientes"("empresaId", "identificacion");
CREATE INDEX "fe_clientes_empresaId_idx" ON "fe_clientes"("empresaId");
CREATE INDEX "fe_clientes_deletedAt_idx" ON "fe_clientes"("deletedAt");

CREATE UNIQUE INDEX "fe_comprobantes_electronicos_claveNumerica_key" ON "fe_comprobantes_electronicos"("claveNumerica");
CREATE INDEX "fe_comprobantes_electronicos_empresaId_fechaEmision_idx" ON "fe_comprobantes_electronicos"("empresaId", "fechaEmision");
CREATE INDEX "fe_comprobantes_electronicos_empresaId_estadoHaciendaActual_idx" ON "fe_comprobantes_electronicos"("empresaId", "estadoHaciendaActual");
CREATE INDEX "fe_comprobantes_electronicos_puntoVentaId_idx" ON "fe_comprobantes_electronicos"("puntoVentaId");
CREATE INDEX "fe_comprobantes_electronicos_deletedAt_idx" ON "fe_comprobantes_electronicos"("deletedAt");

CREATE UNIQUE INDEX "fe_facturas_comprobanteId_key" ON "fe_facturas"("comprobanteId");
CREATE INDEX "fe_facturas_empresaId_fecha_idx" ON "fe_facturas"("empresaId", "fecha");
CREATE INDEX "fe_facturas_empresaId_estado_idx" ON "fe_facturas"("empresaId", "estado");
CREATE INDEX "fe_facturas_clienteId_idx" ON "fe_facturas"("clienteId");
CREATE INDEX "fe_facturas_facturaMensualId_idx" ON "fe_facturas"("facturaMensualId");
CREATE INDEX "fe_facturas_deletedAt_idx" ON "fe_facturas"("deletedAt");

CREATE UNIQUE INDEX "fe_factura_detalles_facturaId_numeroLinea_key" ON "fe_factura_detalles"("facturaId", "numeroLinea");
CREATE INDEX "fe_factura_detalles_facturaId_idx" ON "fe_factura_detalles"("facturaId");

CREATE UNIQUE INDEX "fe_notas_credito_comprobanteId_key" ON "fe_notas_credito"("comprobanteId");
CREATE INDEX "fe_notas_credito_facturaReferenciaId_idx" ON "fe_notas_credito"("facturaReferenciaId");
CREATE INDEX "fe_notas_credito_deletedAt_idx" ON "fe_notas_credito"("deletedAt");

CREATE UNIQUE INDEX "fe_nota_credito_detalles_notaCreditoId_numeroLinea_key" ON "fe_nota_credito_detalles"("notaCreditoId", "numeroLinea");
CREATE INDEX "fe_nota_credito_detalles_notaCreditoId_idx" ON "fe_nota_credito_detalles"("notaCreditoId");

CREATE UNIQUE INDEX "fe_notas_debito_comprobanteId_key" ON "fe_notas_debito"("comprobanteId");
CREATE INDEX "fe_notas_debito_facturaReferenciaId_idx" ON "fe_notas_debito"("facturaReferenciaId");
CREATE INDEX "fe_notas_debito_deletedAt_idx" ON "fe_notas_debito"("deletedAt");

CREATE UNIQUE INDEX "fe_nota_debito_detalles_notaDebitoId_numeroLinea_key" ON "fe_nota_debito_detalles"("notaDebitoId", "numeroLinea");
CREATE INDEX "fe_nota_debito_detalles_notaDebitoId_idx" ON "fe_nota_debito_detalles"("notaDebitoId");

CREATE UNIQUE INDEX "fe_mensajes_receptor_comprobanteId_key" ON "fe_mensajes_receptor"("comprobanteId");
CREATE INDEX "fe_mensajes_receptor_claveComprobante_idx" ON "fe_mensajes_receptor"("claveComprobante");
CREATE INDEX "fe_mensajes_receptor_deletedAt_idx" ON "fe_mensajes_receptor"("deletedAt");

CREATE INDEX "fe_estados_hacienda_comprobanteId_consultadoAt_idx" ON "fe_estados_hacienda"("comprobanteId", "consultadoAt");
CREATE INDEX "fe_estados_hacienda_estado_idx" ON "fe_estados_hacienda"("estado");

CREATE INDEX "fe_historial_envios_comprobanteId_createdAt_idx" ON "fe_historial_envios"("comprobanteId", "createdAt");
CREATE INDEX "fe_historial_envios_operacion_resultado_idx" ON "fe_historial_envios"("operacion", "resultado");

CREATE INDEX "fe_adjuntos_xml_comprobanteId_idx" ON "fe_adjuntos_xml"("comprobanteId");
CREATE INDEX "fe_adjuntos_pdf_comprobanteId_idx" ON "fe_adjuntos_pdf"("comprobanteId");

CREATE INDEX "fe_auditorias_entidad_entidadId_idx" ON "fe_auditorias"("entidad", "entidadId");
CREATE INDEX "fe_auditorias_empresaId_createdAt_idx" ON "fe_auditorias"("empresaId", "createdAt");

CREATE INDEX "fe_job_queue_runAt_jobType_idx" ON "fe_job_queue"("runAt", "jobType");
CREATE INDEX "fe_job_queue_comprobanteId_idx" ON "fe_job_queue"("comprobanteId");
CREATE INDEX "fe_job_queue_deletedAt_idx" ON "fe_job_queue"("deletedAt");

ALTER TABLE "fe_empresas" ADD CONSTRAINT "fe_empresas_companyCode_fkey" FOREIGN KEY ("companyCode") REFERENCES "companies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fe_sucursales" ADD CONSTRAINT "fe_sucursales_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "fe_empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fe_puntos_venta" ADD CONSTRAINT "fe_puntos_venta_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "fe_sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fe_consecutivos" ADD CONSTRAINT "fe_consecutivos_puntoVentaId_fkey" FOREIGN KEY ("puntoVentaId") REFERENCES "fe_puntos_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fe_clientes" ADD CONSTRAINT "fe_clientes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "fe_empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fe_comprobantes_electronicos" ADD CONSTRAINT "fe_comprobantes_electronicos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "fe_empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fe_comprobantes_electronicos" ADD CONSTRAINT "fe_comprobantes_electronicos_puntoVentaId_fkey" FOREIGN KEY ("puntoVentaId") REFERENCES "fe_puntos_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fe_facturas" ADD CONSTRAINT "fe_facturas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "fe_empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fe_facturas" ADD CONSTRAINT "fe_facturas_puntoVentaId_fkey" FOREIGN KEY ("puntoVentaId") REFERENCES "fe_puntos_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fe_facturas" ADD CONSTRAINT "fe_facturas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "fe_clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fe_facturas" ADD CONSTRAINT "fe_facturas_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "fe_comprobantes_electronicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fe_facturas" ADD CONSTRAINT "fe_facturas_facturaMensualId_fkey" FOREIGN KEY ("facturaMensualId") REFERENCES "facturas_mensuales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fe_factura_detalles" ADD CONSTRAINT "fe_factura_detalles_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "fe_facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fe_notas_credito" ADD CONSTRAINT "fe_notas_credito_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "fe_comprobantes_electronicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fe_notas_credito" ADD CONSTRAINT "fe_notas_credito_facturaReferenciaId_fkey" FOREIGN KEY ("facturaReferenciaId") REFERENCES "fe_facturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fe_nota_credito_detalles" ADD CONSTRAINT "fe_nota_credito_detalles_notaCreditoId_fkey" FOREIGN KEY ("notaCreditoId") REFERENCES "fe_notas_credito"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fe_notas_debito" ADD CONSTRAINT "fe_notas_debito_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "fe_comprobantes_electronicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fe_notas_debito" ADD CONSTRAINT "fe_notas_debito_facturaReferenciaId_fkey" FOREIGN KEY ("facturaReferenciaId") REFERENCES "fe_facturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fe_nota_debito_detalles" ADD CONSTRAINT "fe_nota_debito_detalles_notaDebitoId_fkey" FOREIGN KEY ("notaDebitoId") REFERENCES "fe_notas_debito"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fe_mensajes_receptor" ADD CONSTRAINT "fe_mensajes_receptor_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "fe_comprobantes_electronicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fe_estados_hacienda" ADD CONSTRAINT "fe_estados_hacienda_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "fe_comprobantes_electronicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fe_historial_envios" ADD CONSTRAINT "fe_historial_envios_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "fe_comprobantes_electronicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fe_adjuntos_xml" ADD CONSTRAINT "fe_adjuntos_xml_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "fe_comprobantes_electronicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fe_adjuntos_pdf" ADD CONSTRAINT "fe_adjuntos_pdf_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "fe_comprobantes_electronicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fe_auditorias" ADD CONSTRAINT "fe_auditorias_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "fe_empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fe_job_queue" ADD CONSTRAINT "fe_job_queue_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "fe_empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fe_job_queue" ADD CONSTRAINT "fe_job_queue_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "fe_comprobantes_electronicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
