// HU-044 - Cambio de contraseña obligatorio en primer ingreso (#59)
// Pruebas funcionales contra el backend real. La cuenta en estado
// PENDIENTE_PRIMER_INGRESO se crea por el flujo real de HU-047 (API + correo
// de credenciales en MailHog).
//
// Criterios automatizados: CA2 (pantalla forzada antes que cualquier modulo,
// incluido el bloqueo a nivel de API), CA3 (doble confirmacion y politica de
// complejidad; la prohibicion de reutilizar la temporal no aplica en primer
// ingreso por diseno del backend y se documenta en el task), CA4 (eliminacion
// de la temporal, estado ACTIVO y acceso con la nueva).
// CA1 (vigencia de 24h de la temporal) y CA5 (interrupcion del proceso) se
// documentan en el task: requieren intervencion manual / inducir fallos.
describe('HU-044 - Cambio de contraseña obligatorio en primer ingreso', () => {
    const nuevaContrasena = 'QaNueva88!'
    const contrasenaAdmin = 'Capris2026!'
    const idsCreados = []

    function crearUsuarioPendiente() {
        const sufijo = Date.now().toString().slice(-6)
        const usuario = {
            nombreCompleto: `QA Primer Ingreso ${sufijo}`,
            cedula: `QA-CED-PI-${sufijo}`,
            correo: `qa-primer-ingreso-${sufijo}@capris.co.cr`,
            username: `qa_pi_${sufijo}`,
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

    function cerrarSesionDesdeMenu() {
        cy.get('button[aria-label^="Menú de"]').click()
        cy.contains('[role="menuitem"]', 'Cerrar sesión').click()
        cy.url().should('include', '/login')
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

    beforeEach(() => {
        cy.clearAllSessionStorage()
        cy.visit('/login')
        cy.contains('h1', 'Iniciar sesión').should('be.visible')
    })

    it('CA2 - redirige de forma obligatoria al cambio de contraseña y bloquea el resto', () => {
        crearUsuarioPendiente().then((cuenta) => {
            cy.logearComo(cuenta.username, 1, cuenta.temporal)

            // El unico destino permitido es la pantalla de cambio obligatorio.
            cy.url({ timeout: 10000 })
                .should('include', '/primer-ingreso/cambiar-password')

            cy.contains('h1', 'Cambie su contraseña')
                .should('be.visible')

            cy.screenshot('hu-044-pantalla-obligatoria')

            // Intentar entrar a otro modulo (aun por URL directa) no prospera.
            cy.visit('/dashboard')
            cy.url().should('include', '/primer-ingreso/cambiar-password')

            cy.screenshot('hu-044-bloqueo-de-modulos')

            // El backend tambien rechaza las rutas fuera de la pantalla con el
            // token de la cuenta pendiente (CA2 a nivel de API).
            cy.window().then((win) => {
                const token = win.sessionStorage.getItem('capris_token')

                cy.request({
                    method: 'GET',
                    url: 'http://localhost:8080/api/usuarios',
                    headers: { Authorization: `Bearer ${token}` },
                    failOnStatusCode: false,
                }).then((resp) => {
                    expect(resp.status).to.be.oneOf([401, 403])
                })
            })
        })
    })

    it('CA3 - exige doble confirmacion y politica de complejidad antes de guardar', () => {
        crearUsuarioPendiente().then((cuenta) => {
            cy.logearComo(cuenta.username, 1, cuenta.temporal)
            cy.url({ timeout: 10000 })
                .should('include', '/primer-ingreso/cambiar-password')

            // Confirmacion que no coincide: no sale del formulario.
            cy.campoContrasena('Contraseña nueva').type(nuevaContrasena)
            cy.campoContrasena('Confirmar contraseña nueva').type('QaNuevaDistinta99!')
            cy.contains('button', 'Guardar y continuar').click()

            cy.contains('La confirmación no coincide con la contraseña nueva.')
                .should('be.visible')

            // Contraseña que no cumple la politica (HU-042): el backend la
            // rechaza con los detalles de cada requisito.
            cy.campoContrasena('Contraseña nueva').clear().type('abc123')
            cy.campoContrasena('Confirmar contraseña nueva').clear().type('abc123')
            cy.contains('button', 'Guardar y continuar').click()

            cy.contains('La contraseña debe tener al menos 8 caracteres')
                .should('be.visible')
            cy.contains('La contraseña debe contener al menos una letra mayúscula')
                .should('be.visible')
            cy.contains('La contraseña debe contener al menos un carácter especial')
                .should('be.visible')

            // Segunda clave debil: sin digitos, para cubrir la regla de numero.
            cy.campoContrasena('Contraseña nueva').clear().type('Abcdefghi!')
            cy.campoContrasena('Confirmar contraseña nueva').clear().type('Abcdefghi!')
            cy.contains('button', 'Guardar y continuar').click()

            cy.contains('La contraseña debe contener al menos un número')
                .should('be.visible')

            cy.screenshot('hu-044-rechazo-politica-contrasena')

            // Debe seguir en la pantalla obligatoria.
            cy.url().should('include', '/primer-ingreso/cambiar-password')
        })
    })

    it('CA4 - guarda la nueva contraseña, activa la cuenta y elimina la temporal', () => {
        crearUsuarioPendiente().then((cuenta) => {
            cy.logearComo(cuenta.username, 1, cuenta.temporal)
            cy.url({ timeout: 10000 })
                .should('include', '/primer-ingreso/cambiar-password')

            cy.campoContrasena('Contraseña nueva').type(nuevaContrasena)
            cy.campoContrasena('Confirmar contraseña nueva').type(nuevaContrasena)
            cy.contains('button', 'Guardar y continuar').click()

            // Tras guardar pasa al dashboard con acceso normal.
            cy.url({ timeout: 10000 })
                .should('include', '/dashboard')

            cy.screenshot('hu-044-primer-ingreso-completado')

            // La clave temporal quedo inutilizable (CA4: se elimina).
            cy.request({
                method: 'POST',
                url: 'http://localhost:8080/api/auth/login',
                body: { username: cuenta.username, contrasena: cuenta.temporal, empresaId: 1 },
                failOnStatusCode: false,
            }).then((resp) => {
                expect(resp.status).to.equal(401)
            })

            // Cierra sesion y reingresa con la contraseña que definio el usuario:
            // el sistema ya no lo obliga a cambiar nada.
            cerrarSesionDesdeMenu()

            cy.logearComo(cuenta.username, 1, nuevaContrasena)

            cy.url({ timeout: 10000 })
                .should('include', '/dashboard')

            cy.screenshot('hu-044-login-con-nueva-contrasena')
        })
    })
})