// HU-043 - Cambio de contraseña (voluntario, desde Ajustes)
// Pruebas funcionales contra el backend real con una cuenta ACTIVA creada por
// el flujo real (crearUsuarioPendienteQA + primer ingreso). Criterios: CA1 la
// contraseña actual se exige y se valida (una erronea rebota sin cambiar nada),
// CA2 no se permite reutilizar la actual, CA3 la nueva debe cumplir la politica
// (HU-042) y tras el exito el usuario reingresa con la nueva y la anterior
// queda inutilizable. El bloqueo por repetir la actual erronea se prueba en
// HU-045 (4 intentos); aqui se hace un solo intento malo para no tocar limites.
describe('HU-043 - Cambio de contraseña en Ajustes', () => {
    const claveInicial = 'PrimeraClave99!'
    const claveNueva = 'SegundaClave88!'

    after(() => {
        cy.inactivarUsuariosCreadosQA()
    })

    function irAjustesDesdeDashboard() {
        cy.url().should('include', '/dashboard')

        cy.contains('a', 'Ajustes').click()
        cy.url().should('include', '/ajustes')
        cy.contains('h1', 'Ajustes').should('be.visible')

        // El formulario vive en un modal que se abre al pedir el cambio.
        cy.contains('button', 'Cambiar contraseña').click()
        cy.contains('label', /^Contraseña actual$/).should('be.visible')
    }

    beforeEach(() => {
        cy.clearAllSessionStorage()
        cy.visit('/login')
        cy.contains('h1', 'Iniciar sesión').should('be.visible')
    })

    function enviarFormulario(actual, nueva, confirmacion = nueva) {
        cy.campoContrasena('Contraseña actual').type(actual)
        cy.campoContrasena('Contraseña nueva').type(nueva)
        cy.campoContrasena('Confirmar contraseña nueva').type(confirmacion)
        cy.contains('button', 'Guardar').click()
    }

    it('CA1 - con la contraseña actual incorrecta el cambio no se aplica', () => {
        cy.crearUsuarioPendienteQA('HUL43M').then((cuenta) => {
            cy.logearComo(cuenta.username, 1, cuenta.temporal)
            cy.url({ timeout: 10000 })
                .should('include', '/primer-ingreso/cambiar-password')

            cy.campoContrasena('Contraseña nueva').type(claveInicial)
            cy.campoContrasena('Confirmar contraseña nueva').type(claveInicial)
            cy.contains('button', 'Guardar y continuar').click()
            cy.url({ timeout: 10000 }).should('include', '/dashboard')

            irAjustesDesdeDashboard()

            cy.screenshot('hu-043-formulario-cambio-contrasena')

            // Un unico intento con la actual errada: rebota sin cambiar nada.
            enviarFormulario('ActualErronea99', 'NuevaInventada77!')

            cy.contains('La contraseña actual no es correcta').should('be.visible')
            cy.url().should('include', '/ajustes')

            cy.screenshot('hu-043-rechazo-contrasena-actual')
        })
    })

    it('CA2 - no se permite reutilizar la contraseña actual como nueva', () => {
        cy.crearUsuarioPendienteQA('HUL43R').then((cuenta) => {
            cy.logearComo(cuenta.username, 1, cuenta.temporal)
            cy.url({ timeout: 10000 })
                .should('include', '/primer-ingreso/cambiar-password')

            cy.campoContrasena('Contraseña nueva').type(claveInicial)
            cy.campoContrasena('Confirmar contraseña nueva').type(claveInicial)
            cy.contains('button', 'Guardar y continuar').click()
            cy.url({ timeout: 10000 }).should('include', '/dashboard')

            irAjustesDesdeDashboard()

            enviarFormulario(claveInicial, claveInicial)

            cy.contains('La contraseña nueva no puede ser igual a la actual')
                .should('be.visible')
            cy.url().should('include', '/ajustes')
        })
    })

    it('CA3 - una clave que no cumple la politica rebota con el detalle', () => {
        cy.crearUsuarioPendienteQA('HUL43P').then((cuenta) => {
            cy.logearComo(cuenta.username, 1, cuenta.temporal)
            cy.url({ timeout: 10000 })
                .should('include', '/primer-ingreso/cambiar-password')

            cy.campoContrasena('Contraseña nueva').type(claveInicial)
            cy.campoContrasena('Confirmar contraseña nueva').type(claveInicial)
            cy.contains('button', 'Guardar y continuar').click()
            cy.url({ timeout: 10000 }).should('include', '/dashboard')

            irAjustesDesdeDashboard()

            enviarFormulario(claveInicial, 'debil')

            cy.contains('La contraseña debe tener al menos 8 caracteres')
                .should('be.visible')
            cy.url().should('include', '/ajustes')
        })
    })

    it('CA4 - confirma el cambio, reingresa con la nueva y la anterior queda inservible', () => {
        cy.crearUsuarioPendienteQA('HUL43C').then((cuenta) => {
            cy.logearComo(cuenta.username, 1, cuenta.temporal)
            cy.url({ timeout: 10000 })
                .should('include', '/primer-ingreso/cambiar-password')

            cy.campoContrasena('Contraseña nueva').type(claveInicial)
            cy.campoContrasena('Confirmar contraseña nueva').type(claveInicial)
            cy.contains('button', 'Guardar y continuar').click()
            cy.url({ timeout: 10000 }).should('include', '/dashboard')

            irAjustesDesdeDashboard()

            enviarFormulario(claveInicial, claveNueva)

            cy.contains('La contraseña se cambió correctamente.')
                .should('be.visible')

            cy.screenshot('hu-043-cambio-exitoso')

            // La anterior ya no ingresa y la nueva si, y entra directo al
            // dashboard (la cuenta sigue ACTIVA).
            cy.request({
                method: 'POST',
                url: 'http://localhost:8080/api/auth/login',
                body: { username: cuenta.username, contrasena: claveInicial, empresaId: 1 },
                failOnStatusCode: false,
            }).then((resp) => {
                expect(resp.status).to.equal(401)
            })

            cy.get('button[aria-label^="Menú de"]').click()
            cy.contains('[role="menuitem"]', 'Cerrar sesión').click()
            cy.url().should('include', '/login')

            cy.logearComo(cuenta.username, 1, claveNueva)

            cy.url({ timeout: 10000 }).should('include', '/dashboard')

            cy.screenshot('hu-043-reingreso-con-la-nueva')
        })
    })
})