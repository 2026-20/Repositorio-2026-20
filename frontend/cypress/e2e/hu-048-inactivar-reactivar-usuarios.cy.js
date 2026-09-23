// HU-048 - Inactivar y reactivar usuarios (#59 baja logica)
// Pruebas funcionales contra el backend real con usuarios creados por el
// flujo real y activados (primer ingreso). Criterios: la baja deja la cuenta
// INACTIVO, revoca la sesion actual (el token deja de servir), el usuario no
// vuelve a entrar y el admin la ve en el listado; el flujo inverso (reactivar,
// que la historia no pedía pero existe) restaura el acceso. Se documenta en el
// task que el criterio de propagar la baja a la cola offline no aplica: esa
// cola aun no existe en el proyecto (depende de HU-003).
describe('HU-048 - Inactivar y reactivar usuarios', () => {
    const claveInicial = 'ClaveInicial99!'
    const contrasenaAdmin = 'Capris2026!'

    after(() => {
        cy.inactivarUsuariosCreadosQA()
    })

    function activarCuenta(cuenta) {
        cy.logearComo(cuenta.username, 1, cuenta.temporal)
        cy.url({ timeout: 10000 })
            .should('include', '/primer-ingreso/cambiar-password')

        cy.campoContrasena('Contraseña nueva').type(claveInicial)
        cy.campoContrasena('Confirmar contraseña nueva').type(claveInicial)
        cy.contains('button', 'Guardar y continuar').click()
        cy.url({ timeout: 10000 }).should('include', '/dashboard')
    }

    function tokenDelCierreDeSesion() {
        return cy.window()
            .then((win) => win.sessionStorage.getItem('capris_token'))
    }

    function entrarAlListadoComoAdmin() {
        cy.clearAllSessionStorage()
        cy.visit('/login')
        cy.logearComo('wmolina', 1, contrasenaAdmin)
        cy.url({ timeout: 10000 }).should('include', '/dashboard')

        cy.contains('a', 'Usuarios').click()
        cy.url().should('include', '/admin/usuarios')
        cy.get('table tbody tr').should('have.length.at.least', 1)
    }

    function filaDe(username) {
        return cy.get('table tbody tr')
            .contains('td', username)
            .closest('tr')
    }

    it('CA1 + CA2 - inactivar por UI deja la cuenta INACTIVO y revoca su sesion', () => {
        cy.crearUsuarioPendienteQA('HUL48').then((cuenta) => {
            activarCuenta(cuenta)

            // La sesion activa actual del usuario: tras la baja debe dejar de
            // servir aunque el JWT no haya expirado (sesionesInvalidadasDesde).
            let tokenUsuario = null
            tokenDelCierreDeSesion().then((token) => {
                tokenUsuario = token

                entrarAlListadoComoAdmin()

                filaDe(cuenta.username).within(() => {
                    cy.contains('button', 'Inactivar').click()
                })

                cy.contains('[role="alertdialog"]', /¿Está seguro de que desea inactivar a/)
                    .should('be.visible')

                cy.get('#motivo-inactivacion').type('QA: prueba de baja lógica')
                cy.contains('[role="alertdialog"] button', 'Inactivar').click()

                filaDe(cuenta.username).within(() => {
                    cy.contains('INACTIVO').should('be.visible')
                })

                cy.screenshot('hu-048-cuenta-inactivada')

                // La sesion emitida antes de la baja ya no autentica.
                cy.request({
                    method: 'GET',
                    url: 'http://localhost:8080/api/usuarios',
                    headers: { Authorization: `Bearer ${tokenUsuario}` },
                    failOnStatusCode: false,
                }).then((resp) => {
                    expect(resp.status).to.be.oneOf([401, 403])
                })

                // Y con la contraseña correcta tampoco entra.
                cy.request({
                    method: 'POST',
                    url: 'http://localhost:8080/api/auth/login',
                    body: { username: cuenta.username, contrasena: claveInicial, empresaId: 1 },
                    failOnStatusCode: false,
                }).then((resp) => {
                    expect(resp.status).to.equal(401)
                })
            })
        })
    })

    it('CA3 - reactivar restaura el acceso y el usuario vuelve al dashboard', () => {
        cy.crearUsuarioPendienteQA('HUL48R').then((cuenta) => {
            activarCuenta(cuenta)

            // Baja previa por API para probar el flujo inverso desde la UI.
            cy.request({
                method: 'POST',
                url: 'http://localhost:8080/api/auth/login',
                body: { username: 'wmolina', contrasena: contrasenaAdmin, empresaId: 1 },
            }).then((login) => login.body.token)
                .then((token) => {
                    expect(token).to.be.a('string')
                    cy.request({
                        method: 'POST',
                        url: `http://localhost:8080/api/usuarios/${cuenta.id}/inactivar`,
                        headers: { Authorization: `Bearer ${token}` },
                    }).then((resp) => {
                        expect(resp.body.estado).to.equal('INACTIVO')
                    })
                })

            entrarAlListadoComoAdmin()

            filaDe(cuenta.username).within(() => {
                cy.contains('INACTIVO').should('be.visible')
                cy.contains('button', 'Reactivar').click()
            })

            filaDe(cuenta.username).within(() => {
                cy.contains('ACTIVO', { timeout: 10000 }).should('be.visible')
            })

            cy.screenshot('hu-048-cuenta-reactivada')

            // Cierra sesion de admin y entra como el usuario reactivado.
            cy.get('button[aria-label^="Menú de"]').click()
            cy.contains('[role="menuitem"]', 'Cerrar sesión').click()
            cy.url().should('include', '/login')

            cy.logearComo(cuenta.username, 1, claveInicial)

            cy.url({ timeout: 10000 }).should('include', '/dashboard')

            cy.screenshot('hu-048-reingreso-tras-reactivacion')
        })
    })
})