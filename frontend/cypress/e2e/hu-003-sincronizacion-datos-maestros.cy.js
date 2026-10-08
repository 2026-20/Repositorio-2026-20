describe('HU-003 - Sincronizacion de catalogos maestros', () => {
    beforeEach(() => {
        cy.intercept('GET', '**/api/auditoria/bodegas', {
            statusCode: 200,
            body: [{ codBod: 'MEPRIN', desBod: 'Bodega Medicamentos Principal', numCon: '123', tipoBod: 'CLI' }],
        }).as('bodegas')

        cy.intercept('GET', '**/api/auditoria/bodegas/MEPRIN/detalle', {
            statusCode: 200,
            body: [
                {
                    codArt: 'ART1',
                    desArt: 'Articulo 1',
                    cantidadTeorica: 10,
                    indicadorLote: false,
                    numCon: '123',
                    cantidadMinima: 2,
                },
            ],
        }).as('detalle')

        cy.intercept('GET', '**/api/auditoria/bodegas/MEPRIN/lotes', {
            statusCode: 200,
            body: [],
        }).as('lotes')
    })

    it('sincroniza automaticamente al entrar con sesion activa (criterio 1) y muestra el resultado', () => {
        cy.visitarConSesion('/sincronizacion')

        cy.wait('@bodegas')
        cy.wait('@detalle')
        cy.wait('@lotes')

        cy.contains('Sincronización completada').should('be.visible')
        cy.contains('Última sincronización:').should('be.visible')
        cy.contains('todavía no se ha sincronizado').should('not.exist')
    })

    it('permite repetir la sincronizacion manualmente desde el boton', () => {
        cy.visitarConSesion('/sincronizacion')

        cy.wait('@bodegas')
        cy.wait('@detalle')
        cy.wait('@lotes')

        cy.contains('button', 'Sincronizar ahora').click()

        cy.wait('@bodegas')
        cy.wait('@detalle')
        cy.wait('@lotes')

        cy.contains('Sincronización completada').should('be.visible')
    })
})
