
describe('HU-022 - Gestionar perfil del usuario', () => {

    const perfil = {
        id: 3,
        nombreCompleto: 'William A. Molina Quirós',
        correo: 'william@capris.cr',
        username: 'william',
        rol: 'Administrador',
        empresa: 'CAPRIS Médica',
        estado: 'ACTIVO',
        bloqueado: false,
        bloqueadoHasta: null,
    }

    beforeEach(() => {
        cy.intercept('GET', '**/api/usuarios/perfil', {
            statusCode: 200,
            body: perfil,
        }).as('consultarPerfil')

        cy.visitarConSesion('/ajustes')
        cy.wait('@consultarPerfil')
    })

    it('muestra la información del usuario autenticado', () => {
        cy.contains('h2', 'Información del usuario')
            .should('be.visible')

        cy.contains(perfil.nombreCompleto)
            .should('be.visible')

        cy.contains(perfil.correo)
            .should('be.visible')
    })

    it('muestra el rol y la empresa activa', () => {
        cy.contains('Información del usuario')
            .parent()
            .within(() => {
                cy.contains(perfil.rol).should('be.visible')
                cy.contains(perfil.empresa).should('be.visible')
            })
    })

    it('consulta el perfil utilizando el JWT', () => {
        cy.get('@consultarPerfil').then(({ request }) => {
            expect(request.headers.authorization)
                .to.equal('Bearer jwt-prueba')
        })
    })

    it('no permite editar la información del perfil', () => {
        cy.contains('h2', 'Información del usuario')
            .parent()
            .within(() => {
                cy.get('input').should('not.exist')
                cy.get('textarea').should('not.exist')
                cy.get('button').should('not.exist')
            })
    })

    it('mantiene las funcionalidades de Ajustes', () => {
        cy.contains('h2', 'Apariencia')
            .should('be.visible')

        cy.contains('button', 'Cambiar contraseña')
            .should('be.visible')
    })

    it('muestra un error cuando falla la consulta', () => {
        cy.intercept('GET', '**/api/usuarios/perfil', {
            statusCode: 500,
            body: {
                mensaje: 'No fue posible consultar el perfil',
            },
        }).as('perfilError')

        cy.reload()
        cy.wait('@perfilError')

        cy.contains(
            '[role="alert"]',
            'No fue posible consultar el perfil'
        ).should('be.visible')
    })

})
