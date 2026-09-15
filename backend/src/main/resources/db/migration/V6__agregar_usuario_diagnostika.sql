-- HU-023: usuario de prueba para Diagnostika. Hasta V5, Diagnostika era una empresa sin
-- ningun usuario -- no se podia probar el login ni el selector de empresa con datos reales
-- de esa empresa. A diferencia de los 3 usuarios de V2 (personas reales de CAPRIS), este
-- es explicitamente una cuenta de prueba/QA, no una persona.
--
-- Misma contraseña de desarrollo que la semilla original ("Capris2026!", ver V2).

INSERT INTO usuario (nombre_completo, cedula, correo, username, password_hash, estado, rol_id, empresa_id)
VALUES (
    'Usuario de Prueba Diagnostika',
    'PENDIENTE-004',
    'prueba@diagnostika.test',
    'pruebadiagnostika',
    '$2b$10$gC.hqSLQUPVroKuUU2VVEeG79UbOP3ym5hIjDXdY74Lau35Xe/RAG',
    'ACTIVO',
    (SELECT id FROM rol WHERE nombre = 'Usuario de Campo'),
    (SELECT id FROM empresa WHERE nombre = 'Diagnostika')
);
