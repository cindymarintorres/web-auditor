# 🚀 SPA Network Auditing, E2E QA & Media Processing Microservice

## 📌 Propuesta y Fin del Proyecto

Microservicio backend de grado de producción construido con **Node.js, Express, Playwright y FFmpeg**, diseñado bajo los principios de **Clean Architecture** y empaquetado mediante un contenedor **Docker multi-stage**. 

La herramienta actúa como un **auditor de rendimiento web, monitor de integridad de red, validador de pruebas E2E** para aplicaciones de página única (SPA) y procesador de flujos multimedia (haciendo merging de manifiestos HLS en `.mp4`).

---

## 🏗️ Arquitectura Técnica y Componentes

El proyecto sigue una estructura limpia en `src/` dividida en capas:
1. **Docker Multi-stage / Playwright Jammy:** Imagen optimizada que integra nativamente `Chromium` para Playwright y los binarios de `FFmpeg` en la capa base.
2. **Servidor Express & Capa HTTP (`src/http/`):** Expone endpoints seguros protegidos por API Key para iniciar auditorías y procesar flujos multimedia bajo demanda.
3. **Motor Playwright & Collectores (`src/infrastructure/`):** Abre instancias controladas, gestiona iframes, ejecuta acciones secuenciales (`click`, `fill`, `wait`, etc.) y recolecta métricas de red, consola y salud de video.
4. **Procesador Multimedia (`src/application/storage/videos`):** Envuelve comandos de FFmpeg para combinar flujos de video y audio capturados directamente desde el backend.

---

## 📂 Estructura del Proyecto

```text
web-auditor/
│
├── Dockerfile              # Configuración multi-stage (Base -> Deps -> Build -> Runtime con FFmpeg)
├── docker-compose.yaml     # Orquestador con límites de recursos, shm_size y healthcheck de Node
├── package.json            # Dependencias del proyecto
├── pnpm-lock.yaml          # Control estricto de dependencias con pnpm
├── tsconfig.json           # Configuración de TypeScript
├── src/
│   ├── application/        # Casos de uso y almacenamiento de archivos (/storage/videos)
│   ├── domain/             # Tipos, entidades y contratos principales
│   ├── http/               # Controladores, rutas de Express y validadores
│   └── infrastructure/     # Runners de Playwright, colectores e integración con FFmpeg
└── outputs/                # Artefactos y reportes generados

```

---

## ⚙️ Configuración y Despliegue con Docker

1. Configura tus variables de entorno basándote en el archivo de ejemplo:
```bash
cp .env.example .env

```


2. Levanta el microservicio utilizando Docker Compose:
```bash
docker compose up --build -d

```



---

## 🧪 Pruebas de la API (cURL)

### 1. Ejecutar una auditoría web (`/api/audit`)

```bash
curl -X POST http://localhost:3000/api/audit \
  -H "x-api-key: $(grep ^API_KEY= .env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"url":"[https://tu-sitio.com](https://tu-sitio.com)"}'

```

### 2. Procesar y fusionar flujos multimedia (`/api/process-media`)

```bash
curl -X POST http://localhost:3000/api/process-media \
  -H "x-api-key: $(grep ^API_KEY= .env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "[https://tu-servidor.com/path/al/manifiesto_video.m3u8](https://tu-servidor.com/path/al/manifiesto_video.m3u8)",
    "audioUrl": "[https://tu-servidor.com/path/al/manifiesto_audio.m3u8](https://tu-servidor.com/path/al/manifiesto_audio.m3u8)"
  }'

```