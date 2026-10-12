const USUARIO_DE_CAMPO = {
    id: 21,
    nombreCompleto: 'Andrey Meléndez',
    rol: 'Usuario de Campo',
    empresaNombre: 'CAPRIS Médica',
}

function parada(codBod, desBod, numCon, objCon) {
    return { codBod, desBod, numCon, objCon, estadoErp: 'PEND', estadoApp: 'PENDIENTE', fechaAsignada: null }
}

// Los contratos de Mi ruta salen de la ruta guardada localmente (HU-037).
const RUTA = [
    parada('HMEX', 'Hospital México', 'C-001', 'HEMATOLOGÍA'),
    parada('HSJD', 'Hospital San Juan de Dios', 'C-001', 'HEMATOLOGÍA'),
    parada('HCAL', 'Hospital Calderón Guardia', 'C-002', 'QUÍMICA CLÍNICA'),
]

const BODEGAS = RUTA.map(({ codBod, desBod, numCon }) => ({ codBod, desBod, numCon, tipoBod: 'CLI' }))

// El mismo articulo de HMEX bajo dos contratos: en Conteo solo tiene que
// aparecer el del contrato activo.
const DETALLE_HMEX = [
    {
        codArt: 'ART1',
        desArt: 'Reactivo de hematologia',
        cantidadTeorica: 10,
        indicadorLote: false,
        numCon: 'C-001',
        cantidadMinima: null,
    },
    {
        codArt: 'ART1',
        desArt: 'Reactivo de hematologia',
        cantidadTeorica: 99,
        indicadorLote: false,
        numCon: 'C-002',
        cantidadMinima: null,
    },
]

describe('HU-004 - Seleccion de contexto de auditoria (desde Mi ruta)', () => {
    beforeEach(() => {
        cy.intercept('GET', '**/api/auditoria/visitas/mi-ruta', { statusCode: 200, body: RUTA }).as('miRuta')
        cy.intercept('GET', '**/api/auditoria/bodegas', { statusCode: 200, body: BODEGAS })
        // Cypress usa el intercept definido mas recientemente: el generico va primero.
        cy.intercept('GET', '**/api/auditoria/bodegas/*/detalle', { statusCode: 200, body: [] })
        cy.intercept('GET', '**/api/auditoria/bodegas/HMEX/detalle', { statusCode: 200, body: DETALLE_HMEX })
        cy.intercept('GET', '**/api/auditoria/bodegas/*/lotes', { statusCode: 200, body: [] })
        cy.intercept('GET', '**/api/auditoria/jornadas/hoy', {
            statusCode: 200,
            body: { iniciada: true, iniciadaEn: new Date().toISOString() },
        })
    })

    it('muestra los contratos del usuario como tarjetas, sin selector de compañía (criterios 1 y 4)', () => {
        cy.visitarConSesion('/mi-ruta', USUARIO_DE_CAMPO)
        cy.wait('@miRuta')

        cy.contains('button', 'C-001 · HEMATOLOGÍA').should('contain', '2 bodegas pendientes')
        cy.contains('button', 'C-002 · QUÍMICA CLÍNICA').should('contain', '1 bodega pendiente')
        cy.get('select').should('not.exist')
        cy.contains('Hospital México').should('not.exist')
    })

    it('la busqueda filtra sin tildes ni mayusculas y avisa si no hay resultados', () => {
        cy.visitarConSesion('/mi-ruta', USUARIO_DE_CAMPO)
        cy.wait('@miRuta')

        cy.get('input[aria-label="Buscar contrato..."]').type('quimica')
        cy.contains('button', 'C-002 · QUÍMICA CLÍNICA').should('be.visible')
        cy.contains('C-001 · HEMATOLOGÍA').should('not.exist')

        cy.get('input[aria-label="Buscar contrato..."]').clear().type('no existe')
        cy.contains('No se encontraron contratos con ese criterio').should('be.visible')
    })

    it('tocar una tarjeta activa el contrato y muestra solo sus bodegas, aun recargando (criterio 2)', () => {
        cy.visitarConSesion('/mi-ruta', USUARIO_DE_CAMPO)
        cy.wait('@miRuta')

        cy.contains('button', 'C-001 · HEMATOLOGÍA').click()

        cy.get('[data-testid="contexto-activo"]').should('contain', 'Contexto activo: C-001 · HEMATOLOGÍA')
        cy.contains('Hospital México').should('be.visible')
        cy.contains('Hospital San Juan de Dios').should('be.visible')
        cy.contains('Hospital Calderón Guardia').should('not.exist')

        cy.reload()
        cy.get('[data-testid="contexto-activo"]').should('contain', 'C-001 · HEMATOLOGÍA')
    })

    it('reemplazar el contexto pide confirmacion y solo al confirmar se reemplaza (criterio 3)', () => {
        cy.visitarConSesion('/mi-ruta', USUARIO_DE_CAMPO)
        cy.wait('@miRuta')
        cy.contains('button', 'C-001 · HEMATOLOGÍA').click()

        cy.contains('button', 'Cambiar').click()
        cy.contains('button', 'C-001 · HEMATOLOGÍA').should('contain', 'Contrato activo')
        cy.contains('button', 'C-002 · QUÍMICA CLÍNICA').click()
        cy.get('[role="alertdialog"]').should(
            'contain',
            'Cambiar de contexto reemplazará C-001 · HEMATOLOGÍA por C-002 · QUÍMICA CLÍNICA',
        )

        // Cancelar mantiene el contexto anterior.
        cy.get('[role="alertdialog"]').contains('button', 'Cancelar').click()
        cy.get('[data-testid="contexto-activo"]').should('contain', 'C-001 · HEMATOLOGÍA')

        // Confirmar lo reemplaza.
        cy.contains('button', 'C-002 · QUÍMICA CLÍNICA').click()
        cy.get('[role="alertdialog"]').contains('button', 'Cambiar contexto').click()
        cy.get('[data-testid="contexto-activo"]').should('contain', 'C-002 · QUÍMICA CLÍNICA')
        cy.contains('Hospital Calderón Guardia').should('be.visible')
        cy.contains('Hospital México').should('not.exist')
    })

    it('tocar una bodega del contrato lleva a Conteo con esa bodega y solo los articulos del contrato', () => {
        cy.visitarConSesion('/mi-ruta', USUARIO_DE_CAMPO)
        cy.wait('@miRuta')
        cy.contains('button', 'C-001 · HEMATOLOGÍA').click()

        cy.contains('button', 'Hospital México').click()

        cy.location('pathname').should('eq', '/conteo')
        // Conteo confirma la jornada antes de mostrar el formulario (HU-038).
        cy.get('[data-testid="contrato-activo"]', { timeout: 10000 }).should('contain', 'C-001 · HEMATOLOGÍA')
        cy.get('#conteo-bodega').should('have.value', 'HMEX')
        cy.get('#conteo-articulo').should('contain', 'Reactivo de hematologia (teórico: 10)')
        cy.get('#conteo-articulo').should('not.contain', 'teórico: 99')
    })
})
