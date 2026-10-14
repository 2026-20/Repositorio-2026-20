import './commands.js'

// HU-036: toda llamada autenticada ahora revisa si el backend rechazo el JWT
// con 401 SESION_NO_VALIDA (ver procesarRespuesta.js) y, si es asi, cierra
// la sesion -- sin importar cual endpoint fue. El JWT de prueba ('jwt-prueba')
// no es uno real, asi que CUALQUIER llamada que llegue sin mockear hasta el
// backend real se rechaza con ese mismo codigo y cierra la sesion a mitad de
// la prueba. Antes de HU-036 eso fallaba en silencio (ver SincronizacionProvider);
// ahora es destructivo para el resto del spec.
//
// Estos son los endpoints que se llaman SOLOS, sin que el spec haga nada, en
// cualquier pantalla autenticada:
//   - GET /api/usuarios/:id -- AuthProvider valida la sesion al montar y al
//     recuperar la conexion.
//   - GET /api/auditoria/bodegas, /visitas/mi-ruta, /jornadas/hoy --
//     SincronizacionProvider sincroniza catalogos al iniciar sesion (HU-003).
//
// Un spec que necesite probar el rechazo real de alguno de estos (ver
// hu-036-invalidacion-sesion.cy.js) registra su propio cy.intercept() para
// la misma ruta dentro del it() -- como Cypress aplica el ULTIMO intercept
// registrado que matchee la ruta, el del spec gana sobre este default.
beforeEach(() => {
    cy.intercept('GET', '**/api/usuarios/*', {
        statusCode: 200,
        body: {
            id: 0,
            nombreCompleto: 'Usuario de prueba',
            estado: 'ACTIVO',
        },
    }).as('validarSesionPorDefecto')

    cy.intercept('GET', '**/api/auditoria/bodegas', {
        statusCode: 200,
        body: [],
    }).as('bodegasPorDefecto')

    cy.intercept('GET', '**/api/auditoria/visitas/mi-ruta', {
        statusCode: 200,
        body: [],
    }).as('miRutaPorDefecto')

    cy.intercept('GET', '**/api/auditoria/jornadas/hoy', {
        statusCode: 200,
        body: { iniciada: false, iniciadaEn: null },
    }).as('jornadaHoyPorDefecto')
})
