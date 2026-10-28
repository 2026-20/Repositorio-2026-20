// Un usuario distinto por test -- el almacenamiento local es OPFS real del
// navegador y persiste entre tests dentro de la misma corrida de Cypress
// (mismo motivo que hu-021-modo-sin-conexion.cy.js).
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

describe('HU-031 - Trazabilidad de acciones del usuario', () => {
    beforeEach(() => {
        cy.intercept('GET', '**/api/auditoria/bodegas', { statusCode: 200, body: [BODEGA] }).as('bodegas')
        cy.intercept('GET', '**/api/auditoria/bodegas/MEPRIN/detalle', { statusCode: 200, body: [ARTICULO] }).as(
            'detalle',
        )
        cy.intercept('GET', '**/api/auditoria/bodegas/MEPRIN/lotes', { statusCode: 200, body: [] }).as('lotes')
        cy.intercept('GET', '**/api/auditoria/visitas/mi-ruta', { statusCode: 200, body: [PARADA] }).as('miRuta')
        cy.intercept('GET', '**/api/auditoria/jornadas/hoy', {
            statusCode: 200,
            body: { iniciada: true, iniciadaEn: new Date().toISOString() },
        }).as('jornadaHoy')
    })

    // Criterio 1 (se registra en el momento) + criterio 6 (sincroniza despues,
    // igual que un conteo). No hay forma de ver la cola local desde la UI, asi
    // que la señal real es que, tras sincronizar, el registro aparece en el
    // log del backend.
    it('al registrar un conteo, la trazabilidad queda pendiente y se sincroniza con el resto (criterio 1/6)', () => {
        cy.intercept('POST', '**/api/auditoria/trazabilidad', { statusCode: 200, body: { id: 1 } }).as(
            'registrarTrazabilidad',
        )
        // La sincronizacion tambien sube el conteo que se registro antes --
        // sin interceptar esto, la llamada real con el JWT de prueba cae al
        // backend real y, desde HU-036, un 401 real cierra la sesion a mitad
        // de la prueba (ver el comentario de cypress/support/e2e.js).
        cy.intercept('POST', '**/api/auditoria/conteos', { statusCode: 201, body: { id: 1 } }).as('registrarConteo')
        // Usuario nuevo para Cypress -- sin cache local de jornada previa
        // (ver conteosPendientesRepositorio.estaJornadaIniciadaHoy), asi que
        // ConteoPage de todas formas la confirma contra el backend.
        cy.intercept('POST', '**/api/auditoria/jornadas/iniciar', {
            statusCode: 200,
            body: { iniciada: true, iniciadaEn: new Date().toISOString() },
        }).as('iniciarJornada')

        cy.visitarConSesion('/conteo', usuarioDeCampo(201))

        // Timeout largo: esta pantalla abre varias sesiones OPFS en paralelo
        // (jornada local, ruta, cola pendiente) y cada una paga el costo
        // completo de levantar un Worker + compilar wasm sin cache entre
        // ellas (mismo comentario que hu-021-modo-sin-conexion.cy.js).
        cy.get('#conteo-bodega option[value="MEPRIN"]', { timeout: 40000 }).should('exist')
        cy.get('#conteo-bodega').select('MEPRIN')
        // Alternativa de widgets: no hay un <select> de articulo -- se toca
        // la tarjeta del articulo (misma espera larga que antes, mismo
        // motivo: carga de catalogo via OPFS).
        cy.contains('Reactivo de prueba', { timeout: 40000 }).click()
        // be.enabled antes de escribir: en CI, el campo puede quedar
        // deshabilitado un instante de mas mientras React re-renderiza tras
        // seleccionar el articulo -- un type() sin esta espera puede caer
        // justo en ese instante (visto una vez en CI, nunca en local).
        cy.get('#conteo-cantidad').should('be.enabled').type('9')
        cy.contains('button', 'Registrar conteo').click()
        cy.contains('Conteo guardado en este dispositivo').should('be.visible')

        cy.visit('/sincronizacion')
        cy.contains('Sincronización completada', { timeout: 10000 }).should('be.visible')

        cy.wait('@registrarTrazabilidad').its('request.body').should('deep.include', {
            tipoAccion: 'CONTEO_REGISTRADO',
            codBod: 'MEPRIN',
            resultado: 'EXITOSO',
            detalle: 'Reactivo de prueba: 9',
        })
    })

    // Criterio 4: pantalla de solo lectura.
    it('muestra el log de trazabilidad con etiquetas legibles, sin controles de edicion ni borrado (criterio 4/5)', () => {
        cy.intercept('GET', '**/api/auditoria/trazabilidad', {
            statusCode: 200,
            body: [
                {
                    id: 2,
                    tipoAccion: 'INICIO_SESION',
                    usuarioNombre: 'William A. Molina Quirós',
                    codBod: null,
                    resultado: 'EXITOSO',
                    detalle: null,
                    fecha: '2026-10-14T13:00:00Z',
                },
                {
                    id: 1,
                    tipoAccion: 'CONTEO_REGISTRADO',
                    usuarioNombre: 'Andrey Meléndez',
                    codBod: 'MEPRIN',
                    resultado: 'EXITOSO',
                    detalle: 'Reactivo de prueba: 9',
                    fecha: '2026-10-14T12:00:00Z',
                },
            ],
        }).as('listarTrazabilidad')

        cy.visitarConSesion('/trazabilidad', usuarioDeCampo(202))
        cy.wait('@listarTrazabilidad')

        cy.contains('Inicio de sesión').should('be.visible')
        cy.contains('Conteo registrado').should('be.visible')
        cy.contains('Reactivo de prueba: 9').should('be.visible')
        // Acotado al contenido propio de la pantalla -- AppLayout (menu,
        // encabezado) si tiene sus propios botones, ajenos a este criterio.
        cy.get('main').find('button').should('not.exist')
    })

    // No tiene icono propio en el menu principal a proposito (para no sumar
    // uno mas al nav) -- el acceso vive en Ajustes.
    it('se puede llegar a la pantalla de trazabilidad desde Ajustes', () => {
        cy.intercept('GET', '**/api/auditoria/trazabilidad', { statusCode: 200, body: [] }).as('listarTrazabilidad')

        cy.visitarConSesion('/ajustes', usuarioDeCampo(203))
        cy.contains('a', 'Ver registro de trazabilidad').click()

        cy.url().should('include', '/trazabilidad')
        cy.contains('Todavía no hay registros de trazabilidad.').should('be.visible')
    })
})
