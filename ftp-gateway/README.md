# ftp-gateway

Servidor puente entre el FTP del ERP y el backend de reactivos. Vigila una
carpeta FTP y por cada XML nuevo lo reenvia tal cual a
`/api/auditoria/ingesta/**` del backend, usando el nombre de archivo para
decidir a cual endpoint (ver `ReenviadorAlBackend`). No parsea ni valida el
contenido del XML -- esa logica ya existe en el backend.

## Configuracion

Variables de entorno (todas opcionales, con default de desarrollo local en
`src/main/resources/application.yml`):

| Variable | Descripcion | Default dev |
|---|---|---|
| `APP_FTP_HOST` | Host del FTP del ERP | `localhost` |
| `APP_FTP_PORT` | Puerto del FTP | `2121` |
| `APP_FTP_USUARIO` | Usuario FTP | `capris` |
| `APP_FTP_PASSWORD` | Password FTP | `capris_dev` |
| `APP_FTP_DIRECTORIO_REMOTO` | Carpeta remota a vigilar | `/` |
| `APP_FTP_INTERVALO_POLLING_SEGUNDOS` | Cada cuantos segundos revisa la carpeta | `30` |
| `APP_BACKEND_BASE_URL` | URL base del backend | `http://localhost:8080` |
| `APP_BACKEND_API_KEY` | Debe coincidir con `APP_AUDITORIA_INGESTA_API_KEY` del backend | clave de desarrollo |

En produccion, ninguno de los defaults de desarrollo debe usarse -- sobreescribir
todas las variables anteriores.

## Levantar un FTP de prueba local (Docker)

Para probar el gateway sin depender del FTP real del ERP:

```bash
mkdir -p /tmp/ftp-test-data
docker run -d --name capris-ftp-test \
  -p 2121:21 -p 30000-30009:30000-30009 \
  -e FTP_USER_NAME=capris \
  -e FTP_USER_PASS=capris_dev \
  -e FTP_USER_HOME=/home/capris \
  -e PUBLICHOST=localhost \
  -e PASSIVE_PORT_RANGE_START=30000 \
  -e PASSIVE_PORT_RANGE_END=30009 \
  -v /tmp/ftp-test-data:/home/capris \
  stilliard/pure-ftpd
```

Copiar un XML de prueba a `/tmp/ftp-test-data/` y levantar el gateway
(`mvn spring-boot:run`) junto con el backend corriendo en `localhost:8080`.
El gateway detecta el archivo en el siguiente ciclo de polling y lo reenvia.

No usar la imagen `delfer/alpine-ftp-server`: su script de arranque tiene un
bug que ignora `FTP_USER` y siempre crea un usuario llamado `alpineftp`,
causando `530 Login incorrect` sin importar las credenciales configuradas.

## Simulador de ingesta (pruebas manuales, sin FTP)

Para probar el reenvio sin depender de un FTP (real o de prueba): una
pagina web minima que deja subir un XML desde el navegador y lo reenvia al
backend por el mismo camino que usa el flujo real
(`ReenviadorAlBackend.reenviarManual`, mismos headers, mismo endpoint por
nombre de archivo). Util para probar manualmente que un XML especifico
(incluido uno armado a mano, o una variante corrupta a proposito) llega
bien y se le carga al usuario en la app.

Apagado por defecto -- se activa con el perfil `simulador`:

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=simulador
```

Con el backend corriendo en `localhost:8080`, abrir
`http://localhost:8081/simulador`. El nombre de archivo es editable (no
tiene que coincidir con el del archivo local elegido) -- para
`cai_det_mov`/`cai_lot_mov` tiene que calzar ademas el patron de
`IdentificadorVisita` (ver javadoc de esa clase en el backend), para los
otros 4 tipos el nombre solo decide el endpoint por substring.

Los 6 XML de `backend/src/test/resources/auditoria/xmls/` son el punto de
partida mas seguro: ya pasan todas las validaciones reales y sirven de
molde para armar variantes de prueba.

No dejar este perfil activo fuera de un ambiente de pruebas: el endpoint
`/simulador/ingesta` no tiene autenticacion propia (mas alla de la que ya
hace el backend con la API key interna) y dispara escrituras reales.

### Asignar la ingesta a un usuario de prueba conocido

El formulario tiene un campo opcional "Asignar a este usuario" (username,
ej. `amelendez`). Solo aplica cuando el archivo se rutea a
`estados-visita` (`cai_est_vis`): si se completa, cada visita de ese
archivo queda asignada a ese usuario para hoy (mismo mecanismo que
`VisitaController.asignar()` de HU-037), sin pasar por la asignacion
manual fila por fila.

Pensado para pruebas de usabilidad/demos: deja cargarle datos de prueba
(repetidos entre si, da igual) a distintos usuarios conocidos del sistema,
para demostrar que cada uno carga su propia informacion al iniciar sesion.
El username **no tiene que ver con `cod_usu`** del XML -- ese campo es
quien exporto el archivo desde el ERP, no el auditor de campo real (ver
javadoc de `Bodega` en el backend). Dejar el campo vacio para el
comportamiento normal de siempre (sin asignar nada).

Esto deja de hacer falta el dia que el ERP mande la asignacion real de
rutas/auditores (ver `docs/SERVIDOR_PUENTE_FTP.md`, pregunta 1.1.1) -- es
un atajo deliberadamente temporal sobre el endpoint real de ingesta, no
una simulacion aparte.

### Carga rapida con los datos de prueba del repo

El formulario tiene un checkbox "Usar los datos de prueba del repo (sin
subir archivos)". Al marcarlo se ocultan los campos de archivo y basta con
escribir un username en "Asignar a este usuario" (aqui es obligatorio) --
el boton reenvia los 4 XML ya empacados en
`src/main/resources/datos-prueba/` (copia de los mismos 4 de
`backend/src/test/resources/auditoria/xmls/`: bodegas, detalle, lotes y
estados-visita) por el mismo camino que el formulario normal, asignando
las visitas al usuario indicado.

Pensado para agilizar pruebas de usabilidad repetidas: sin esto, dejar
lista una bodega para un usuario de prueba distinto implica subir 4
archivos a mano cada vez. `cai_det_bod`/`cai_lot_bod` tienen ~1960/~1690
filas y se ingestan fila por fila en transacciones separadas (ver javadoc
de `AuditoriaFilaTransaccional` en el backend), asi que esta llamada puede
tardar decenas de segundos -- es esperado, no un cuelgue.

## Tests

```bash
mvn test
```

Cubre unicamente la logica de ruteo nombre-de-archivo -> endpoint
(`ReenviadorAlBackendTest`). La conexion FTP real y la ingesta end-to-end se
verificaron manualmente contra un FTP y un backend reales (ver seccion
anterior) -- no hay tests automatizados de integracion en este proyecto
porque requeririan un servidor FTP real o un fake de proposito especifico
que no existe como dependencia estandar de Spring Integration.
