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
| Pruebas frontend | Vitest, React Testing Library, Playwright (OPFS), Cypress (E2E) |
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

## Correo en desarrollo

El alta de usuarios y la recuperación de contraseña envían correo a través de `EmailService` (ver la sección "Recuperación de contraseña" más abajo para el detalle completo de las tres implementaciones). Por defecto (`app.email.proveedor=log`) no hace falta nada más: el correo se escribe en la consola del backend, no se abre ninguna conexión SMTP real, y ni `mvn test`/`mvn verify` ni levantar el proyecto en una laptop nueva dependen de MailHog.

Si querés ver el correo real en una bandeja de prueba, activá `app.email.proveedor=smtp` (variable de entorno `APP_EMAIL_PROVEEDOR=smtp`) y levantá **MailHog**:

```bash
docker run --name capris-mailhog -p 1025:1025 -p 8025:8025 -d mailhog/mailhog
```

Los correos "enviados" se ven en **http://localhost:8025**. El backend arranca normalmente sin MailHog corriendo (no valida la conexión SMTP al iniciar, solo al momento real de enviar un correo) — si MailHog no está levantado, el alta de usuario igual se completa, solo que el correo no llega a ningún lado y queda registrado el fallo en la bitácora de seguridad.

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

Esta contraseña compartida es **exclusiva de desarrollo local** — nunca se usa así en producción. El flujo real de alta de usuarios genera una contraseña provisional (OTP) y la envía por correo; nadie, ni el administrador, la ve en texto plano. Las cédulas de estos tres usuarios no fueron proporcionadas, así que quedaron marcadas como `PENDIENTE-00N` en la semilla — corregir cuando se tenga el dato real.

## Funcionalidades

### Autenticación y seguridad

`POST /api/auth/login` valida usuario/contraseña/empresa/estado contra la base y emite un JWT (`JwtService`) que `JwtAuthenticationFilter` lee en cada petición para rellenar `ContextoUsuarioActual` (quién es el usuario que hace la petición). El mensaje de error es el mismo para usuario inexistente, contraseña incorrecta, empresa incorrecta y cuenta inactiva **a propósito** — evita que alguien enumere qué usernames existen en el sistema probando al azar (incluso el tiempo de respuesta está igualado entre usuario existente e inexistente).

`SecurityConfig` exige JWT válido en toda la API salvo `/api/auth/login`, `/api/empresas` y `/api/auth/recuperacion/**`; crear, inactivar, reactivar y desbloquear usuarios exige además el rol Administrador.

`BloqueoCuentaService` bloquea la cuenta por 7 minutos tras 4 intentos fallidos consecutivos (aplica tanto al login como al cambio voluntario de contraseña), y queda registrado en la bitácora de seguridad (`BitacoraSeguridad`).

Mientras una cuenta siga con contraseña temporal (`PENDIENTE_PRIMER_INGRESO`), `JwtAuthenticationFilter` la restringe a solo cambiar su contraseña o cerrar sesión, sin importar el rol.

**Pendiente**: integración con el ERP institucional (validar activo, cargar rutas, iniciar jornada).

### Recuperación de contraseña (OTP)

Flujo de 3 pasos: pedir un código (OTP) al correo, validarlo con una sesión
temporal restringida, y fijar la contraseña nueva. No revela si el correo
existe (mensaje genérico siempre), el OTP vence a los 15 min y es de un solo
uso, la sesión temporal no sirve como sesión normal, y hay un tope de 3
intentos.

**Endpoints públicos** (en `RecuperacionContrasenaController`):

| Método | Endpoint | Qué hace |
|---|---|---|
| `POST` | `/api/auth/recuperacion/solicitar` | Envía el OTP al correo (si la cuenta existe y está activa) |
| `POST` | `/api/auth/recuperacion/validar-otp` | Valida OTP; devuelve `tokenSesionTemporal` |
| `POST` | `/api/auth/recuperacion/nueva-contrasena` | Cambia la contraseña usando la sesión temporal |

**Correo por interfaz intercambiable** — `EmailService` con tres
implementaciones vía `app.email.proveedor` (la misma interfaz la usa también
el alta de usuarios, para las credenciales iniciales):
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
`jti` (misma tabla `token_sesion_revocado` del cierre de sesión) y reutilizar
el mismo JWT es rechazado. El historial de contraseñas (`historial_contrasena`,
también V8) impide reutilizar una contraseña usada recientemente, y lo
comparte el cambio de contraseña (ver abajo).

**Cómo probarlo:**
```bash
cd backend
mvn spring-boot:run        # correo en modo "log": el OTP sale en la consola
```
Docker: hay `backend/Dockerfile` listo (compila en Java 17, imagen final solo
JRE+jar, corre como usuario no-root). La comparativa de plataforma de
despliegue (Railway / Render / OCI) todavía está pendiente de decidir con
la empresa.

### Cambio de contraseña

- **Obligatorio en primer ingreso**: un usuario recién creado queda en estado
  `PENDIENTE_PRIMER_INGRESO` con una contraseña temporal; la única acción
  posible hasta que la cambie es esa o cerrar sesión (lo aplica
  `JwtAuthenticationFilter`, no solo el frontend).
- **Voluntario desde Ajustes**: cualquier usuario activo puede cambiar su
  contraseña ahí — exige la contraseña actual, cuenta para el bloqueo de
  cuenta si falla, y no permite repetir la contraseña actual ni una usada
  recientemente.

### Gestión de usuarios

El alta de un usuario nuevo siempre queda en la empresa del administrador
autenticado (`ContextoUsuarioActual`), nunca en la que mande el cliente en
el request — una empresa distinta se rechaza con 403 genérico, sin distinguir
si esa empresa existe o no. Genera una contraseña temporal y envía las
credenciales por correo (ver `EmailService` arriba).

Inactivar y reactivar un usuario exigen rol Administrador, quedan
registrados en la bitácora de seguridad, e inactivar revoca de inmediato
las sesiones activas de ese usuario.

### Apariencia

Modo claro/oscuro con elección explícita desde Ajustes; la preferencia
persiste solo en ese dispositivo (`localStorage`) y se aplica de inmediato,
sin recargar.

### Frontend

Layout unificado (barra lateral, barra superior, navegación inferior),
Dashboard, gestión de usuarios responsiva — todo detrás de `ProtectedRoute`.
Esa protección es solo UX (evita el parpadeo de una pantalla que de todas
formas el backend va a rechazar); el límite real de seguridad siempre lo
aplica el backend.

## Convenciones para contribuir

- Una rama por funcionalidad (ej. `feature/validacion-password`).
- Cada cambio que necesite tocar el esquema agrega una migración Flyway **nueva** (`V9__...`, `V10__...`) — nunca editar una migración que ya existe.

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
npm run cypress:run   # end-to-end (Cypress, headless)
npm run cypress:open  # end-to-end (Cypress, interfaz interactiva)
```

## Integración continua

Cada push o PR contra `main` corre automáticamente ambos conjuntos de pruebas en GitHub Actions (`.github/workflows/ci.yml`), incluyendo las de integración con Testcontainers — los runners de GitHub ya traen Docker, no requiere configuración adicional.

## Documentación

- [`.github/ESTRUCTURA.md`](.github/ESTRUCTURA.md) — mapa de qué hay en cada carpeta del código y las convenciones de nombres.

---

Este README se actualiza a medida que el proyecto avanza — si algo aquí queda desactualizado (nuevos pasos de setup, nuevas variables de entorno, nuevos comandos), corregirlo aquí mismo en vez de dejarlo solo en la conversación del equipo.
