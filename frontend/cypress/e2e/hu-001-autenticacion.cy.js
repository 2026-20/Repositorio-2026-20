describe('HU-001 - Autenticarse en el sistema', () => {
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
    })

    it('muestra las empresas disponibles en el login', () => {
        cy.visit('/login')

        cy.wait('@obtenerEmpresas')

        cy.get('#empresa')
            .should('contain', 'CAPRIS Médica')
    })

    it('permite iniciar sesion con credenciales validas', () => {
        cy.intercept('POST', '**/api/auth/login', {
            statusCode: 200,
            body: {
                token: 'jwt-prueba',
                usuarioId: 3,
                nombreCompleto: 'William A. Molina Quirós',
                rol: 'Administrador',
                debeCambiarContrasena: false,
            },
        }).as('login')

        cy.visit('/login')

        cy.get('#username')
            .type('wmolina')

        cy.get('#contrasena')
            .type('Capris2026!')

        cy.contains('button', 'Iniciar sesión')
            .click()

        cy.wait('@login')
            .its('request.body')
            .should('deep.equal', {
                username: 'wmolina',
                contrasena: 'Capris2026!',
                empresaId: 1,
            })

        cy.url()
            .should('include', '/dashboard')

        cy.contains('Hola, William')
            .should('be.visible')

        cy.contains('Rol: Administrador')
            .should('be.visible')
    })

    it('rechaza credenciales invalidas y permanece en login', () => {
        cy.intercept('POST', '**/api/auth/login', {
            statusCode: 401,
            body: {
                codigo: 'CREDENCIALES_INVALIDAS',
                mensaje: 'Credenciales inválidas',
            },
        }).as('loginIncorrecto')

        cy.visit('/login')

        cy.get('#username')
            .type('wmolina')

        cy.get('#contrasena')
            .type('incorrecta')

        cy.contains('button', 'Iniciar sesión')
            .click()

        cy.wait('@loginIncorrecto')

        cy.url()
            .should('include', '/login')

        cy.contains('Credenciales inválidas')
            .should('be.visible')
    })

    it('impide acceder al dashboard sin una sesion', () => {
        cy.visit('/dashboard')

        cy.url()
            .should('include', '/login')
    })
})