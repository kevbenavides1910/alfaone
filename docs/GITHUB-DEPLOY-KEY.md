# Git push desde el servidor (10.1.1.229)

El servidor de **producción** usa una **Deploy Key** SSH (solo este repositorio).

> **Nota:** El VPS `10.1.1.222` no es el entorno activo. Producción está en **10.1.1.229**.

## 1. Registrar la clave en GitHub (una vez)

1. Abra: https://github.com/kevbenavides1910/alfaone/settings/keys  
2. **Add deploy key**
3. Title: `servidor-10.1.1.229`
4. Key: pegue el contenido de:

```bash
cat ~/.ssh/id_ed25519_github.pub
```

5. Marque **Allow write access** (necesario para `git push`).

## 2. Probar y subir

```bash
ssh -T git@github.com
# Debe responder: Hi kevbenavides1910/alfaone! ...

cd /mnt/data/projects/presupuestos-alfa/code/presupuestos-alfa
git pull --ff-only origin main
```

## 3. Desplegar (sin borrar datos)

```bash
cd /mnt/data/projects/presupuestos-alfa/code/presupuestos-alfa
bash scripts/deploy-safe-production.sh
```

## Archivos en el servidor

| Archivo | Uso |
|---------|-----|
| `~/.ssh/id_ed25519_github` | Clave privada (no compartir) |
| `~/.ssh/id_ed25519_github.pub` | Clave pública (va en GitHub) |
| `~/.ssh/config` | Usa esa clave solo para `github.com` |

Remote del repo: `git@github.com:kevbenavides1910/alfaone.git`
