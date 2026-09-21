# Sistema de Gestión y Control de Reactivos — CAPRIS / CCSS

Proyecto de Ingeniería de Sistemas (UNA, Proyecto #20). Aplicación offline-first para que el personal de campo de **CAPRIS S.A.** audite el inventario de reactivos en los laboratorios de la **CCSS**, comparándolo contra el ERP institucional y transmitiendo los conteos para facturación.

Este README cubre cómo levantar y trabajar en el repo. Para un mapa rápido de cómo está organizado el código (qué hay en cada carpeta, sin entrar en el detalle que solo se entiende leyendo el código), ver **[`.github/ESTRUCTURA.md`](.github/ESTRUCTURA.md)**.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Backend | Spring Boot 4.1.1 (Java 17), Maven |
| Frontend | React + Vite, JavaScript puro (sin TypeScript) |
| Base de datos | PostgreSQL, migraciones con Flyway |
| Pruebas backend | JUnit 5, Mockito, AssertJ, Testcontainers |
| Pruebas frontend | Vitest, React Testing Library, Playwright |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |

## Estructura del repositorio

```
backend/    API REST (Spring Boot)
frontend/   PWA (React + Vite)
.github/    Workflows de CI, plantilla de PR, mapa de estructura
```

## Requisitos previos

- Java 17+ (recomendado [Temurin](https://adoptium.net/))
- Maven 3.9+
- Node.js 20+ (LTS) y npm
- Docker — para levantar PostgreSQL localmente y para que corran las pruebas de integración con Testcontainers

## Base de datos local

El proyecto usa PostgreSQL (igual que producción, que corre sobre OCI Database with PostgreSQL). La forma más simple de tenerlo en desarrollo es un contenedor:

```bash
docker run --name capris-postgres \
  -e POSTGRES_USER=capris \
  -e POSTGRES_PASSWORD=capris_dev \
  -e POSTGRES_DB=capris_reactivos \
  -p 5432:5432 \
  -d postgres:16-alpine
```

Si prefieren no usar Docker, pueden instalar PostgreSQL nativamente desde [postgresql.org](https://www.postgresql.org/download/) y crear a mano una base `capris_reactivos` con usuario `capris`/contraseña `capris_dev` (o ajustar `backend/src/main/resources/application.yml` a sus propias credenciales).

Para inspeccionar la base visualmente, recomendamos **[DBeaver](https://dbeaver.io/)** (gratuito, multiplataforma) — conectar contra `localhost:5432`, base `capris_reactivos`, usuario `capris`.

> **Si ya tenés un PostgreSQL instalado en la máquina ocupando el 5432** (pasa en
> algunas laptops del equipo), el contenedor puede quedar detrás de esa instancia.
> Dos opciones: detener el servicio nativo y arrancar el contenedor en 5432; o
> dejar el contenedor en otro puerto (ej. `-p 5433:5432`) y levantar el backend con
> `SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5433/capris_reactivos`
> (solo como variable de entorno del proceso, no se commitea en `application.yml`).

Las migraciones (Flyway) se aplican **automáticamente** al arrancar el backend — no hay que correr nada manualmente. El esquema y los datos semilla están en `backend/src/main/resources/db/migration/`.

## Cómo levantar el backend

```bash
cd backend
mvn spring-boot:run
```

Queda disponible en `http://localhost:8080`. Endpoints de prueba: `GET http://localhost:8080/api/usuarios` y `POST http://localhost:8080/api/auth/login`.

El secreto para firmar los JWT (`app.jwt.secret` en `application.yml`) es **solo de desarrollo local** — en producción se sobreescribe con la variable de entorno `APP_JWT_SECRET`, nunca se comitea el secreto real.

## Correo en desarrollo (HU-047)

El alta de usuarios (HU-047) envía un correo con las credenciales iniciales. En desarrollo local, `application.yml` apunta a **MailHog** — un servidor SMTP de prueba que atrapa los correos en vez de entregarlos a una bandeja real, y los muestra en una interfaz web. Levantarlo con:

```bash
docker run --name capris-mailhog -p 1025:1025 -p 8025:8025 -d mailhog/mailhog
```

Los correos "enviados" se ven en **http://localhost:8025**. El backend arranca normalmente sin MailHog corriendo (no valida la conexión SMTP al iniciar, solo al momento real de enviar un correo) — si MailHog no está levantado, el alta de usuario igual se completa, solo que el correo no llega a ningún lado y queda registrado el fallo en la bitácora de seguridad.

Usar un SMTP real (para que el correo llegue a una bandeja de verdad) queda pendiente como decisión de equipo — ver `spring.mail.*` en `application.yml`.

## Cómo levantar el frontend

```bash
cd frontend
npm install
npm run dev
```

Queda disponible en `http://localhost:5173`.

## Usuarios de desarrollo (datos semilla)

La migración `V2__seed_usuarios_iniciales.sql` crea 3 usuarios reales de CAPRIS para poder probar contra datos válidos desde el día uno:

| Username | Nombre | Rol | Contraseña (solo local) |
|---|---|---|---|
| `amelendez` | Andrey Meléndez Ovares | Usuario de Campo | `Capris2026!` |
| `arcea` | Adrián Arce Soto | Usuario de Campo | `Capris2026!` |
| `wmolina` | William A. Molina Quirós | Administrador | `Capris2026!` |

Esta contraseña compartida es **exclusiva de desarrollo local** — nunca se usa así en producción. El flujo real (HU-047) genera una contraseña provisional (OTP) y la envía por correo; nadie, ni el administrador, la ve en texto plano. Las cédulas de estos tres usuarios no fueron proporcionadas, así que quedaron marcadas como `PENDIENTE-00N` en la semilla — corregir cuando se tenga el dato real.

## Pruebas

**Backend** (`cd backend`):
```bash
mvn test      # unitarias (JUnit + Mockito + AssertJ), sin Docker
mvn verify    # + integración con Testcontainers (requiere Docker) + reporte de cobertura JaCoCo
```

**Frontend** (`cd frontend`):
```bash
npm test              # unitarias/componente (Vitest + React Testing Library)
npm run test:browser  # almacenamiento local (OPFS) en Chromium real vía Playwright
npm run test:coverage # cobertura
npm run test:e2e      # end-to-end (Playwright)
```

## Sprint 1 — base compartida para las HUs de seguridad/usuarios

El Sprint 1 (Sep 07 - Sep 25) son 10 HUs de un mismo grupo trabajadas por 5 personas en paralelo: HU-001, HU-002, HU-023, HU-042 a HU-048. Todas tocan la misma entidad `Usuario` y la misma noción de "usuario autenticado", así que antes de repartir el trabajo se dejó una base compartida en `backend/src/main/java/cr/co/capris/reactivos/seguridad/` para que nadie compita por los mismos archivos ni reinvente lo mismo. Esa carpeta **no implementa ninguna HU** — son contratos y piezas de infraestructura para que cada quien conecte su lógica:

| Qué hay | Para qué HU | Quién implementa la lógica real |
|---|---|---|
| `ContextoUsuarioActual` — **ya tiene implementación real** (`auth/ContextoUsuarioActualImpl`) | HU-023, HU-044, HU-045 necesitan saber "quién es el usuario actual" | HU-001 dejó lo mínimo funcionando (ver abajo); glorimojica completa el resto |
| `ValidadorPoliticaContrasena` (interfaz, todavía sin implementación) | HU-044, HU-045, HU-046 necesitan validar la contraseña nueva | HU-042 |
| `TokenRecuperacion` + su repositorio | Tabla de apoyo para el token OTP de 15 min | HU-046 (generarlo, enviarlo, validar el límite de 3 intentos) |
| `BitacoraSeguridad` + `BitacoraSeguridadService.registrar(...)` | HU-043, HU-047 y HU-048 piden explícitamente auditar el evento | Cada HU decide cuándo llamarlo, con qué `TipoEventoSeguridad` |
| `usuario.intentos_fallidos` / `usuario.bloqueado_hasta` (columnas nuevas) | HU-043 | HU-043 (la lógica de cuándo incrementar/bloquear) — el login minimo ya *respeta* `bloqueado_hasta` si está fijado, pero no lo fija |
| Excepciones de dominio + `GlobalExceptionHandler` | Todas — un solo formato de error para toda la API | Ya está completo, solo hay que lanzar la excepción que corresponda |

### HU-001 — quedó avanzada, no terminada

Para que el resto de las HUs de este sprint no tuvieran que esperar a que HU-001 estuviera 100% lista, se dejó un **login mínimo pero real** en `backend/.../auth/`: `POST /api/auth/login` valida usuario/contraseña/empresa contra la base, respeta `bloqueado_hasta` si ya está fijado, y emite un JWT (`JwtService`) que `JwtAuthenticationFilter` lee en cada petición para rellenar `ContextoUsuarioActual`. Con esto, HU-023/044/045 ya pueden trabajar contra un login que funciona de verdad.

**Lo que falta para cerrar HU-001** : mensajes de error específicos por cada criterio de aceptación (hoy todos devuelven el mismo genérico), el endpoint para listar las empresas del selector de login, integración con HU-036/037/038, y decidir qué endpoints deben exigir sesión válida (hoy todo sigue abierto, `SecurityConfig` tiene el `TODO`). Hay comentarios `TODO (HU-043)` en `AutenticacionController` marcando dónde conectar el contador de intentos fallidos.

Usuario de prueba para el login: `wmolina` / `Capris2026!` / `empresaId: 1`.

### HU-046 — Recuperación de contraseña por OTP

Flujo de 3 pasos: pedir un código (OTP) al correo, validarlo con una sesión
temporal restringida, y fijar la contraseña nueva. Cumple los 5 criterios de
aceptación (mensaje offline desde el frontend, mensaje genérico que no revela
si el correo existe, OTP vence a los 15 min y es de un solo uso, sesión
temporal que no sirve como sesión normal, y tope de 3 intentos).

**Endpoints públicos** (en `RecuperacionContrasenaController`):

| Método | Endpoint | Qué hace |
|---|---|---|
| `POST` | `/api/auth/recuperacion/solicitar` | Envía el OTP al correo (si la cuenta existe y está activa) |
| `POST` | `/api/auth/recuperacion/validar-otp` | Valida OTP; devuelve `tokenSesionTemporal` |
| `POST` | `/api/auth/recuperacion/nueva-contrasena` | Cambia la contraseña usando la sesión temporal |

**Correo por interfaz intercambiable** — `EmailService` con tres
implementaciones vía `app.email.proveedor` (la misma interfaz la usan otras
HU que mandan correo, p. ej. HU-047 credenciales iniciales):
- `log` (default): escribe el correo en la consola del backend. Así `mvn test`,
  `mvn verify` y levantar el proyecto en cualquier laptop **no necesitan API
  key**. CI nunca llama a ningún proveedor real.
- `sendgrid`: envía de verdad (activar solo con la variable de entorno
  `APP_EMAIL_PROVEEDOR=sendgrid` en el servidor real).
- `smtp`: envía vía JavaMailSender (MailHog en desarrollo en `localhost:1025`
  sin credenciales) — útil mientras no haya un dominio propio verificado en
  SendGrid, sin depender de ninguna API key.

**Variables de entorno nuevas** (todas con default seguro en `application.yml`
para desarrollo):

| Variable | Default local | Para qué |
|---|---|---|
| `APP_EMAIL_PROVEEDOR` | `log` | `log`, `sendgrid` o `smtp` |
| `APP_SENDGRID_API_KEY` | (vacío) | API Key de SendGrid (permiso solo Mail Send) — nunca comitear |
| `APP_EMAIL_SMTP_HOST` | `localhost` | host SMTP (MailHog por defecto) |
| `APP_EMAIL_SMTP_PORT` | `1025` | puerto SMTP (1025 = MailHog) |
| `APP_EMAIL_SMTP_USERNAME` | (vacío) | usuario SMTP si el servidor exige autenticación |
| `APP_EMAIL_SMTP_PASSWORD` | (vacío) | contraseña SMTP si el servidor exige autenticación |
| `APP_EMAIL_REMITENTE` | `recuperacioncapris@hotmail.com` | dirección "de" del correo |
| `APP_EMAIL_ASINCRONO` | `true` | envío del OTP en segundo plano (fire-and-forget, evita filtrar por temporización si el correo existe) — `false` solo en pruebas de integración |
| `APP_CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | orígenes permitidos por CORS (probarlo también al dejar el backend en una URL distinta) |
| `APP_JWT_SECRET` | (ya existía) | secreto de firma — en producción siempre por entorno |
| `VITE_API_BASE_URL` (frontend) | `http://localhost:8080` | URL base del backend para el frontend |

**El OTP nunca se guarda en texto plano**: se guarda su hash BCrypt
(`token_recuperacion.token`, migración `V8__recuperacion_password_otp.sql`).
La sesión temporal es un JWT con claim `proposito=recuperacion_password`
(10 min por defecto) que `JwtAuthenticationFilter` **nunca** trata como sesión
normal, es **de un solo uso**: al completar `nueva-contrasena` se revoca su
`jti` (misma tabla `token_sesion_revocado` de HU-002) y reutilizar el mismo
JWT es rechazado. El historial de contraseñas (`historial_contrasena`, también
V8) impide reutilizar una contraseña usada recientemente, y lo comparten
HU-044/045.

**Cómo probarlo:**
```bash
cd backend
mvn spring-boot:run        # correo en modo "log": el OTP sale en la consola
```
Docker: hay `backend/Dockerfile` listo (compila en Java 17, imagen final solo
JRE+jar, corre como usuario no-root). Detalle de despliegue y comparativa
Railway / Render / OCI para decidir en la reunión con la empresa: ver
**[`docs/GUIA_HU-046.md`](docs/GUIA_HU-046.md)** y la sección 10 de la guía.

Convenciones para trabajar en paralelo sin chocar:
- Una rama por HU (ej. `feature/HU-042-validacion-password`).
- Cada HU que necesite cambiar el esquema agrega una migración Flyway **nueva** (`V4__...`, `V5__...`) — nunca editar `V1`/`V2`/`V3` que ya existen.

## Integración continua

Cada push o PR contra `main` corre automáticamente ambos conjuntos de pruebas en GitHub Actions (`.github/workflows/ci.yml`), incluyendo las de integración con Testcontainers — los runners de GitHub ya traen Docker, no requiere configuración adicional.

## Documentación

- [`.github/ESTRUCTURA.md`](.github/ESTRUCTURA.md) — mapa de qué hay en cada carpeta del código y las convenciones de nombres.
- [`docs/GUIA_HU-046.md`](docs/GUIA_HU-046.md) — decisiones de implementación, configuración de SendGrid y despliegue de la recuperación de contraseña (HU-046).

---

Este README se actualiza a medida que el proyecto avanza — si algo aquí queda desactualizado (nuevos pasos de setup, nuevas variables de entorno, nuevos comandos), corregirlo aquí mismo en vez de dejarlo solo en la conversación del equipo.
