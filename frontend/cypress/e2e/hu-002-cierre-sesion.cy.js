describe('HU-002 - Cerrar sesión del sistema', () => {
    beforeEach(() => {
        cy.intercept('GET', '**/api/empresas', {
            statusCode: 200,
            body: [
                {
                    id: 1,
                    nombre: 'CAPRIS Médica',
                },
            ],
        }).as('obtenerEmpresas')

        cy.intercept('POST', '**/api/auth/login', {
            statusCode: 200,
            body: {
                token: 'jwt-prueba-hu002',
                usuarioId: 3,
                nombreCompleto: 'William A. Molina Quirós',
                rol: 'Administrador',
                debeCambiarContrasena: false,
            },
        }).as('login')

        cy.intercept('POST', '**/api/auth/logout', {
            statusCode: 204,
        }).as('logout')
    })

    function iniciarSesion() {
        cy.visit('/login')

        cy.get('#username')
            .type('wmolina')

        cy.get('#contrasena')
            .type('Capris2026!')

        cy.contains('button', 'Iniciar sesión')
            .click()

        cy.wait('@login')

        cy.url()
            .should('include', '/dashboard')
    }

    it('permite cerrar sesion y vuelve al login', () => {
        iniciarSesion()

        cy.contains('button', 'Cerrar sesión')
            .should('be.visible')
            .click()

        cy.wait('@logout')

        cy.url()
            .should('include', '/login')
    })

    it('elimina las credenciales de autenticacion al cerrar sesion', () => {
        iniciarSesion()

        cy.window().then((win) => {
            expect(
                win.sessionStorage.getItem('capris_token'),
            ).to.equal('jwt-prueba-hu002')

            expect(
                win.sessionStorage.getItem('capris_usuario'),
            ).not.to.equal(null)
        })

        cy.contains('button', 'Cerrar sesión')
            .click()

        cy.wait('@logout')

        cy.window().then((win) => {
            expect(
                win.sessionStorage.getItem('capris_token'),
            ).to.equal(null)

            expect(
                win.sessionStorage.getItem('capris_usuario'),
            ).to.equal(null)
        })
    })

    it('conserva datos locales que no pertenecen a la autenticacion', () => {
        iniciarSesion()

        cy.window().then((win) => {
            win.localStorage.setItem(
                'capris_datos_offline_prueba',
                'conteo-pendiente',
            )
        })

        cy.contains('button', 'Cerrar sesión')
            .click()

        cy.wait('@logout')

        cy.window().then((win) => {
            expect(
                win.localStorage.getItem(
                    'capris_datos_offline_prueba',
                ),
            ).to.equal('conteo-pendiente')

            expect(
                win.sessionStorage.getItem('capris_token'),
            ).to.equal(null)
        })
    })

    it('impide regresar al dashboard despues de cerrar sesion', () => {
        iniciarSesion()

        cy.contains('button', 'Cerrar sesión')
            .click()

        cy.wait('@logout')

        cy.visit('/dashboard')

        cy.url()
            .should('include', '/login')
    })

    it('permite iniciar una nueva sesion despues del logout', () => {
        iniciarSesion()

        cy.contains('button', 'Cerrar sesión')
            .click()

        cy.wait('@logout')

        cy.get('#username')
            .type('wmolina')

        cy.get('#contrasena')
            .type('Capris2026!')

        cy.contains('button', 'Iniciar sesión')
            .click()

        cy.wait('@login')

        cy.url()
            .should('include', '/dashboard')
    })
})