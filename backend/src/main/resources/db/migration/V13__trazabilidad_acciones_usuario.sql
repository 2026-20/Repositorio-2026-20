-- HU-031 (registrar trazabilidad de acciones del usuario): un registro de
-- auditoria de solo insercion, igual que bitacora_seguridad, pero para
-- acciones operativas de campo (inicio de sesion, conteos registrados,
-- correcciones, transmisiones, devoluciones -- ver backlog), no de
-- seguridad. No se reusa bitacora_seguridad porque sus columnas no
-- alcanzan (HU-031 pide bodega y empresa asociadas, que esa tabla no
-- tiene) y porque estas acciones ocurren en campo, offline -- el registro
-- se genera en el dispositivo (wa-sqlite/OPFS) y se sincroniza despues,
-- igual que auditoria_conteo_fisico.
--
-- id_idempotencia: mismo motivo que en auditoria_conteo_fisico -- el
-- cliente lo genera una vez al crear el registro localmente y lo reenvia
-- tal cual al sincronizar, para que un reintento no duplique la fila.
--
-- fecha: NO tiene DEFAULT now() a proposito, a diferencia de
-- bitacora_seguridad.fecha -- esta es la hora en que la accion ocurrio en
-- el dispositivo (puede ser horas antes de que haya señal para
-- sincronizar), no la hora en que el backend la recibe. La manda el
-- cliente.
--
-- cod_bod es NULL para acciones sin bodega asociada (ej. inicio de
-- sesion).
CREATE TABLE auditoria_trazabilidad (
    id                BIGSERIAL PRIMARY KEY,
    id_idempotencia   VARCHAR(100) NOT NULL UNIQUE,
    tipo_accion       VARCHAR(30) NOT NULL,
    usuario_id        BIGINT NOT NULL REFERENCES usuario(id),
    empresa_id        BIGINT NOT NULL REFERENCES empresa(id),
    cod_bod           VARCHAR(30),
    resultado         VARCHAR(20) NOT NULL,
    detalle           TEXT,
    fecha             TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_auditoria_trazabilidad_empresa ON auditoria_trazabilidad (empresa_id);
CREATE INDEX idx_auditoria_trazabilidad_usuario ON auditoria_trazabilidad (usuario_id);
