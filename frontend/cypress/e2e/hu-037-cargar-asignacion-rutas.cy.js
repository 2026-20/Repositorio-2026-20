// "YYYY-MM-DD" en hora local, igual que fechaAsignada (LocalDate del backend).
function fechaLocal(desplazamientoDias) {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() + desplazamientoDias)
    const mes = String(fecha.getMonth() + 1).padStart(2, '0')
    const dia = String(fecha.getDate()).padStart(2, '0')
    return `${fecha.getFullYear()}-${mes}-${dia}`
}

function diaEscrito(fechaIso) {
    const [anio, mes, dia] = fechaIso.split('-').map(Number)
    return new Date(anio, mes - 1, dia).toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' })
}

const USUARIO_DE_CAMPO = { id: 21, nombreCompleto: 'Andrey Meléndez', rol: 'Usuario de Campo' }

const RUTA = [
    {
        codBod: 'HMEX',
        desBod: 'Hospital México',
        numCon: 'C-001',
        objCon: 'Reactivos de laboratorio',
        estadoErp: 'PEND',
        estadoApp: 'PENDIENTE',
        fechaAsignada: fechaLocal(-3),
    },
    {
        codBod: 'HSJD',
        desBod: 'Hospital San Juan de Dios',
        numCon: 'C-002',
        objCon: 'Reactivos de laboratorio',
        estadoErp: 'PEND',
        estadoApp: 'EN_PROGRESO',
        fechaAsignada: fechaLocal(0),
    },
]

describe('HU-037 - Cargar asignacion de rutas', () => {
    beforeEach(() => {
        cy.intercept('GET', '**/api/auditoria/bodegas', { statusCode: 200, body: [] }).as('bodegas')
        cy.intercept('GET', '**/api/auditoria/visitas/mi-ruta', { statusCode: 200, body: RUTA }).as('miRuta')
    })

    it('descarga la ruta del usuario al iniciar sesion y la muestra (criterios 1, 2 y 3)', () => {
        cy.visitarConSesion('/mi-ruta', USUARIO_DE_CAMPO)

        cy.wait('@miRuta').its('request.headers.authorization').should('eq', 'Bearer jwt-prueba')

        cy.contains('h1', 'Mi ruta').should('be.visible')
        cy.contains('Hospital San Juan de Dios').should('be.visible')
        cy.contains('h2', 'Hoy,').should('be.visible')
        cy.contains('Hospital México').closest('section').find('h2').should('contain', diaEscrito(fechaLocal(-3)))
        cy.contains('todavía no se ha sincronizado').should('not.exist')
    })

    it('avisa cuando el usuario no tiene bodegas asignadas pendientes', () => {
        cy.intercept('GET', '**/api/auditoria/visitas/mi-ruta', { statusCode: 200, body: [] }).as('miRutaVacia')

        cy.visitarConSesion('/mi-ruta', USUARIO_DE_CAMPO)
        cy.wait('@miRutaVacia')

        cy.contains('No tiene bodegas asignadas pendientes.').should('be.visible')
        cy.get('ul').should('not.exist')
    })

    it('sin conexion sigue mostrando la ruta descargada antes, incluida la de dias anteriores', () => {
        cy.visitarConSesion('/mi-ruta', USUARIO_DE_CAMPO)
        cy.wait('@miRuta')
        cy.contains('Hospital San Juan de Dios').should('be.visible')

        // Se corta la red: el navegador se reporta sin conexion y cualquier
        // llamada al backend falla. La pantalla tiene que salir del
        // almacenamiento local (OPFS), no del backend. cy.on() va dentro de
        // cy.then() porque, a diferencia de los comandos, se registra apenas
        // arranca la prueba -- afuera afectaria tambien la primera visita.
        cy.intercept('GET', '**/api/auditoria/**', { forceNetworkError: true })
        cy.then(() => {
            cy.on('window:before:load', (win) => {
                Object.defineProperty(win.navigator, 'onLine', { get: () => false })
            })
        })
        cy.visitarConSesion('/mi-ruta', USUARIO_DE_CAMPO)

        cy.contains('Sin conexión').should('be.visible')
        cy.contains('Hospital San Juan de Dios').should('be.visible')
        cy.contains('Hospital México').closest('section').find('h2').should('contain', diaEscrito(fechaLocal(-3)))
    })
})
