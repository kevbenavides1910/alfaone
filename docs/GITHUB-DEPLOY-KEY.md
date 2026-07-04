# Git push desde el servidor (10.1.1.222)

El servidor usa una **Deploy Key** SSH (solo este repositorio).

## 1. Registrar la clave en GitHub (una vez)

1. Abra: https://github.com/kevbenavides1910/Presupuestos-Alfa/settings/keys  
2. **Add deploy key**
3. Title: `servidor-10.1.1.222`
4. Key: pegue el contenido de:

```bash
cat ~/.ssh/id_ed25519_github.pub
```

5. Marque **Allow write access** (necesario para `git push`).

## 2. Probar y subir

```bash
ssh -T git@github.com
# Debe responder: Hi kevbenavides1910/Presupuestos-Alfa! ...

cd ~/presupuestos-alfa
git push origin main
```

## Archivos en el servidor

| Archivo | Uso |
|---------|-----|
| `~/.ssh/id_ed25519_github` | Clave privada (no compartir) |
| `~/.ssh/id_ed25519_github.pub` | Clave pública (va en GitHub) |
| `~/.ssh/config` | Usa esa clave solo para `github.com` |

Remote del repo: `git@github.com:kevbenavides1910/Presupuestos-Alfa.git`
