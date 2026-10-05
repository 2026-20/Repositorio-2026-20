-- Esquema inicial para la auditoria de bodegas/reactivos que manda el ERP
-- por FTP via los 6 XML cai_bod / cai_est_vis / cai_det_bod / cai_lot_bod /
-- cai_det_mov / cai_lot_mov (ver estudio de auditoria 2026-10 y las
-- entidades de cr.co.capris.reactivos.auditoria).
--
-- Deliberadamente sin FK entre estas 6 tablas: el ERP las manda como
-- tablas planas identificadas por sus propios codigos (num_con, cod_bod,
-- cod_art), y todavia no esta confirmado con el ERP como correlacionarlas
-- en la salida -- forzar relaciones ahora seria estructura prematura
-- (ver javadoc de Bodega). La correlacion se hace por estos codigos desde
-- los servicios, no por FK.

-- UNIQUE incluye tipo_bod a proposito: el ERP reusa el mismo cod_bod
-- ("MEPRIN") para dos buckets de movimiento distintos (ENT y DEV) bajo el
-- mismo contrato -- confirmado contra los datos de prueba reales. Sin
-- tipo_bod en la clave, la segunda fila con ese cod_bod viola el UNIQUE.
CREATE TABLE auditoria_bodega (
    id       BIGSERIAL PRIMARY KEY,
    cod_org  VARCHAR(10) NOT NULL,
    cod_usu  VARCHAR(50) NOT NULL,
    num_con  VARCHAR(50) NOT NULL,
    cod_ins  VARCHAR(30) NOT NULL,
    cod_bod  VARCHAR(30) NOT NULL,
    des_bod  VARCHAR(200),
    tipo_bod VARCHAR(10) NOT NULL,
    UNIQUE (num_con, cod_bod, tipo_bod)
);

-- "estado" es VARCHAR y no un tipo acotado a proposito: en los datos de
-- prueba solo se vio "PEND", no se conoce el set completo de valores que
-- puede mandar el ERP (ver ResultadoVisita).
CREATE TABLE auditoria_resultado_visita (
    id                            BIGSERIAL PRIMARY KEY,
    cod_org                       VARCHAR(10) NOT NULL,
    cod_usu                       VARCHAR(50) NOT NULL,
    estado                        VARCHAR(20) NOT NULL,
    des_estado                    VARCHAR(50),
    cod_bod                       VARCHAR(30) NOT NULL,
    lic_pub                       VARCHAR(50),
    cod_ins                       VARCHAR(30) NOT NULL,
    cod_cli                       VARCHAR(30),
    num_con                       VARCHAR(50) NOT NULL,
    obj_con                       VARCHAR(200),
    -- Resultado de la auditoria que agrega esta app -- SUPUESTO sobre el
    -- formato de salida, ver javadoc de ResultadoVisita.
    descripcion_ajuste_resultado  TEXT,
    aprobacion_tipo_1             VARCHAR(50),
    aprobacion_tipo_2             VARCHAR(50),
    aprobacion_tipo_3             VARCHAR(50),
    aprobacion_tipo_4             VARCHAR(50),
    UNIQUE (num_con, cod_bod)
);

-- UNIQUE incluye num_con a proposito: el mismo articulo en la misma
-- bodega puede aparecer dos veces bajo dos contratos distintos --
-- confirmado contra los datos de prueba reales (484 de 1962 filas
-- colisionaban sin esto, ver javadoc de DetalleBodega).
CREATE TABLE auditoria_detalle_bodega (
    id               BIGSERIAL PRIMARY KEY,
    cod_org          VARCHAR(10) NOT NULL,
    cod_usu          VARCHAR(50) NOT NULL,
    cod_bod          VARCHAR(30) NOT NULL,
    bod_cliente      VARCHAR(30),
    cod_art          VARCHAR(30) NOT NULL,
    des_art          VARCHAR(300),
    cantidad_teorica NUMERIC(14, 4) NOT NULL,
    indicador_lote   BOOLEAN NOT NULL,
    tipo_bod         VARCHAR(10),
    num_con          VARCHAR(50),
    cod_ins          VARCHAR(30),
    -- No es INT: se vio al menos un valor ".75" en los datos de prueba.
    cantidad_minima  NUMERIC(14, 4),
    UNIQUE (cod_bod, cod_art, num_con)
);

CREATE TABLE auditoria_lote_bodega (
    id                 BIGSERIAL PRIMARY KEY,
    cod_org            VARCHAR(10) NOT NULL,
    cod_usu            VARCHAR(50) NOT NULL,
    cod_bod            VARCHAR(30) NOT NULL,
    bod_cliente        VARCHAR(30),
    cod_art            VARCHAR(30) NOT NULL,
    num_lote           VARCHAR(30) NOT NULL,
    fecha_vencimiento  DATE,
    cantidad           NUMERIC(14, 4) NOT NULL,
    UNIQUE (cod_bod, cod_art, num_lote)
);

-- cod_bod_visita/fecha_visita/hora_visita/secuencia_visita identifican la
-- visita -- vienen del NOMBRE del archivo, no del contenido del XML (ver
-- IdentificadorVisita y SUPUESTO en MovimientoPendiente).
CREATE TABLE auditoria_movimiento_pendiente (
    id                BIGSERIAL PRIMARY KEY,
    cod_bod_visita    VARCHAR(30) NOT NULL,
    fecha_visita      DATE NOT NULL,
    hora_visita       TIME NOT NULL,
    secuencia_visita  INT NOT NULL,
    cod_org           VARCHAR(10) NOT NULL,
    cod_usu           VARCHAR(50) NOT NULL,
    cod_art           VARCHAR(30) NOT NULL,
    cantidad          NUMERIC(14, 4) NOT NULL,
    bodega_origen     VARCHAR(30),
    bodega_destino    VARCHAR(30),
    tipo_movimiento   VARCHAR(10) NOT NULL,
    indicador_lote    BOOLEAN NOT NULL,
    num_con           VARCHAR(50),
    cod_ins           VARCHAR(30)
);

CREATE INDEX idx_auditoria_mov_pendiente_visita
    ON auditoria_movimiento_pendiente (cod_bod_visita, fecha_visita, hora_visita, secuencia_visita);

CREATE TABLE auditoria_lote_movimiento (
    id                BIGSERIAL PRIMARY KEY,
    cod_bod_visita    VARCHAR(30) NOT NULL,
    fecha_visita      DATE NOT NULL,
    hora_visita       TIME NOT NULL,
    secuencia_visita  INT NOT NULL,
    cod_org           VARCHAR(10) NOT NULL,
    cod_usu           VARCHAR(50) NOT NULL,
    cod_art           VARCHAR(30) NOT NULL,
    num_lote          VARCHAR(30) NOT NULL,
    cantidad          NUMERIC(14, 4) NOT NULL,
    bodega_origen     VARCHAR(30),
    bodega_destino    VARCHAR(30),
    tipo_movimiento   VARCHAR(10) NOT NULL
);

CREATE INDEX idx_auditoria_lote_mov_visita
    ON auditoria_lote_movimiento (cod_bod_visita, fecha_visita, hora_visita, secuencia_visita);
