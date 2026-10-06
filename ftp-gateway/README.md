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
