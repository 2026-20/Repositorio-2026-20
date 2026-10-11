const USUARIO_DE_CAMPO = { id: 21, nombreCompleto: 'Andrey Meléndez', rol: 'Usuario de Campo' }

const UNA_PARADA = [
    {
        codBod: 'HSJD',
        desBod: 'Hospital San Juan de Dios',
        numCon: 'C-002',
        objCon: 'Reactivos de laboratorio',
        estadoErp: 'PEND',
        estadoApp: 'PENDIENTE',
        fechaAsignada: null,
    },
]

describe('HU-038 - Confirmar inicio de jornada', () => {
    beforeEach(() => {
        // Igual que en hu-037: bodegas vacio no afecta la ruta (se guarda
        // aparte, ver sincronizacionDatosMaestros.js), asi que basta con
        // interceptar mi-ruta para controlar cuantas bodegas tiene el usuario.
        cy.intercept('GET', '**/api/auditoria/bodegas', { statusCode: 200, body: [] }).as('bodegas')
    })

    it('criterios 1, 2 y 3: con bodegas asignadas, confirma la jornada y la refleja en pantalla y en el encabezado', () => {
        cy.intercept('GET', '**/api/auditoria/visitas/mi-ruta', { statusCode: 200, body: UNA_PARADA }).as('miRuta')
        cy.intercept('GET', '**/api/auditoria/jornadas/hoy', { statusCode: 200, body: { iniciada: false, iniciadaEn: null } }).as('jornadaHoy')
        cy.intercept('POST', '**/api/auditoria/jornadas/iniciar', {
            statusCode: 200,
            body: { iniciada: true, iniciadaEn: new Date().toISOString() },
        }).as('iniciarJornada')

        cy.visitarConSesion('/mi-ruta', USUARIO_DE_CAMPO)
        cy.wait('@miRuta')
        cy.wait('@jornadaHoy')
        cy.contains('Hospital San Juan de Dios').should('be.visible')

        cy.contains('button', 'Iniciar jornada').should('be.enabled').click()
        cy.get('[role="alertdialog"]').should('be.visible').and('contain', 'Iniciar jornada')

        cy.get('[role="alertdialog"]').contains('button', 'Iniciar').click()
        cy.wait('@iniciarJornada').its('request.headers.authorization').should('eq', 'Bearer jwt-prueba')

        cy.get('[role="alertdialog"]').should('not.exist')
        cy.contains('button', 'Iniciar jornada').should('not.exist')
        cy.contains('Jornada iniciada').should('be.visible')
        cy.get('header').contains('Jornada iniciada').should('be.visible')
    })

    it('sin bodegas asignadas, el boton de iniciar jornada queda deshabilitado', () => {
        cy.intercept('GET', '**/api/auditoria/visitas/mi-ruta', { statusCode: 200, body: [] }).as('miRuta')
        cy.intercept('GET', '**/api/auditoria/jornadas/hoy', { statusCode: 200, body: { iniciada: false, iniciadaEn: null } }).as('jornadaHoy')

        cy.visitarConSesion('/mi-ruta', USUARIO_DE_CAMPO)
        cy.wait('@miRuta')
        cy.contains('No tiene bodegas asignadas pendientes.').should('be.visible')

        cy.contains('button', 'Iniciar jornada').should('be.disabled')
        cy.contains('No tiene bodegas asignadas: no es posible iniciar jornada.').should('be.visible')
        cy.get('[role="alertdialog"]').should('not.exist')
    })

    it('si la jornada ya estaba confirmada al entrar, se muestra directamente sin pasar por el dialogo', () => {
        cy.intercept('GET', '**/api/auditoria/visitas/mi-ruta', { statusCode: 200, body: UNA_PARADA }).as('miRuta')
        cy.intercept('GET', '**/api/auditoria/jornadas/hoy', {
            statusCode: 200,
            body: { iniciada: true, iniciadaEn: '2026-10-10T08:00:00-06:00' },
        }).as('jornadaHoy')

        cy.visitarConSesion('/mi-ruta', USUARIO_DE_CAMPO)
        cy.wait('@jornadaHoy')

        cy.contains('Jornada iniciada').should('be.visible')
        cy.contains('button', 'Iniciar jornada').should('not.exist')
    })

    it('criterio 5: si falla la confirmacion, el dialogo muestra el error y permite reintentar', () => {
        cy.intercept('GET', '**/api/auditoria/visitas/mi-ruta', { statusCode: 200, body: UNA_PARADA }).as('miRuta')
        cy.intercept('GET', '**/api/auditoria/jornadas/hoy', { statusCode: 200, body: { iniciada: false, iniciadaEn: null } }).as('jornadaHoy')
        cy.intercept('POST', '**/api/auditoria/jornadas/iniciar', {
            statusCode: 500,
            body: { codigo: 'ERROR_INESPERADO', mensaje: 'No fue posible completar la solicitud' },
        }).as('iniciarJornadaFalla')

        cy.visitarConSesion('/mi-ruta', USUARIO_DE_CAMPO)
        cy.wait('@miRuta')

        cy.contains('button', 'Iniciar jornada').click()
        cy.get('[role="alertdialog"]').contains('button', 'Iniciar').click()
        cy.wait('@iniciarJornadaFalla')

        cy.get('[role="alertdialog"]').should('be.visible')
        cy.contains('No fue posible confirmar el inicio de jornada. Intente de nuevo.').should('be.visible')

        // Reintentar: la misma llamada, ahora respondiendo con exito.
        cy.intercept('POST', '**/api/auditoria/jornadas/iniciar', {
            statusCode: 200,
            body: { iniciada: true, iniciadaEn: new Date().toISOString() },
        }).as('iniciarJornadaReintento')

        cy.get('[role="alertdialog"]').contains('button', 'Reintentar').click()
        cy.wait('@iniciarJornadaReintento')

        cy.get('[role="alertdialog"]').should('not.exist')
        cy.contains('Jornada iniciada').should('be.visible')
    })
})
