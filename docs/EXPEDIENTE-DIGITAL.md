# Expediente digital (por cédula)

Módulo Alfa One que consulta y alimenta el **expediente digital NAF** existente.

## Fuente canónica

| Rol | Valor |
|-----|--------|
| Host | `10.1.1.6` (`oracledb01`) |
| Disco | `/u01/EXPEDIENTE_DIGITAL` (~248 GB) |
| Share Samba | `//10.1.1.6/Expediente Digital` |
| Usuario Samba | `oracle` (no el administrador de Windows) |
| Metadatos | Oracle `NAF5.ARPLEXPDIG` + catálogo `NAF5.ARPLTDS` |
| Convención archivos | `EMPLEADOS/{TIPO_DOC}/{NO_EMPLE}.pdf` |

**No escribir** a `10.1.1.22\expediente_digital`: es copia parcial / dumps, no la fuente viva.

## Blindaje ops (obligatorio)

Incidente 15-jul-2026: un `rm -rf` sobre una ruta local con el share CIFS **aún montado** borró PDFs remotos en `10.1.1.6`.

Reglas:

1. **Nunca** montar `//10.1.1.6/Expediente Digital` bajo el repo (`code/presupuestos-alfa` ni worktrees). Path canónico del mount en este VPS: `/mnt/data/projects/alfa-one/app/expediente-digital` → contenedor `/data/expediente-digital`.
2. **Nunca** `rm -rf` sobre un path que pueda contener un montaje CIFS. Antes: `findmnt` / `mountpoint -q` y `umount` completo (no solo lazy) si hay que limpiar.
3. Despliegues: preferir `smbclient` / `EXPEDIENTE_FS_ROOT` ya montado fuera del contexto Docker; no meter el share en el build context.
4. Auditoría en `.6`: `auditd` key `expediente_digital` + Samba `full_audit` → `/var/log/samba/expediente-audit.log`.
5. En `.229`, shells interactivos cargan `/etc/profile.d/alfa-one-cifs-safety.sh` (bloquea `rm -r` sobre CIFS/expediente). Helper: `/usr/local/bin/alfa-one-guard-cifs` y `alfa-one-rm-safe`.

Instalar / refrescar políticas + cron de backup:

```bash
sudo bash scripts/install-expediente-policies.sh
```

## Respaldo en este servidor (.229)

La fuente viva sigue en `10.1.1.6`. Este VPS guarda una **réplica filesystem** (además de los `expdp` de BD):

| Rol | Path |
|-----|------|
| Origen | `oracle@10.1.1.6:/u01/EXPEDIENTE_DIGITAL` (SSH + rsync; **no** CIFS) |
| Mirror | `/mnt/data/backups/expediente-digital/current/` |
| Snapshots | `/mnt/data/backups/expediente-digital/snapshots/YYYYMMDD/` (hardlinks, 7 días) |
| Config | `/etc/alfa-one/expediente-backup.env` |
| Cron | `/etc/cron.d/alfa-one` → `03:30 UTC` diario |
| Log | `/var/log/alfa-one/cron-expediente-backup.log` + `.../logs/` |

```bash
# Verificar
bash scripts/verify-expediente-digital-backup.sh

# Dry-run
DRY_RUN=1 bash scripts/expediente-digital-backup.sh

# Sync manual (primer corrido ~250 GB; luego incremental)
bash scripts/expediente-digital-backup.sh
```

**Política de restore:** restaurar primero a un staging local; no empujar a producción ni al share Samba sin plan de corte. El mirror en `.229` no sustituye el origen en `.6`.

## Comportamiento en Alfa One

- Persona = **cédula** (normalizada). Se acumulan documentos de todos los `NO_EMPLE` de esa persona.
- Búsqueda: `/expediente-digital` (nombre, código o cédula).
- Detalle: `/expediente-digital/[cedula]` — ver/descargar PDF y subir nuevos.
- Al subir: se guarda el PDF en el share y se registra/actualiza `NAF5.ARPLEXPDIG` (compatible con Forms/APEX NAF). El archivo usa el empleo canónico (activo + ingreso más reciente) salvo que se elija otro código de la misma cédula.
- Metadatos: `ESTADO='D'` (convención APEX; no usar `'A'`). Si el tipo en `ARPLTDS` tiene `VENCE='N'`, las fechas van `1900-01-01`/`1900-01-01` (vigencia indefinida).

## Variables de entorno

```env
EXPEDIENTE_SMB_SHARE="//10.1.1.6/Expediente Digital"
EXPEDIENTE_SMB_USER="oracle"
# Si se omite EXPEDIENTE_SMB_PASSWORD, se reutiliza NAF_SMB_PASSWORD
EXPEDIENTE_SMB_PASSWORD=
# Opcional: montaje CIFS visible dentro del contenedor
# EXPEDIENTE_FS_ROOT=/data/expediente-digital
```

La imagen de producción incluye `smbclient` (runner Debian). En contenedores ya desplegados sin rebuild, instalar temporalmente `smbclient` o recrear con imagen nueva.

## Permisos

- `expedienteDigital.list` (view): búsqueda, detalle, descarga.
- `expedienteDigital.upload` (edit): carga de PDFs.

ADMIN tiene acceso total. Roles custom: Mantenimiento → Roles.

## Verificación rápida

```bash
# Desde el host / contenedor con smbclient
smbclient "//10.1.1.6/Expediente Digital" -U 'oracle%***' -c 'ls EMPLEADOS/E2'
```

## Privilegios Oracle (`ALFA_ONE`)

Para lectura y carga desde Alfa One:

```sql
GRANT SELECT, INSERT, UPDATE ON NAF5.ARPLEXPDIG TO ALFA_ONE;
GRANT SELECT ON NAF5.ARPLTDS TO ALFA_ONE;
GRANT SELECT ON NAF5.ARPLME TO ALFA_ONE;
```

(Ya aplicados en `10.1.1.6` al habilitar el módulo.)
