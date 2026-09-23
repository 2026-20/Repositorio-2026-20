// HU-001 - Autenticarse en el sistema
// Pruebas funcionales contra el backend real (localhost:8080) con datos semilla.
// Criterios cubiertos: CA1 (lista de empresas), CA2 (ingreso por usuario/contraseña),
// CA3 (impide acceso con credenciales no autorizadas), CA4 (solo usuarios autorizados
// por empresa), CA5 (mensaje de error si usuario/contraseña/empresa no permiten ingresar).
describe('HU-001 - Autenticarse en el sistema', () => {
    it('CA1 - muestra las empresas disponibles durante el inicio de sesion', () => {
        cy.visit('/login')

        cy.get('#empresa')
            .find('option')
            .should('contain.text', 'CAPRIS Médica')
            .and('contain.text', 'Diagnostika')

        cy.screenshot('hu-001-empresas')
    })

    it('CA2/CA4 - permite iniciar sesion como Administrador con credenciales validas', () => {
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

        cy.contains('Rol: Administrador')
            .should('be.visible')

        cy.screenshot('hu-001-login-admin-exitoso')
    })

    it('CA2/CA4 - permite iniciar sesion como Usuario de Campo de otra empresa', () => {
        cy.visit('/login')

        cy.get('#empresa')
            .select('2')

        cy.get('#username')
            .type('pruebadiagnostika')

        cy.get('#contrasena')
            .type('Capris2026!')

        cy.contains('button', 'Iniciar sesión')
            .click()

        cy.url()
            .should('include', '/dashboard')

        cy.contains('Rol: Usuario de Campo')
            .should('be.visible')

        cy.screenshot('hu-001-login-campo-exitoso')
    })

    it('CA3/CA5 - rechaza credenciales invalidas y permanece en login', () => {
        cy.visit('/login')

        cy.get('#empresa')
            .select('1')

        cy.get('#username')
            .type('usuario-inexistente')

        cy.get('#contrasena')
            .type('ClaveIncorrecta1!')

        cy.contains('button', 'Iniciar sesión')
            .click()

        cy.url()
            .should('include', '/login')

        cy.contains('[role="alert"]', 'no válidos')
            .should('be.visible')

        cy.screenshot('hu-001-rechazo-credenciales')
    })

    it('CA4/CA5 - rechaza acceso de un usuario autorizado en otra empresa', () => {
        cy.visit('/login')

        cy.get('#empresa')
            .select('2')

        cy.get('#username')
            .type('wmolina')

        cy.get('#contrasena')
            .type('Capris2026!')

        cy.contains('button', 'Iniciar sesión')
            .click()

        cy.url()
            .should('include', '/login')

        cy.contains('[role="alert"]', 'no válidos')
            .should('be.visible')

        cy.screenshot('hu-001-rechazo-empresa-incorrecta')
    })

    it('CA4 - impide acceder al dashboard sin una sesion activa', () => {
        cy.visit('/dashboard')

        cy.url()
            .should('include', '/login')
    })
})