-- Deja la base de datos lista para que cada HU de auditoria (HU-004, HU-005,
-- HU-008, HU-024, etc. -- ver backlog) se implemente sin tener que modelar
-- esto desde cero. No implementa ninguna HU por si misma.

-- HU-005 (registrar conteo fisico): no existia ninguna tabla para "lo que
-- el auditor conto" -- hasta ahora solo estaba lo que trae el ERP
-- (auditoria_detalle_bodega / auditoria_lote_bodega).
--
-- id_idempotencia es la pieza clave para que esto funcione offline-first
-- (HU-005 criterio 4, HU-024 criterio 4 -- ver tambien la decision de
-- wa-sqlite+OPFS del equipo): el cliente genera este ID una sola vez al
-- registrar el conteo localmente, y lo reenvia tal cual al sincronizar. Si
-- la sincronizacion se reintenta (conexion que se cae a medio camino), el
-- backend reconoce el mismo id_idempotencia y NO duplica el conteo -- ver
-- ConteoFisicoService.
--
-- cantidad_teorica queda copiada aqui (no se recalcula desde
-- auditoria_detalle_bodega en consulta) a proposito: es el valor que el
-- usuario vio en pantalla en el momento de contar, y ese es el que importa
-- para la diferencia -- si el ERP actualiza la cantidad teorica despues,
-- no debe cambiar retroactivamente un conteo ya hecho.
CREATE TABLE auditoria_conteo_fisico (
    id                BIGSERIAL PRIMARY KEY,
    id_idempotencia   VARCHAR(100) NOT NULL UNIQUE,
    cod_bod           VARCHAR(30) NOT NULL,
    cod_art           VARCHAR(30) NOT NULL,
    num_lote          VARCHAR(30),
    num_con           VARCHAR(50),
    cantidad_teorica  NUMERIC(14, 4) NOT NULL,
    cantidad_fisica   NUMERIC(14, 4) NOT NULL CHECK (cantidad_fisica >= 0),
    usuario_id        BIGINT NOT NULL REFERENCES usuario(id),
    observaciones     TEXT,
    registrado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auditoria_conteo_fisico_bodega ON auditoria_conteo_fisico (cod_bod);
CREATE INDEX idx_auditoria_conteo_fisico_usuario ON auditoria_conteo_fisico (usuario_id);

-- HU-024/HU-008 (estado de avance de la visita: Pendiente/En progreso/
-- Finalizada, y a quien esta asignada): esto lo gestiona la app, no el ERP
-- -- por eso es una columna nueva separada de "estado" (que SIGUE
-- reflejando tal cual lo que manda el ERP, ver ResultadoVisita). Default
-- PENDIENTE para que las filas que ya existan (ingestadas antes de esta
-- migracion) queden en un estado valido.
ALTER TABLE auditoria_resultado_visita
    ADD COLUMN estado_app VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    ADD COLUMN asignado_a_usuario_id BIGINT REFERENCES usuario(id);

CREATE INDEX idx_auditoria_resultado_visita_asignado ON auditoria_resultado_visita (asignado_a_usuario_id);

-- HU-004 (contexto de auditoria: solo ver lo de mi empresa activa) --
-- columna agregada pero SIN poblar: no hay forma confirmada todavia de
-- mapear cod_org (siempre "MED" en los datos de prueba, un solo valor, no
-- hay con que inferir el mapeo) al id real de empresa de este sistema
-- (CAPRIS Medica / Diagnostika). Queda nullable a proposito -- quien
-- implemente HU-004 tiene que resolver y llenar ese mapeo antes de poder
-- filtrar por empresa de verdad.
ALTER TABLE auditoria_bodega
    ADD COLUMN empresa_id BIGINT REFERENCES empresa(id);
