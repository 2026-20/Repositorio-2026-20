-- HU-037 (asignacion manual, stopgap) y HU-038 (jornada). Contexto del
-- equipo (2026-10): codUsu en los 6 XML del ERP es quien EXPORTA el lote,
-- no el auditor de campo asignado -- el ERP decide esa asignacion
-- internamente y todavia no la manda en ningun XML. Mientras se consigue
-- ese dato (el proveedor del ERP esta de vacaciones), la asignacion se
-- resuelve manualmente dentro de la app.

-- HU-037 criterio 4 ("ruta del dia"): a quien y para que fecha se asigno
-- cada visita. asignado_a_usuario_id ya existia (V10); fecha_asignada es
-- lo que faltaba para que "ruta del dia" tenga sentido.
ALTER TABLE auditoria_resultado_visita
    ADD COLUMN fecha_asignada DATE;

CREATE INDEX idx_auditoria_resultado_visita_fecha
    ON auditoria_resultado_visita (asignado_a_usuario_id, fecha_asignada);

-- HU-038: confirmar inicio de jornada. Una fila por (usuario, fecha) --
-- si no existe o iniciada_en es null, la jornada no esta confirmada
-- (criterio 4: "impedir iniciar el conteo si la jornada no ha sido
-- confirmada", ver JornadaService y su uso en ConteoFisicoService).
CREATE TABLE auditoria_jornada (
    id             BIGSERIAL PRIMARY KEY,
    usuario_id     BIGINT NOT NULL REFERENCES usuario(id),
    fecha          DATE NOT NULL,
    iniciada_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (usuario_id, fecha)
);
