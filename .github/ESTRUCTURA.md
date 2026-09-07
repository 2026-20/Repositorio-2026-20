# Estructura del proyecto

Mapa rápido de qué hay en el repo y cómo está organizado — no reemplaza leer el código, solo ubica dónde está cada cosa antes de empezar a trabajar en una HU.

## Backend (`backend/`)

Spring Boot (Java 17, Maven). Paquete base: `cr.co.capris.reactivos`.

| Paquete | Qué contiene |
|---|---|
| `usuario/` | Entidades del dominio de usuarios: `Usuario`, `Rol`, `Empresa`, `EstadoUsuario` (enum), sus repositorios JPA, el DTO de respuesta (`UsuarioResumenDTO`, nunca expone el hash de contraseña) y el controlador de solo lectura (`UsuarioController`, `GET /api/usuarios`). |
| `auth/` | HU-001 (login), versión mínima pero funcional: `AutenticacionController` (`POST /api/auth/login`), `JwtService` (emite/valida el JWT), `JwtAuthenticationFilter` (lo lee en cada petición) y `ContextoUsuarioActualImpl` (implementación real del contrato de `seguridad/`). No cubre todavía todos los criterios de aceptación de HU-001 — ver `README.md` sección "Sprint 1" para el detalle de qué falta. |
| `seguridad/` | Infraestructura compartida para las HUs de seguridad del Sprint 1 — **no implementa ninguna HU en particular**, son contratos y piezas base: interfaces `ContextoUsuarioActual` (ya tiene implementación real en `auth/`) y `ValidadorPoliticaContrasena` (todavía sin implementación), `TokenRecuperacion` (recuperación de contraseña), `BitacoraSeguridad` + `BitacoraSeguridadService` (auditoría), las excepciones de dominio y el `GlobalExceptionHandler`. Ver `README.md` sección "Sprint 1" para el detalle de qué HU implementa qué. |
| `config/` | `SecurityConfig` (BCrypt + registra el filtro JWT; los endpoints siguen abiertos por ahora — hay un `TODO` explícito sobre cuáles deberían exigir sesión) y `WebConfig` (CORS para el frontend en desarrollo). |

**Migraciones:** `src/main/resources/db/migration/`, versionadas (`V1`, `V2`, `V3`...). Se aplican solas al arrancar el backend (Flyway). Convención: **un archivo nuevo por cambio, nunca editar uno que ya esté mergeado.**

**Pruebas:** `src/test/java/...` — `*Test.java` son unitarias (JUnit + Mockito + AssertJ, corren con `mvn test`, sin Docker). `*IT.java` son de integración contra Postgres real vía Testcontainers (corren con `mvn verify`, requieren Docker).

### Qué significa el sufijo de cada archivo
- Sin sufijo (`Usuario`, `Rol`) → entidad JPA (tabla de la base de datos).
- `...Repository` → repositorio Spring Data — solo firmas de métodos, Spring genera el SQL, no hay lógica propia ahí.
- `...Service` → lógica de negocio o infraestructura compartida.
- `...Controller` → expone endpoints REST.
- `...Exception` → excepción de dominio, capturada centralmente por `GlobalExceptionHandler`.
- `...DTO` → forma de datos que sale por la API — nunca se devuelve una entidad JPA directo, para no filtrar campos sensibles por accidente.

## Frontend (`frontend/`)

React + Vite, JavaScript puro (sin TypeScript). Hoy es solo estructura de carpetas — sin implementación todavía.

| Carpeta | Qué va ahí |
|---|---|
| `components/ui`, `layout`, `inventory`, `navigation`, `feedback` | Componentes reutilizables, agrupados por tipo. |
| `pages/` | Una carpeta por pantalla (`Login`, `Dashboard`, `Products`, `Admin/Users`...). |
| `context/` | Contextos de React (Auth, Theme, Connectivity...) — Context API + hooks nativos, sin Redux/Zustand. |
| `hooks/` | Hooks reutilizables sin JSX. |
| `services/` | Funciones que llaman al backend real (nada de mocks — eso quedó solo en la demo de referencia). |
| `utils/` | Funciones puras sin estado. |
| `styles/` | Tokens de diseño y estilos base globales. |
| `routes/` | Configuración de React Router. |
| `data/mocks/` | Datos simulados para construir pantallas antes de que el endpoint real del backend esté listo — temporal por diseño, se retira a medida que cada `service` se conecta al backend real. |
| `assets/` | Imágenes y otros archivos estáticos importados desde JS (convención de Vite). |
| `src/test/` | Configuración compartida de Vitest (`setup.js`). |
| `e2e/` | Pruebas Playwright de flujos completos. |

Las carpetas que todavía no tienen ningún archivo real llevan un `.gitkeep` — es solo un archivo vacío para que la carpeta exista en git (git no trackea carpetas vacías); se borra en cuanto se agregue el primer archivo de verdad ahí.

### Convención de pruebas frontend
- `Componente.test.jsx` → unitaria/componente, corre en jsdom (`npm test`).
- `algo.browser.test.js` → necesita navegador real (ej. almacenamiento local/OPFS), corre en Chromium vía Playwright (`npm run test:browser`).
- `e2e/*.spec.js` → flujo completo end-to-end (`npm run test:e2e`).

## CI (`.github/workflows/ci.yml`)

Corre en cada push/PR contra `main`: job `backend` (`mvn verify`, incluye Testcontainers) y job `frontend` (unitarias + OPFS + cobertura + E2E), en paralelo. Los runners de GitHub ya traen Docker, no requieren configuración adicional.

## Otros archivos en `.github/`

- `pull_request_template.md` — se precarga solo al abrir un PR nuevo en GitHub.
- `ESTRUCTURA.md` — este archivo.
