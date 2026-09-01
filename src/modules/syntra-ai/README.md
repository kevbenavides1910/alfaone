# Alfa One — Asistente Syntra IA

Port del módulo Odoo `syntra_ai_assistant` para la plataforma web Alfa One.

## Origen

- Código Odoo: [`code/odoo-addons/syntra_ai_assistant`](../../../odoo-addons/syntra_ai_assistant/)
- Fuente original: `/mnt/data/projects/odoo18-alfa/extra-addons/syntra_ai_assistant/`

## Funcionalidad

- Chat flotante en toda la app autenticada
- Memoria persistente («recuerda…» / «olvida…»)
- Skills de equipo («aprende…» / /learn)
- Conocimiento estático en `knowledge/*.md`
- Historial de conversaciones por usuario

## Configuración

Variables de entorno (`.env`):

```env
SYNTra_AI_ENABLED=true
SYNTra_AI_PROVIDER=opencode_go
SYNTra_AI_API_KEY=...
SYNTra_AI_BASE_URL=https://opencode.ai/zen/go/v1
SYNTra_AI_MODEL=kimi-k2.7-code
```

Si faltan env vars, se leen de la tabla `syntra_ai_settings` (fila `default`).

## API

- `POST /api/syntra-ai/chat` — enviar mensaje
- `GET /api/syntra-ai/sessions` — listar conversaciones del usuario
