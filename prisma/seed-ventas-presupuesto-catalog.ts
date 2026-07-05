/**
 * Siembra catálogo maestro de presupuestos de licitación.
 * Ejecutar: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-ventas-presupuesto-catalog.ts
 */
import {
  PrismaClient,
  VentasSalarioTipo,
  VentasEquipamiento,
} from "@prisma/client";

const prisma = new PrismaClient();

const ANIOS = ["2022", "2023", "2024", "2025", "2026"];

async function seedSalarios() {
  const cats = [
    { codigo: "TONC", descripcion: "No Calificado (Genérico)", tipo: VentasSalarioTipo.MENSUAL, siglas: "TONC", base: 373092.3 },
    { codigo: "TOSC", descripcion: "Semicalificado (Genérico)", tipo: VentasSalarioTipo.MENSUAL, siglas: "TOSC", base: 405710.7 },
    { codigo: "TOC", descripcion: "Calificado (Genérico)", tipo: VentasSalarioTipo.MENSUAL, siglas: "TOC", base: 419755.8 },
    { codigo: "TOE", descripcion: "Especializado", tipo: VentasSalarioTipo.HORARIO, siglas: "TOE", base: 16244.5 },
    { codigo: "TES", descripcion: "Especialización Superior", tipo: VentasSalarioTipo.HORARIO, siglas: "TES", base: 25209.8 },
    { codigo: "TONCG", descripcion: "No Calificado Genérico (variante)", tipo: VentasSalarioTipo.MENSUAL, siglas: "TONCG", base: 373092.3 },
    { codigo: "TOSCG", descripcion: "Semicalificado Genérico (variante)", tipo: VentasSalarioTipo.MENSUAL, siglas: "TOSCG", base: 405710.7 },
    { codigo: "TOCG", descripcion: "Calificado Genérico (variante)", tipo: VentasSalarioTipo.MENSUAL, siglas: "TOCG", base: 419755.8 },
  ];

  for (let i = 0; i < cats.length; i++) {
    const c = cats[i];
    const valoresPorAnio = Object.fromEntries(
      ANIOS.map((y, idx) => [y, Math.round(c.base * (1 + idx * 0.03) * 100) / 100])
    );
    await prisma.ventasSalarioCategoria.upsert({
      where: { codigo: c.codigo },
      create: {
        codigo: c.codigo,
        descripcion: c.descripcion,
        tipo: c.tipo,
        siglas: c.siglas,
        valoresPorAnio,
        aumentosPct: { "2023": 3, "2024": 3, "2025": 3, "2026": 3 },
        sortOrder: i,
      },
      update: {
        descripcion: c.descripcion,
        valoresPorAnio,
        sortOrder: i,
      },
    });
  }
}

async function seedJornadas() {
  const items = [
    {
      codigo: "MO1",
      nombre: "L-D 24hrs (3 turnos)",
      descripcion: "Diurna 06-14, mixta 14-22, nocturna 22-06",
      horasConfig: { diurna: 48, mixta: 42, nocturna: 30 },
      salarioCategoriaCodigo: "TOSCG",
      salarioBaseMensual: 405710.7,
      costoMoReferencia: 2972950.0578496186,
      costoHoraOrdinaria: 1690.46125,
      costoHoraExtra: 2535.691875,
    },
    {
      codigo: "MO2",
      nombre: "L-V 07:00 a 16:30",
      horasConfig: { horasSemanales: 47.5 },
      salarioCategoriaCodigo: "TOSCG",
      salarioBaseMensual: 405710.7,
      costoMoReferencia: 665574.0145724074,
      costoHoraOrdinaria: 1690.46125,
      costoHoraExtra: 2535.691875,
    },
    {
      codigo: "MO3",
      nombre: "L-V 06:30 a 16:30",
      horasConfig: { horasSemanales: 50 },
      salarioCategoriaCodigo: "TOSCG",
      salarioBaseMensual: 405710.7,
      costoMoReferencia: 736073.7510185298,
      costoHoraOrdinaria: 1690.46125,
      costoHoraExtra: 2535.691875,
    },
    {
      codigo: "MO4",
      nombre: "Solo jornada nocturna",
      horasConfig: { horasSemanales: 30 },
      salarioCategoriaCodigo: "TOSCG",
      salarioBaseMensual: 338092.25,
      costoMoReferencia: 1702887.8173443237,
      costoHoraOrdinaria: 2253.9483333333333,
      costoHoraExtra: 3380.9225,
    },
    {
      codigo: "MO5",
      nombre: "L-V 12 horas",
      horasConfig: { horasSemanales: 60 },
      salarioCategoriaCodigo: "TOSCG",
      salarioBaseMensual: 405710.7,
      costoMoReferencia: 930686.4114631531,
      costoHoraOrdinaria: 1690.46125,
      costoHoraExtra: 2535.691875,
    },
  ];

  for (let i = 0; i < items.length; i++) {
    const j = items[i];
    await prisma.ventasJornadaTipo.upsert({
      where: { codigo: j.codigo },
      create: { ...j, sortOrder: i },
      update: { ...j, sortOrder: i },
    });
  }
}

async function seedCargasSociales() {
  const items = [
    { codigo: "SEM", nombre: "Seguro Enfermedad y Maternidad", porcentaje: 9.25, grupo: "SEGURIDAD_SOCIAL" },
    { codigo: "IVM", nombre: "Invalidez, Vejez y Muerte", porcentaje: 5.58, grupo: "SEGURIDAD_SOCIAL" },
    { codigo: "BP", nombre: "Banco Popular", porcentaje: 0.5, grupo: "SEGURIDAD_SOCIAL" },
    { codigo: "INA", nombre: "INA", porcentaje: 1.5, grupo: "SEGURIDAD_SOCIAL" },
    { codigo: "IMAS", nombre: "IMAS", porcentaje: 0.5, grupo: "SEGURIDAD_SOCIAL" },
    { codigo: "ASFA", nombre: "Asignaciones Familiares", porcentaje: 5.0, grupo: "SEGURIDAD_SOCIAL" },
    { codigo: "FC", nombre: "Fondo Capitalización", porcentaje: 1.5, grupo: "SEGURIDAD_SOCIAL" },
    { codigo: "FP", nombre: "Fondo Pensiones", porcentaje: 3.0, grupo: "SEGURIDAD_SOCIAL" },
    { codigo: "AGUINALDO", nombre: "Aguinaldo", porcentaje: 8.33, grupo: "GARANTIAS" },
    { codigo: "CESANTIA", nombre: "Cesantía", porcentaje: 5.33, grupo: "GARANTIAS" },
    { codigo: "POLIZA_INS", nombre: "Póliza INS", porcentaje: 5.75, grupo: "POLIZA" },
  ];

  for (let i = 0; i < items.length; i++) {
    const c = items[i];
    await prisma.ventasCargaSocial.upsert({
      where: { codigo: c.codigo },
      create: { ...c, sortOrder: i },
      update: { ...c, sortOrder: i },
    });
  }
}

async function seedPagosExtras() {
  const items = [
    { codigo: "VACACIONES", nombre: "Vacaciones", tipo: "PORCENTAJE", valor: 3.89, descripcion: "Provisión vacaciones" },
    { codigo: "CUBRE_COMIDAS", nombre: "Cubre comidas", tipo: "MONTO_DIARIO", valor: 13523.69, descripcion: "Por oficial/día" },
    { codigo: "FERIADOS", nombre: "Feriados MTSS", tipo: "PORCENTAJE", valor: 2.5, descripcion: "DAJ-AER-OF-41-2021" },
    { codigo: "DESCANSO_NOCTURNO", nombre: "Descanso absoluto nocturno", tipo: "PORCENTAJE", valor: 1.5, descripcion: "Jornada nocturna" },
  ];

  for (let i = 0; i < items.length; i++) {
    const p = items[i];
    await prisma.ventasPagoExtra.upsert({
      where: { codigo: p.codigo },
      create: { ...p, sortOrder: i },
      update: { ...p, sortOrder: i },
    });
  }
}

async function seedInsumos() {
  const base = [
    { codigo: "UNI_CAMISA", nombre: "Camisa uniforme", categoria: "UNIFORME", costo: 18500, eq: [VentasEquipamiento.AF, VentasEquipamiento.ANL, VentasEquipamiento.SA, VentasEquipamiento.L] },
    { codigo: "UNI_PANT", nombre: "Pantalón uniforme", categoria: "UNIFORME", costo: 22000, eq: [VentasEquipamiento.AF, VentasEquipamiento.ANL, VentasEquipamiento.SA, VentasEquipamiento.L] },
    { codigo: "UNI_BOTAS", nombre: "Botas tácticas", categoria: "UNIFORME", costo: 45000, eq: [VentasEquipamiento.AF, VentasEquipamiento.ANL, VentasEquipamiento.SA, VentasEquipamiento.L] },
    { codigo: "TAC_CHALECO", nombre: "Chaleco antibalas", categoria: "TACTICO", costo: 185000, eq: [VentasEquipamiento.AF, VentasEquipamiento.L] },
    { codigo: "TAC_CASCO", nombre: "Casco táctico", categoria: "TACTICO", costo: 65000, eq: [VentasEquipamiento.AF, VentasEquipamiento.ANL, VentasEquipamiento.L] },
    { codigo: "COM_RADIO", nombre: "Radio portátil", categoria: "COMUNICACION", costo: 120000, eq: [VentasEquipamiento.AF, VentasEquipamiento.ANL, VentasEquipamiento.SA, VentasEquipamiento.L] },
    { codigo: "ARM_PISTOLA", nombre: "Arma de fuego", categoria: "ARMAMENTO", costo: 450000, eq: [VentasEquipamiento.AF, VentasEquipamiento.L] },
    { codigo: "ARM_SPRAY", nombre: "Spray defensivo", categoria: "ARMAMENTO", costo: 25000, eq: [VentasEquipamiento.ANL] },
  ];

  for (let i = 0; i < base.length; i++) {
    const item = base[i];
    await prisma.ventasInsumoItem.upsert({
      where: { codigo: item.codigo },
      create: {
        codigo: item.codigo,
        nombre: item.nombre,
        categoria: item.categoria,
        equipamientos: item.eq,
        costoUnitario: item.costo,
        depreciacionMeses: 12,
        sortOrder: i,
      },
      update: {
        nombre: item.nombre,
        equipamientos: item.eq,
        costoUnitario: item.costo,
        sortOrder: i,
      },
    });
  }
}

async function seedGastosAdmin() {
  const items = [
    { codigo: "GA_ADMIN", nombre: "Gastos administrativos", monto: 14492.753623188404 },
    { codigo: "GA_OPER", nombre: "Gastos operacionales", monto: 25000 },
    { codigo: "GA_CAP", nombre: "Capacitaciones", monto: 7835.326086956521 },
    { codigo: "GA_EJEC", nombre: "Ejecutivo de cuenta", monto: 18915.710144927536, notas: "Salario ₡1,100,000 + cargas" },
    { codigo: "GA_SUP", nombre: "Supervisión (12 supervisores)", monto: 116783.13739130434 },
    { codigo: "GA_RED", nombre: "Administrador de redes", monto: 8901.565217391304 },
    { codigo: "GA_TEL", nombre: "Telecomunicaciones", monto: 8000 },
    { codigo: "GA_RADIO", nombre: "Radios adicionales", monto: 424.461231884058 },
    { codigo: "GA_MOTO", nombre: "Vehículos supervisores (motos)", monto: 108333.33 },
    { codigo: "GA_VEH", nombre: "Vehículo ejecutivo", monto: 416666.67 },
  ];

  for (let i = 0; i < items.length; i++) {
    const g = items[i];
    await prisma.ventasGastoAdmin.upsert({
      where: { codigo: g.codigo },
      create: {
        codigo: g.codigo,
        nombre: g.nombre,
        montoMensual: g.monto,
        notas: g.notas ?? null,
        sortOrder: i,
      },
      update: {
        nombre: g.nombre,
        montoMensual: g.monto,
        notas: g.notas ?? null,
        sortOrder: i,
      },
    });
  }
}

async function seedInsumoVariantes() {
  const items = [
    { codigoHoja: "3,89AF", equipamiento: VentasEquipamiento.AF, factorOficiales: 3.89, montoMensual: 58275.29069166667 },
    { codigoHoja: "3,89AF-L", equipamiento: VentasEquipamiento.L, factorOficiales: 3.89, montoMensual: 60025.29069166667 },
    { codigoHoja: "1AF", equipamiento: VentasEquipamiento.AF, factorOficiales: 1, montoMensual: 41642.685625 },
    { codigoHoja: "3,89ANL", equipamiento: VentasEquipamiento.ANL, factorOficiales: 3.89, montoMensual: 57008.794025 },
    { codigoHoja: "1ANL", equipamiento: VentasEquipamiento.ANL, factorOficiales: 1, montoMensual: 40376.18895833334 },
    { codigoHoja: "1,5SA", equipamiento: VentasEquipamiento.SA, factorOficiales: 1.5, montoMensual: 40128.80229166667 },
    { codigoHoja: "2,5SA", equipamiento: VentasEquipamiento.SA, factorOficiales: 2.5, montoMensual: 40128.80229166667 },
    { codigoHoja: "3,89SA", equipamiento: VentasEquipamiento.SA, factorOficiales: 3.89, montoMensual: 40128.80229166667 },
    { codigoHoja: "3,89AMBAS", equipamiento: VentasEquipamiento.SA, factorOficiales: 3.89, montoMensual: 61400.29069166667 },
    { codigoHoja: "3,89AMBAS-L", equipamiento: VentasEquipamiento.SA, factorOficiales: 3.89, montoMensual: 63150.29069166667 },
  ];

  for (let i = 0; i < items.length; i++) {
    const v = items[i];
    await prisma.ventasInsumoVariante.upsert({
      where: { codigoHoja: v.codigoHoja },
      create: { ...v, sortOrder: i, descripcion: `Hoja ${v.codigoHoja}` },
      update: { ...v, sortOrder: i },
    });
  }
}

async function seedIndices() {
  const items = [
    { codigo: "MTSS", nombre: "Decreto Salarios MTSS" },
    { codigo: "IPPI", nombre: "Índice Precios Productor Industrial" },
    { codigo: "IPC", nombre: "Índice Precios Consumidor" },
  ];

  for (const idx of items) {
    await prisma.ventasIndiceActualizacion.upsert({
      where: { codigo: idx.codigo },
      create: idx,
      update: { nombre: idx.nombre },
    });
  }
}

async function main() {
  console.log("Seeding catálogo presupuestos ventas…");
  await seedSalarios();
  await seedJornadas();
  await seedCargasSociales();
  await seedPagosExtras();
  await seedInsumos();
  await seedInsumoVariantes();
  await seedGastosAdmin();
  await seedIndices();
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
