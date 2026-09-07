-- Datos semilla para desarrollo local. NO son datos de produccion.
--
-- La cedula real de estas 3 personas no fue proporcionada -- se usa un valor
-- claramente marcado como pendiente (PENDIENTE-00N) en vez de inventar un numero
-- que pueda confundirse con una cedula real. Corregir con el valor real cuando
-- se tenga, o ajustar el flujo de alta (HU-047) para no requerirlo desde el inicio.
--
-- La contraseña de los 3 usuarios semilla es "Capris2026!" (cumple HU-042: 8+
-- caracteres, mayuscula, minuscula, numero y caracter especial). Es SOLO para
-- desarrollo local -- en produccion la contraseña nunca la fija un humano, la
-- genera el sistema como OTP temporal y se envia por correo (HU-047).

INSERT INTO empresa (nombre) VALUES ('CAPRIS Médica');

INSERT INTO rol (nombre) VALUES ('Administrador'), ('Usuario de Campo');

INSERT INTO usuario (nombre_completo, cedula, correo, username, password_hash, estado, rol_id, empresa_id)
VALUES
    (
        'Andrey Meléndez Ovares',
        'PENDIENTE-001',
        'amelendez@capris.co.cr',
        'amelendez',
        '$2b$10$gC.hqSLQUPVroKuUU2VVEeG79UbOP3ym5hIjDXdY74Lau35Xe/RAG',
        'ACTIVO',
        (SELECT id FROM rol WHERE nombre = 'Usuario de Campo'),
        (SELECT id FROM empresa WHERE nombre = 'CAPRIS Médica')
    ),
    (
        'Adrián Arce Soto',
        'PENDIENTE-002',
        'arcea@capris.cr',
        'arcea',
        '$2b$10$gC.hqSLQUPVroKuUU2VVEeG79UbOP3ym5hIjDXdY74Lau35Xe/RAG',
        'ACTIVO',
        (SELECT id FROM rol WHERE nombre = 'Usuario de Campo'),
        (SELECT id FROM empresa WHERE nombre = 'CAPRIS Médica')
    ),
    (
        'William A. Molina Quirós',
        'PENDIENTE-003',
        'wmolina@capris.cr',
        'wmolina',
        '$2b$10$gC.hqSLQUPVroKuUU2VVEeG79UbOP3ym5hIjDXdY74Lau35Xe/RAG',
        'ACTIVO',
        (SELECT id FROM rol WHERE nombre = 'Administrador'),
        (SELECT id FROM empresa WHERE nombre = 'CAPRIS Médica')
    );
