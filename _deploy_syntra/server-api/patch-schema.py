from pathlib import Path
import re
p = Path("/home/soporte-ti/presupuestos-alfa/prisma/schema.prisma")
t = p.read_text(encoding="utf-8")
pattern = r"(model PatrolDevice \{[\s\S]*?label\s+String\?\n)(  isActive)"
if "PatrolDevice" in t and "locationDesc" not in t.split("model PatrolDevice")[1].split("model ")[0]:
    t2, n = re.subn(pattern, r"\1  locationDesc String?\n  positionId   String?\n  assetId      String?\n\2", t, count=1)
    if n:
        p.write_text(t2, encoding="utf-8")
        print("PatrolDevice schema patched")
    else:
        print("regex no match")
        raise SystemExit(1)
else:
    print("already patched or missing model")
