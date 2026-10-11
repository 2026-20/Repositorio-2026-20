// Un usuario distinto por test (no solo por describe): el almacenamiento
// local es OPFS real del navegador y persiste entre tests dentro de la
// misma corrida de Cypress -- si dos tests comparten el mismo id, un
// conteo que un test dejo sin sincronizar bloquea el sync del siguiente
// (es el comportamiento correcto de criterio 3, pero rompe el aislamiento
// entre pruebas si no se tiene en cuenta).
function usuarioDeCampo(id) {
    return { id, nombreCompleto: 'Andrey Meléndez', rol: 'Usuario de Campo' }
}

const BODEGA = { codBod: 'MEPRIN', desBod: 'Bodega Medicamentos Principal', numCon: '123', tipoBod: 'CLI' }
const PARADA = {
    codBod: 'MEPRIN',
    desBod: 'Bodega Medicamentos Principal',
    numCon: '123',
    objCon: 'Reactivos',
    estadoErp: 'PEND',
    estadoApp: 'PENDIENTE',
    fechaAsignada: new Date().toISOString().slice(0, 10),
}
const ARTICULO = {
    codArt: 'ART1',
    desArt: 'Reactivo de prueba',
    cantidadTeorica: 10,
    indicadorLote: false,
    numCon: '123',
    cantidadMinima: null,
}

describe('HU-021 - Operar en modo sin conexion', () => {
    beforeEach(() => {
        cy.intercept('GET', '**/api/auditoria/bodegas', { statusCode: 200, body: [BODEGA] }).as('bodegas')
        cy.intercept('GET', '**/api/auditoria/bodegas/MEPRIN/detalle', { statusCode: 200, body: [ARTICULO] }).as(
            'detalle',
        )
        cy.intercept('GET', '**/api/auditoria/bodegas/MEPRIN/lotes', { statusCode: 200, body: [] }).as('lotes')
        cy.intercept('GET', '**/api/auditoria/visitas/mi-ruta', { statusCode: 200, body: [PARADA] }).as('miRuta')
    })

    // HU-038: sin jornada confirmada previamente y sin red, no hay forma de
    // confirmarla (el unico paso que de verdad necesita conexion) -- la
    // pantalla avisa en vez de mostrar un formulario que de todas formas el
    // backend rechazaria.
    it('sin conexion y sin jornada previa, avisa en vez de permitir contar (criterio 4)', () => {
        cy.intercept('GET', '**/api/auditoria/jornadas/hoy', {
            statusCode: 200,
            body: { iniciada: false, iniciadaEn: null },
        }).as('jornadaHoy')
        cy.intercept('GET', '**/api/auditoria/**', { forceNetworkError: true })
        cy.then(() => {
            cy.on('window:before:load', (win) => {
                Object.defineProperty(win.navigator, 'onLine', { get: () => false })
            })
        })

        cy.visitarConSesion('/conteo', usuarioDeCampo(101))

        cy.contains('Necesitás conexión para empezar a contar hoy.').should('be.visible')
        cy.get('#conteo-bodega').should('not.exist')
    })

    it('con conexion, confirma la jornada en silencio (sin pantalla ni dialogo) y permite registrar un conteo (criterio 1)', () => {
        cy.intercept('GET', '**/api/auditoria/jornadas/hoy', {
            statusCode: 200,
            body: { iniciada: false, iniciadaEn: null },
        }).as('jornadaHoy')
        cy.intercept('POST', '**/api/auditoria/jornadas/iniciar', {
            statusCode: 200,
            body: { iniciada: true, iniciadaEn: new Date().toISOString() },
        }).as('iniciarJornada')

        cy.visitarConSesion('/conteo', usuarioDeCampo(102))
        cy.wait('@iniciarJornada')

        cy.url().should('include', '/conteo')
        cy.get('#conteo-bodega', { timeout: 10000 }).should('be.visible')

        // El select existe pero puede estar todavia sin sus opciones: la ruta
        // (que trae las bodegas) se lee de OPFS y en esta pantalla compite en
        // paralelo con la sincronizacion de AppLayout y la cola de pendientes
        // (ver el comentario de la linea ~103). Un cy.select() antes de que
        // llegue la opcion falla con "no tiene esa opcion" -- y si el select
        // se re-renderiza a mitad, con "elemento disabled". Por eso se espera
        // la opcion concreta, que es la senal real.
        cy.get('#conteo-bodega option[value="MEPRIN"]', { timeout: 10000 }).should('exist')
        cy.get('#conteo-bodega').select('MEPRIN')
        cy.get('#conteo-articulo option[value="ART1::123"]', { timeout: 10000 }).should('exist')
        cy.get('#conteo-articulo').select('ART1::123')
        cy.get('#conteo-cantidad').type('9')
        cy.contains('button', 'Registrar conteo').click()

        cy.contains('Conteo guardado en este dispositivo').should('be.visible')
    })

    it('si la jornada ya estaba sincronizada, entra directo al formulario sin volver a confirmarla', () => {
        cy.intercept('GET', '**/api/auditoria/jornadas/hoy', {
            statusCode: 200,
            body: { iniciada: true, iniciadaEn: new Date().toISOString() },
        }).as('jornadaHoy')

        // Primera visita: la sincronizacion automatica de AppLayout cachea la
        // jornada ya iniciada localmente. cy.wait('@jornadaHoy') solo
        // confirma que la peticion HTTP llego -- no que guardarJornadaIniciada
        // ya termino de escribir en OPFS (eso sigue async despues). Por eso
        // se espera la señal real: el mensaje de sincronizacion completada.
        cy.visitarConSesion('/sincronizacion', usuarioDeCampo(103))
        cy.wait('@jornadaHoy')
        cy.contains('Sincronización completada', { timeout: 10000 }).should('be.visible')

        // Segunda visita, ya con el cache local -- no deberia volver a
        // llamar a iniciar jornada. Timeout mas largo que el default: en una
        // carga fresca de pagina, AppLayout (su propia sincronizacion
        // automatica) y esta pantalla (jornada + ruta + cola pendiente)
        // abren varias sesiones de OPFS en paralelo -- cada una paga el
        // costo completo de levantar un Worker + compilar wasm, sin cache
        // entre ellas (ver baseDatosLocal.js). Real, no solo de la prueba;
        // vale la pena revisar mas adelante si conviene reusar un worker en
        // vez de abrir uno nuevo por operacion.
        cy.intercept('POST', '**/api/auditoria/jornadas/iniciar', { statusCode: 200, body: {} }).as('iniciarJornada')
        cy.visit('/conteo')

        cy.get('#conteo-bodega', { timeout: 10000 }).should('be.visible')
        cy.url().should('include', '/conteo')
        cy.get('@iniciarJornada.all').should('have.length', 0)
    })
})
