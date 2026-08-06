# Imagen base: Node 20 LTS sobre Alpine (ligera; compatible con Prisma si hay OpenSSL).
# Alternativa si falla el motor de Prisma: cambiar a `node:20-bookworm-slim` en base y runner.
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

FROM base AS deps
COPY package.json package-lock.json* ./
# Redes lentas o inestables (p. ej. VPS): más reintentos antes de fallar el build.
# Cache mount de npm evita redescargar el registry cuando el lockfile cambia poco.
RUN --mount=type=cache,target=/root/.npm \
    npm config set fetch-retries 15 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 300000 \
    && npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXTAUTH_URL=http://localhost:3000
ENV NEXTAUTH_SECRET=ci-build-placeholder-secret-min-32-characters!!
# Self-hosted alfaia tiene mucha RAM/CPU; evita OOM y acelera el compile.
ENV NODE_OPTIONS=--max-old-space-size=8192
# Omite typecheck en next build (ver next.config.ts); cache webpack/SWC entre publishes.
ENV DOCKER_BUILD=1
# Sin cache mount de .next: evita chunks cliente vacíos/corruptos en rebuilds.
RUN npm run build

# Stage aislado: oracledb thick (glibc). Cache estable — no se reinstala en cada rebuild de Next.
FROM node:20-bookworm-slim AS ora
RUN npm install --prefix /tmp/ora-install oracledb@7.0.0 --omit=dev

FROM node:20-bookworm-slim AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-spa tesseract-ocr-eng poppler-utils qpdf libaio1 ca-certificates smbclient \
  && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

# Capas estables ANTES del COPY del standalone (no se invalidan en cada rebuild de Next).
RUN npm install -g prisma@5.22.0

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
# Prisma no siempre queda trazado en standalone; aseguramos cliente y motores
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
# Para prisma/reset-admin-password.js (no siempre incluido en el trace de standalone)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs
# Firma XAdES (aceptar facturas FE): createRequire desde server.js, no quedan en el trace de standalone
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/xpath ./node_modules/xpath
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/xadesjs ./node_modules/xadesjs
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/xmldsigjs ./node_modules/xmldsigjs
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/xml-core ./node_modules/xml-core
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@xmldom ./node_modules/@xmldom
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/asn1js ./node_modules/asn1js
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pkijs ./node_modules/pkijs
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pvtsutils ./node_modules/pvtsutils
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pvutils ./node_modules/pvutils
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/tslib ./node_modules/tslib
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bytestreamjs ./node_modules/bytestreamjs
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@noble ./node_modules/@noble
COPY --from=builder --chown=nextjs:nodejs /app/scripts/fe-xades-bootstrap.cjs ./scripts/fe-xades-bootstrap.cjs
# oracledb desde stage cacheado (solo COPY, sin npm install en cada rebuild)
COPY --from=ora --chown=nextjs:nodejs /tmp/ora-install/node_modules/oracledb ./node_modules/oracledb

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV LD_LIBRARY_PATH=/opt/oracle/instantclient_19_23
CMD ["sh", "-c", "prisma migrate deploy && exec node server.js"]
