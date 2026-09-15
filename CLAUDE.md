# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Sistema de Gestión y Control de Reactivos — CAPRIS / CCSS (UNA Ingeniería de Sistemas, Proyecto #20). Offline-first app for CAPRIS field staff to audit reagent inventory in CCSS labs against the institutional ERP and transmit counts for billing.

Read `.github/ESTRUCTURA.md` for the folder-by-folder map before working in either `backend/` or `frontend/` — this file covers commands and cross-file architecture, not file layout.

## Commands

### Backend (`cd backend`)
```bash
mvn spring-boot:run    # run the API, http://localhost:8080
mvn test                # unit tests only (*Test.java), no Docker required
mvn verify               # unit + integration tests (*IT.java, Testcontainers — requires Docker) + JaCoCo coverage
mvn test -Dtest=ClassName#methodName   # run a single test
```

### Frontend (`cd frontend`)
```bash
npm install
npm run dev             # http://localhost:5173
npm run lint             # oxlint
npm test                 # unit/component tests, jsdom (Vitest)
npm run test:watch       # same, watch mode
npm run test:browser     # OPFS/local-storage tests, real Chromium via Playwright (jsdom can't do OPFS)
npm run test:coverage
npm run test:e2e         # Playwright end-to-end
npm test -- path/to/File.test.jsx        # run a single test file
npm test -- -t "test name"                # run tests matching a name
```

### Local database
PostgreSQL is required (matches production, which runs on OCI Database with PostgreSQL — there is no H2/in-memory fallback for `mvn spring-boot:run`, though Testcontainers handles it for `mvn verify`):
```bash
docker run --name capris-postgres -e POSTGRES_USER=capris -e POSTGRES_PASSWORD=capris_dev \
  -e POSTGRES_DB=capris_reactivos -p 5432:5432 -d postgres:16-alpine
```
Flyway migrations apply automatically on backend startup — never run them manually. Seed users (from `V2__seed_usuarios_iniciales.sql`): `wmolina` / `Capris2026!` / `empresaId: 1` (Administrador) is the standard login for manual testing.

### CI
`.github/workflows/ci.yml` runs on every push/PR to `main`: `backend` job runs `mvn verify` (includes Testcontainers, GitHub runners have Docker preinstalled); `frontend` job runs unit tests, OPFS/browser tests, coverage, and E2E, in that order.

## Architecture

### Backend — `cr.co.capris.reactivos` (Spring Boot 4.1.1, Java 17)

- **`usuario/`** — User domain entities (`Usuario`, `Rol`, `Empresa`, `EstadoUsuario` enum), their Spring Data repositories, and a read-only `UsuarioController` (`GET /api/usuarios`). Responses always go through `UsuarioResumenDTO` — entities are never returned directly from a controller, specifically to avoid leaking the password hash.
- **`auth/`** — HU-001 (login), a minimal-but-real implementation other HUs build on: `AutenticacionController` (`POST /api/auth/login`), `JwtService` (issues/validates the JWT), `JwtAuthenticationFilter` (reads it on every request, registered in `SecurityConfig`), and `ContextoUsuarioActualImpl` (the real implementation of the `seguridad/` contract). It does not yet cover all of HU-001's acceptance criteria — see below.
- **`seguridad/`** — Shared infrastructure for the Sprint 1 security/user HUs. **This package does not implement any single HU** — it's contracts and shared pieces other HUs plug into: `ContextoUsuarioActual` (interface; real impl lives in `auth/`), `ValidadorPoliticaContrasena` (interface, not yet implemented — owned by HU-042), `TokenRecuperacion` + repository (15-min OTP recovery token, owned by HU-046), `BitacoraSeguridad` + `BitacoraSeguridadService.registrar(...)` (security audit log — each HU calls it with the `TipoEventoSeguridad` that applies to its own event), and the domain exceptions + `GlobalExceptionHandler` (already complete — each HU should throw the exception that matches its case rather than building its own error handling; each exception maps to one HTTP status/error code in `GlobalExceptionHandler`).
- `Usuario.intentosFallidos` / `Usuario.bloqueadoHasta` (columns added in `V3__base_seguridad_sprint1.sql`) belong to HU-043: the login flow already *reads* `bloqueadoHasta` and throws `CuentaBloqueadaException` if it's set, but nothing increments `intentosFallidos` or sets `bloqueadoHasta` yet — that logic is HU-043's to add (see the `TODO (HU-043)` comments in `AutenticacionController`).
- **`config/`** — `SecurityConfig` (BCrypt encoder, registers `JwtAuthenticationFilter`; **all endpoints are currently `permitAll()`** — there's an explicit TODO to decide which routes require a valid session, intentionally left open so it doesn't block parallel HU work) and `WebConfig` (CORS for local frontend dev).

Naming convention (no suffix = JPA entity, `...Repository` = Spring Data interface only, `...Service` = business/shared logic, `...Controller` = REST endpoints, `...Exception` = domain exception caught by `GlobalExceptionHandler`, `...DTO` = API response shape).

**Migrations**: `backend/src/main/resources/db/migration/`, Flyway, strictly append-only — new HUs add a new `V4__...`, `V5__...` file; never edit `V1`–`V3` which are already merged.

**Tests**: `*Test.java` = unit (JUnit 5 + Mockito + AssertJ, `mvn test`, no Docker). `*IT.java` = integration against real Postgres via Testcontainers (`mvn verify`, needs Docker).

**Config/secrets**: `app.jwt.secret` in `application.yml` is dev-only; production overrides it via `APP_JWT_SECRET` env var — never commit a real secret there.

### Frontend — React + Vite, plain JavaScript (no TypeScript)

Mostly scaffolding today (folders hold `.gitkeep` placeholders, removed once real files land):
- `components/{ui,layout,inventory,navigation,feedback}/` — reusable components grouped by type.
- `pages/<ScreenName>/` — one folder per screen (`Login`, `Dashboard`, `Admin/Users`, etc).
- `context/` — Context API + native hooks for cross-cutting state (Auth, Theme, Connectivity...) — no Redux/Zustand.
- `hooks/` — reusable hooks without JSX.
- `services/` — functions that call the real backend; no mocks live here.
- `data/mocks/` — mock data for building screens before the real backend endpoint exists; removed as each `service` connects to the real API.
- `utils/` — stateless pure functions.
- `routes/` — React Router config.

Test naming convention: `Component.test.jsx` → unit/component, runs in jsdom via `npm test`. `thing.browser.test.js` → needs a real browser (e.g. OPFS/local storage), runs in Chromium via `npm run test:browser`. `e2e/*.spec.js` → full end-to-end flow via `npm run test:e2e`.

## Sprint 1 context (in progress — see README.md "Sprint 1" for full detail)

Sprint 1 (Sep 07–25) is 10 HUs from one group (HU-001, HU-002, HU-023, HU-042 through HU-048) worked in parallel by 5 people, all touching the same `Usuario` entity and "current authenticated user" concept — hence the shared `seguridad/` package described above. Convention: one branch per HU (`feature/HU-042-validacion-password`).

HU-001 (login) is intentionally left incomplete so other HUs aren't blocked: still missing are per-criterion error messages (today everything returns one generic error), the endpoint to list companies for the login selector, integration with HU-036/037/038, and deciding which endpoints require an authenticated session (`SecurityConfig` has an explicit `TODO`). Look for `TODO (HU-043)` comments in `AutenticacionController` marking where the failed-login-attempt counter should be wired in.
