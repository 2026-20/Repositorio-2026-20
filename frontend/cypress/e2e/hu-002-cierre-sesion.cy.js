// HU-002 - Cerrar sesión del sistema
// Pruebas funcionales contra el backend real (localhost:8080).
// Criterios cubiertos: CA1 (elimina tokens de sesión), CA2/CA3 (bloquea acceso y
// datos locales hasta nueva autenticación), CA4 (cerrar sesión desde pantalla
// principal), CA5 (pantalla de login tras cerrar sesión).
describe('HU-002 - Cerrar sesión del sistema', () => {
    function iniciarSesion() {
        cy.visit('/login')

        cy.get('#empresa')
            .select('1')

        cy.get('#username')
            .type('wmolina')

        cy.get('#contrasena')
            .type('Capris2026!')

        cy.contains('button', 'Iniciar sesión')
            .click()

        cy.url()
            .should('include', '/dashboard')
    }

    function cerrarSesion() {
        cy.get('button[aria-label^="Menú de"]')
            .click()

        cy.contains('[role="menuitem"]', 'Cerrar sesión')
            .should('be.visible')
            .click()
    }

    function obtenerToken() {
        return cy.window()
            .then((win) => win.sessionStorage.getItem('capris_token'))
    }

    it('CA5/CA4 - permite cerrar sesión desde la pantalla principal y vuelve al login', () => {
        iniciarSesion()

        cerrarSesion()

        cy.url()
            .should('include', '/login')

        cy.screenshot('hu-002-login-tras-cierre')
    })

    it('CA1 - elimina las credenciales de sesión del dispositivo', () => {
        iniciarSesion()

        cy.window().then((win) => {
            expect(win.sessionStorage.getItem('capris_token')).not.to.equal(null)
            expect(win.sessionStorage.getItem('capris_usuario')).not.to.equal(null)
        })

        cerrarSesion()

        cy.url()
            .should('include', '/login')

        cy.window().then((win) => {
            expect(win.sessionStorage.getItem('capris_token')).to.equal(null)
            expect(win.sessionStorage.getItem('capris_usuario')).to.equal(null)
        })
    })

    it('CA1/CA3 - el token cerrado queda revocado en el servidor', () => {
        iniciarSesion()

        obtenerToken()
            .then((token) => {
                cerrarSesion()

                cy.url()
                    .should('include', '/login')

                cy.request({
                    method: 'GET',
                    url: 'http://localhost:8080/api/usuarios',
                    headers: { Authorization: `Bearer ${token}` },
                    failOnStatusCode: false,
                }).then((resp) => {
                    expect(resp.status).to.equal(401)
                })
            })

        cy.screenshot('hu-002-token-revocado')
    })

    it('CA2/CA3 - impide acceder al dashboard o a datos locales tras cerrar sesión', () => {
        iniciarSesion()

        cy.window().then((win) => {
            win.localStorage.setItem('capris_datos_offline_prueba', 'conteo-pendiente')
        })

        cerrarSesion()

        cy.url()
            .should('include', '/login')

        cy.window().then((win) => {
            expect(win.localStorage.getItem('capris_datos_offline_prueba')).to.equal('conteo-pendiente')
            expect(win.sessionStorage.getItem('capris_token')).to.equal(null)
        })

        cy.visit('/dashboard')

        cy.url()
            .should('include', '/login')
    })

    it('CA5 - permite iniciar una nueva sesión después del cierre', () => {
        iniciarSesion()

        cerrarSesion()

        cy.get('#empresa')
            .select('1')

        cy.get('#username')
            .type('wmolina')

        cy.get('#contrasena')
            .type('Capris2026!')

        cy.contains('button', 'Iniciar sesión')
            .click()

        cy.url()
            .should('include', '/dashboard')

        cy.contains('Rol: Administrador')
            .should('be.visible')
    })
})