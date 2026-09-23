// HU-045 - Cierre de sesión por intentos fallidos y desbloqueo manual (#61)
// Pruebas funcionales contra el backend real. Se crean cuentas en estado
// PENDIENTE_PRIMER_INGRESO por el flujo real (API + correo MailHog) y se les
// provoca el bloqueo realizando 4 intentos fallidos consecutivos.
//
// Criterios: CA1 (tras varios intentos fallidos la cuenta se bloquea), CA2 (el
// usuario bloqueado no puede ingresar y el administrador ve el estado), CA3 (el
// administrador desbloquea y el usuario vuelve a ingresar sin perder la
// obligacion de primer ingreso cuando aplica). El desbloqueo automatico por
// vencimiento del MINUTOS_BLOQUEO (7) requiere esperar 7 minutos en vivo y se
// documenta en el task; tambien se documenta que bloqueadoHasta se conserva.
describe('HU-045 - Bloqueo por intentos fallidos y desbloqueo manual', () => {
    const contrasenaAdmin = 'Capris2026!'
    const idsCreados = []

    function crearUsuarioPendiente() {
        const sufijo = Date.now().toString().slice(-6)
        const usuario = {
            nombreCompleto: `QA Bloqueo ${sufijo}`,
            cedula: `QA-CED-BLO-${sufijo}`,
            correo: `qa-bloqueo-${sufijo}@capris.co.cr`,
            username: `qa_bl_${sufijo}`,
        }

        return cy.vaciarCorreos()
            .request({
                method: 'POST',
                url: 'http://localhost:8080/api/auth/login',
                body: {
                    username: 'wmolina',
                    contrasena: contrasenaAdmin,
                    empresaId: 1,
                },
            })
            .then((login) => login.body.token)
            .then((token) => cy.request({
                method: 'POST',
                url: 'http://localhost:8080/api/usuarios',
                headers: { Authorization: `Bearer ${token}` },
                body: {
                    nombreCompleto: usuario.nombreCompleto,
                    cedula: usuario.cedula,
                    correo: usuario.correo,
                    username: usuario.username,
                    rolId: 2,
                },
            }).then((resp) => idsCreados.push(resp.body.id)))
            .then(() => cy.obtenerUltimoCorreo(usuario.correo))
            .then((correo) => ({
                username: usuario.username,
                temporal: correo.cuerpo.match(/Contraseña temporal: (\S+)/)[1],
            }))
    }

    function provocarBloqueo(username) {
        const intentos = [0, 1, 2, 3]

        cy.wrap(intentos).each((indice) => {
            cy.request({
                method: 'POST',
                url: 'http://localhost:8080/api/auth/login',
                body: { username, contrasena: 'ContraseñaErronea99!', empresaId: 1 },
                failOnStatusCode: false,
            }).then((resp) => {
                const esperado = indice < 3 ? 401 : 423
                expect(resp.status).to.equal(esperado)
            })
        })
    }

    after(() => {
        cy.request({
            method: 'POST',
            url: 'http://localhost:8080/api/auth/login',
            body: {
                username: 'wmolina',
                contrasena: contrasenaAdmin,
                empresaId: 1,
            },
        }).then((login) => login.body.token)
            .then((token) => {
                cy.wrap(idsCreados).each((id) => {
                    cy.request({
                        method: 'POST',
                        url: `http://localhost:8080/api/usuarios/${id}/inactivar`,
                        headers: { Authorization: `Bearer ${token}` },
                        failOnStatusCode: false,
                    })
                })
            })
    })

    it('CA1 + CA2 - cuatro intentos fallidos bloquean la cuenta y el admin la ve BLOQUEADO', () => {
        crearUsuarioPendiente().then((cuenta) => {
            provocarBloqueo(cuenta.username)

            // Aun con la clave correcta no puede ingresar mientras dure el bloqueo.
            cy.request({
                method: 'POST',
                url: 'http://localhost:8080/api/auth/login',
                body: { username: cuenta.username, contrasena: cuenta.temporal, empresaId: 1 },
                failOnStatusCode: false,
            }).then((resp) => {
                expect(resp.status).to.equal(423)
            })

            // El administrador ve la cuenta con estado BLOQUEADO (CA2).
            cy.clearAllSessionStorage()
            cy.visit('/login')
            cy.logearComo('wmolina', 1, contrasenaAdmin)
            cy.url({ timeout: 10000 }).should('include', '/dashboard')

            cy.contains('a', 'Usuarios').click()
            cy.url().should('include', '/admin/usuarios')

            cy.get('table tbody tr')
                .contains('td', cuenta.username)
                .closest('tr')
                .within(() => {
                    cy.contains('BLOQUEADO').should('be.visible')
                    cy.contains('button', 'Desbloquear').should('be.visible')
                })

            cy.screenshot('hu-045-cuenta-bloqueada-en-listado')
        })
    })

    it('CA3 - el administrador desbloquea y el usuario vuelve a ingresar (primer ingreso pendiente)', () => {
        crearUsuarioPendiente().then((cuenta) => {
            provocarBloqueo(cuenta.username)

            cy.clearAllSessionStorage()
            cy.visit('/login')
            cy.logearComo('wmolina', 1, contrasenaAdmin)
            cy.url({ timeout: 10000 }).should('include', '/dashboard')

            cy.contains('a', 'Usuarios').click()
            cy.url().should('include', '/admin/usuarios')

            cy.get('table tbody tr')
                .contains('td', cuenta.username)
                .closest('tr')
                .within(() => {
                    cy.contains('button', 'Desbloquear').click()
                })

            // Tras desbloquear la cuenta deja de estar BLOQUEADO.
            cy.get('table tbody tr')
                .contains('td', cuenta.username)
                .closest('tr')
                .within(() => {
                    cy.contains('BLOQUEADO').should('not.exist')
                    cy.contains('PENDIENTE_PRIMER_INGRESO').should('be.visible')
                })

            cy.screenshot('hu-045-cuenta-desbloqueada')

            // Cierra sesion de admin y entra como el usuario desbloqueado.
            cy.get('button[aria-label^="Menú de"]').click()
            cy.contains('[role="menuitem"]', 'Cerrar sesión').click()
            cy.url().should('include', '/login')

            cy.logearComo(cuenta.username, 1, cuenta.temporal)

            cy.url({ timeout: 10000 })
                .should('include', '/primer-ingreso/cambiar-password')

            cy.screenshot('hu-045-acceso-tras-desbloqueo')
        })
    })
})