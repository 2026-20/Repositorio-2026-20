// HU-046 - Recuperación de contraseña por OTP
// Pruebas funcionales contra el backend real. La cuenta ACTIVA se crea por el
// flujo real y se le define una contraseña conocida antes de probar la
// recuperación. El OTP se lee del correo real en MailHog.
//
// Criterios: CA1 (correo no registrado responde igual que uno registrado --
// anti-enumeración), CA2 (código incorrecto no avanza y vence / solo un uso),
// CA3 (la nueva contraseña cumple la política y no reutiliza la vigente),
// CA4 (tras reinicio se ingresa solo con la nueva).
describe('HU-046 - Recuperación de contraseña por OTP', () => {
    const claveInicial = 'ClaveInicial99!'
    const claveNueva = 'ClaveReseteada88!'

    after(() => {
        cy.inactivarUsuariosCreadosQA()
    })

    function activarUsuario(cuenta) {
        cy.logearComo(cuenta.username, 1, cuenta.temporal)
        cy.url({ timeout: 10000 })
            .should('include', '/primer-ingreso/cambiar-password')

        cy.campoContrasena('Contraseña nueva').type(claveInicial)
        cy.campoContrasena('Confirmar contraseña nueva').type(claveInicial)
        cy.contains('button', 'Guardar y continuar').click()
        cy.url({ timeout: 10000 }).should('include', '/dashboard')

        cerrarSesionDesdeMenu()
    }

    function cerrarSesionDesdeMenu() {
        cy.get('button[aria-label^="Menú de"]').click()
        cy.contains('[role="menuitem"]', 'Cerrar sesión').click()
        cy.url().should('include', '/login')
    }

    function llegarAPasoCodigo(correo) {
        cy.visit('/recuperar-contrasena')
        cy.contains('h1', 'Recuperar contraseña').should('be.visible')

        cy.get('#correo').type(correo)
        cy.contains('button', 'Enviar código').click()

        // El paso 2 muestra el formulario del código de 6 dígitos.
        cy.get('#otp', { timeout: 10000 }).should('be.visible')
    }

    function leerOtpDe(correo) {
        return cy.obtenerUltimoCorreo(correo)
            .then((correoRecibido) =>
                correoRecibido.cuerpo.match(
                    /Tu código para restablecer la contraseña es: (\d{6})/)[1])
    }

    it('CA1 - un correo no registrado recibe exactamente el mismo mensaje genérico', () => {
        cy.clearAllSessionStorage()
        cy.visit('/recuperar-contrasena')
        cy.contains('h1', 'Recuperar contraseña').should('be.visible')

        cy.vaciarCorreos()

        cy.get('#correo')
            .type('usuariodesconocido@capris.co.cr')
        cy.contains('button', 'Enviar código').click()

        cy.contains('p', /Si el correo corresponde a una cuenta registrada, vas a recibir un mensaje con instrucciones/)
            .should('be.visible')

        cy.screenshot('hu-046-anti-enumeracion')

        // Anti-enumeracion: por diseno, la pantalla avanza igual al mismo paso
        // para correos inexistentes (mismo mensaje, mismo formulario), pero el
        // sistema no genera ningun codigo real: al no existir la cuenta, no
        // hay registro del OTP y si el usuario siguiera el paso 2 fallaria.
        cy.get('#otp').should('be.visible')
    })

    it('CA2 - un código incorrecto no avanza y el correcto (leído de MailHog) sí', () => {
        cy.crearUsuarioPendienteQA('HUL46C').then((cuenta) => {
            activarUsuario(cuenta)

            cy.vaciarCorreos()
            llegarAPasoCodigo(cuenta.correo)

            cy.get('#otp').type('000000')
            cy.contains('button', 'Validar código').click()

            cy.contains('Código incorrecto o vencido').should('be.visible')
            cy.get('#otp').should('be.visible')

            cy.screenshot('hu-046-codigo-incorrecto')

            leerOtpDe(cuenta.correo).then((otp) => {
                cy.get('#otp').clear().type(otp)
                cy.contains('button', 'Validar código').click()

                // Avanza al paso de la nueva contraseña.
                cy.get('#nuevaContrasena', { timeout: 10000 })
                    .should('be.visible')

                cy.screenshot('hu-046-codigo-correcto')
            })
        })
    })

    it('CA3 - no reutiliza la contraseña vigente ni acepta una débil (detalle por API)', () => {
        cy.crearUsuarioPendienteQA('HUL46P').then((cuenta) => {
            activarUsuario(cuenta)

            cy.vaciarCorreos()
            cy.visit('/recuperar-contrasena')

            cy.request({
                method: 'POST',
                url: 'http://localhost:8080/api/auth/recuperacion/solicitar',
                body: { correo: cuenta.correo },
            }).then(() => leerOtpDe(cuenta.correo))
                .then((otp) => cy.request({
                    method: 'POST',
                    url: 'http://localhost:8080/api/auth/recuperacion/validar-otp',
                    body: { correo: cuenta.correo, otp },
                }).then((resp) => {
                    expect(resp.status).to.equal(200)
                    return resp.body.tokenSesionTemporal
                }))
                .then((token) => {
                    // Reutilizar la vigente: lo rechaza el historial (CA3).
                    cy.request({
                        method: 'POST',
                        url: 'http://localhost:8080/api/auth/recuperacion/nueva-contrasena',
                        body: { tokenSesionTemporal: token, nuevaContrasena: claveInicial },
                        failOnStatusCode: false,
                    }).then((resp) => {
                        expect(resp.status).to.equal(400)
                        expect(resp.body.detalles ?? [])
                            .to.include('No podés reutilizar una contraseña usada recientemente')
                    })

                    // Clave débil: la politica de complejidad (HU-042) aplica.
                    cy.request({
                        method: 'POST',
                        url: 'http://localhost:8080/api/auth/recuperacion/nueva-contrasena',
                        body: { tokenSesionTemporal: token, nuevaContrasena: 'abc' },
                        failOnStatusCode: false,
                    }).then((resp) => {
                        expect(resp.status).to.equal(400)
                        expect(resp.body.detalles ?? [])
                            .to.include('La contraseña debe tener al menos 8 caracteres')
                    })
                })
        })
    })

    it('CA4 - tras reiniciar la contraseña solo ingresa la nueva', () => {
        cy.crearUsuarioPendienteQA('HUL46R').then((cuenta) => {
            activarUsuario(cuenta)

            cy.vaciarCorreos()
            llegarAPasoCodigo(cuenta.correo)

            leerOtpDe(cuenta.correo).then((otp) => {
                cy.get('#otp').type(otp)
                cy.contains('button', 'Validar código').click()
                cy.get('#nuevaContrasena', { timeout: 10000 })
                    .should('be.visible')

                cy.get('#nuevaContrasena').type(claveNueva)
                cy.contains('button', 'Guardar nueva contraseña').click()

                cy.contains('p', 'Contraseña actualizada. Ya podés iniciar sesión con la nueva.')
                    .should('be.visible')

                cy.screenshot('hu-046-contrasena-restablecida')

                // La anterior qeda inservible y la nueva entra directo.
                cy.request({
                    method: 'POST',
                    url: 'http://localhost:8080/api/auth/login',
                    body: { username: cuenta.username, contrasena: claveInicial, empresaId: 1 },
                    failOnStatusCode: false,
                }).then((resp) => {
                    expect(resp.status).to.equal(401)
                })

                cy.contains('a', 'Ir a iniciar sesión').click()

                cy.logearComo(cuenta.username, 1, claveNueva)

                cy.url({ timeout: 10000 }).should('include', '/dashboard')

                cy.screenshot('hu-046-reingreso-con-nueva')
            })
        })
    })
})