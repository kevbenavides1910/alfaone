#!/usr/bin/env python3
from pathlib import Path

base = Path("/home/soporte-ti/presupuestos-alfa")

# Login: accessToken alias
login_path = base / "src/app/api/syntra/auth/login/route.ts"
login = login_path.read_text()
if "accessToken" not in login:
    login = login.replace(
        "token: result.token,",
        "token: result.token,\n      accessToken: result.token,",
    )
    login_path.write_text(login)
    print("login patched")

# Routes: DESC_UBI for Android
routes_path = base / "src/modules/syntra/services/patrol-routes-service.ts"
routes = routes_path.read_text()
if "DESC_UBI" not in routes:
    routes = routes.replace(
        "export async function getPatrolRoutesForDevice(deviceId: string) {",
        "export async function getPatrolRoutesForDevice(deviceId: string) {\n"
        "  const device = await prisma.patrolDevice.findUnique({ where: { id: deviceId } });",
    )
    routes = routes.replace(
        'return {\n      COD_ERROR: "1",',
        'return {\n      COD_ERROR: "1",\n      DESC_UBI: device?.label ?? "",\n'
        '      COD_ERROR_UBI: "0000",\n      EXIST_FORM: "N",',
    )
    routes = routes.replace(
        'return {\n    COD_ERROR: "0",',
        'return {\n    COD_ERROR: "0",\n    DESC_UBI: device?.label ?? "",\n'
        '    COD_ERROR_UBI: "0000",\n    EXIST_FORM: "N",',
    )
    routes_path.write_text(routes)
    print("routes patched")

print("done")
