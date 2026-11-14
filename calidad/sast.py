"""Valida el resultado de SpotBugs y FindSecBugs, conservando los avisos revisados."""
from collections import Counter
from pathlib import Path
import json
import sys
import xml.etree.ElementTree as ET


archivo = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("backend/target/spotbugsXml.xml")
root = ET.parse(archivo).getroot()
revisiones = {
    "SPRING_ENDPOINT": "Inventario de endpoints. La cadena de Spring Security controla el acceso y las pruebas comprueban recursos y roles.",
    "SPRING_CSRF_PROTECTION_DISABLED": "API sin sesión de servidor ni cookies de autenticación. El JWT se adjunta en Authorization.",
    "IMPROPER_UNICODE": "El correo se coteja con una expresión ASCII y dominio exacto. La evidencia usa URI y exige HTTPS.",
}
clases_revisadas = {
    "SPRING_ENDPOINT": {"pe.orbitacampus.Api", "pe.orbitacampus.Cuentas"},
    "SPRING_CSRF_PROTECTION_DISABLED": {"pe.orbitacampus.Seguridad"},
    "IMPROPER_UNICODE": {"pe.orbitacampus.Reglas"},
}
bugs = []
for bug in root.findall("BugInstance"):
    clase = bug.find("Class").get("classname")
    tipo = bug.attrib["type"]
    revisado = clase in clases_revisadas.get(tipo, set())
    bugs.append({
        "tipo": tipo, "clase": clase, "categoria": bug.attrib["category"],
        "prioridad": int(bug.attrib["priority"]),
        "revision": revisiones[tipo] if revisado else None,
    })
pendientes = [b for b in bugs if b["categoria"] == "SECURITY" and b["revision"] is None]
resumen = {
    "herramientas": "SpotBugs + FindSecBugs",
    "avisos": dict(Counter(b["tipo"] for b in bugs)),
    "seguridadSinRevisar": len(pendientes),
    "detalle": bugs,
}
destino = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("evidencia-sast.json")
destino.write_text(json.dumps(resumen, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({k: v for k, v in resumen.items() if k != "detalle"}, ensure_ascii=False))
sys.exit(bool(pendientes))
