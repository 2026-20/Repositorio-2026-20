-- HU-023 (aislamiento multiempresa): incorpora Diagnostika como segunda empresa real del
-- sistema -- hasta ahora la semilla (V2) solo traia "CAPRIS Médica", y el selector de
-- empresa del login necesita al menos dos opciones reales para tener sentido.
-- Mismo patron que V2: una fila en empresa, sin usuarios asociados todavia.

INSERT INTO empresa (nombre) VALUES ('Diagnostika');
