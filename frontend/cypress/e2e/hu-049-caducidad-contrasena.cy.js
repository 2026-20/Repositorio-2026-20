const RUTA_CADUCIDAD = '/contrasena-vencida/cambiar-password'

describe('HU-049 - Caducidad de contraseña cada 30 días', () => {
    beforeEach(() => {
        cy.intercept('GET', '**/api/empresas', {
            statusCode: 200,
            body: [{ id: 1, nombre: 'CAPRIS Médica' }],
        }).as('obtenerEmpresas')

        cy.intercept('POST', '**/api/auth/cambiar-password', {
            statusCode: 204,
        }).as('cambiarPassword')

        cy.intercept('POST', '**/api/auth/logout', {
            statusCode: 204,
        }).as('logout')

        cy.intercept('GET', '**/api/usuarios', {
            statusCode: 200,
            body: [],
        }).as('listarUsuarios')
    })

    function completarFormulario({ actual, nueva, confirmacion }) {
        if (actual) {
            cy.campoContrasena('Contraseña actual').type(actual)
        }

        if (nueva) {
            cy.campoContrasena('Contraseña nueva').type(nueva)
        }

        if (confirmacion) {
            cy.campoContrasena('Confirmar contraseña nueva').type(confirmacion)
        }

        cy.contains('button', 'Guardar y continuar').click()
    }

    // ---- Criterio: el login informa cuando la contraseña vencio ----

    describe('login con contraseña vencida', () => {
        function iniciarSesion() {
            cy.visit('/login')
            cy.wait('@obtenerEmpresas')

            cy.get('#username').type('persona.vencida')
            cy.get('#contrasena').type('Actual123!')
            cy.contains('button', 'Iniciar sesión').click()
        }

        it('lleva al cambio por caducidad en vez del dashboard', () => {
            cy.intercept('POST', '**/api/auth/login', {
                statusCode: 200,
                body: {
                    token: 'jwt-vencida',
                    usuarioId: 21,
                    nombreCompleto: 'Persona Vencida',
                    correo: 'persona.vencida@capris.cr',
                    rol: 'Usuario de Campo',
                    debeCambiarContrasena: false,
                    contrasenaVencida: true,
                },
            }).as('login')

            iniciarSesion()
            cy.wait('@login')

            cy.url().should('include', RUTA_CADUCIDAD)
            cy.contains('h1', 'Contraseña vencida').should('be.visible')
        })

        it('con la contraseña vigente, entra directo al dashboard', () => {
            cy.intercept('POST', '**/api/auth/login', {
                statusCode: 200,
                body: {
                    token: 'jwt-vigente',
                    usuarioId: 22,
                    nombreCompleto: 'Persona Vigente',
                    correo: 'persona.vigente@capris.cr',
                    rol: 'Usuario de Campo',
                    debeCambiarContrasena: false,
                    contrasenaVencida: false,
                },
            }).as('login')

            iniciarSesion()
            cy.wait('@login')

            cy.url().should('include', '/dashboard')
        })
    })

    // ---- Criterio: el cambio es obligatorio, sin importar el rol ----

    describe('el cambio es obligatorio', () => {
        it('no deja entrar al dashboard ni a Ajustes mientras este vencida', () => {
            cy.visitarConSesion('/dashboard', {
                rol: 'Usuario de Campo',
                debeCambiarContrasena: false,
                contrasenaVencida: true,
            })

            cy.url().should('include', RUTA_CADUCIDAD)

            // La sesion sigue en sessionStorage: una recarga directa a otra ruta tambien rebota.
            cy.visit('/ajustes')

            cy.url().should('include', RUTA_CADUCIDAD)
        })

        it('aplica tambien a un Administrador, aunque la ruta sea de su rol', () => {
            cy.visitarConSesion(
                '/admin/usuarios',
                {
                    rol: 'Administrador',
                    debeCambiarContrasena: false,
                    contrasenaVencida: true,
                },
            )

            cy.url().should('include', RUTA_CADUCIDAD)
            cy.contains('Panel de usuarios').should('not.exist')
            cy.get('@listarUsuarios.all').should('have.length', 0)
        })

        it('no muestra el menu de la aplicacion en la pantalla de cambio', () => {
            cy.visitarConSesion(RUTA_CADUCIDAD, {
                rol: 'Usuario de Campo',
                debeCambiarContrasena: false,
                contrasenaVencida: true,
            })

            cy.contains('h1', 'Contraseña vencida').should('be.visible')
            cy.get('nav').should('not.exist')
        })

        it('prioriza el cambio obligatorio de primer ingreso si tambien aplica', () => {
            cy.visitarConSesion('/dashboard', {
                rol: 'Usuario de Campo',
                debeCambiarContrasena: true,
                contrasenaVencida: true,
            })

            cy.url().should('include', '/primer-ingreso/cambiar-password')
            cy.contains('h1', 'Contraseña vencida').should('not.exist')
        })

        it('quien ya no tiene la contraseña vencida no puede quedarse en esa pantalla', () => {
            cy.visitarConSesion(RUTA_CADUCIDAD, {
                debeCambiarContrasena: false,
                contrasenaVencida: false,
            })

            cy.url().should('include', '/dashboard')
        })

        it('permite cerrar sesion sin cambiar la contraseña', () => {
            cy.visitarConSesion(RUTA_CADUCIDAD, {
                rol: 'Usuario de Campo',
                debeCambiarContrasena: false,
                contrasenaVencida: true,
            })

            cy.contains('button', 'Cerrar sesión').click()

            cy.wait('@logout')
            cy.url().should('include', '/login')
            cy.window().then((win) => {
                expect(win.sessionStorage.getItem('capris_token')).to.equal(null)
            })
        })
    })

    // ---- Criterio: valida la contraseña actual antes del cambio, y reinicia la vigencia ----

    describe('cambiar la contraseña vencida', () => {
        beforeEach(() => {
            cy.visitarConSesion(RUTA_CADUCIDAD, {
                nombreCompleto: 'Persona Vencida',
                rol: 'Usuario de Campo',
                debeCambiarContrasena: false,
                contrasenaVencida: true,
            })
        })

        it('pide la contraseña actual, a diferencia del cambio de primer ingreso', () => {
            cy.contains('label', 'Contraseña actual').should('be.visible')
            cy.contains('label', /^Contraseña nueva$/).should('be.visible')
            cy.contains('label', /^Confirmar contraseña nueva$/).should('be.visible')
        })

        it('muestra el nombre del usuario en el mensaje', () => {
            cy.contains('Persona Vencida').should('be.visible')
        })

        it('con exito, guarda, baja la bandera y entra al dashboard', () => {
            completarFormulario({
                actual: 'Actual123!',
                nueva: 'NuevaClave2026!',
                confirmacion: 'NuevaClave2026!',
            })

            cy.wait('@cambiarPassword').then(({ request }) => {
                expect(request.headers.authorization).to.equal('Bearer jwt-prueba')
                expect(request.body).to.deep.equal({
                    contrasenaActual: 'Actual123!',
                    contrasenaNueva: 'NuevaClave2026!',
                })
            })

            cy.url().should('include', '/dashboard')

            cy.window().then((win) => {
                const usuario = JSON.parse(win.sessionStorage.getItem('capris_usuario'))
                expect(usuario.contrasenaVencida).to.equal(false)
            })
        })

        it('tras cambiarla ya puede navegar y no vuelve a la pantalla de caducidad', () => {
            completarFormulario({
                actual: 'Actual123!',
                nueva: 'NuevaClave2026!',
                confirmacion: 'NuevaClave2026!',
            })
            cy.wait('@cambiarPassword')
            cy.url().should('include', '/dashboard')

            // Recarga completa: solo pasa si la bandera se persistio en sessionStorage.
            cy.visit('/ajustes')

            cy.url().should('include', '/ajustes')
            cy.contains('h1', 'Ajustes').should('be.visible')
        })

        it('rechaza si la confirmacion no coincide, sin llamar al backend', () => {
            completarFormulario({
                actual: 'Actual123!',
                nueva: 'NuevaClave2026!',
                confirmacion: 'OtraClave2026!',
            })

            cy.get('[role="alert"]').should('contain', 'no coincide')
            cy.url().should('include', RUTA_CADUCIDAD)
            cy.get('@cambiarPassword.all').should('have.length', 0)
        })

        it('muestra el error del backend cuando la contraseña actual no es correcta', () => {
            cy.intercept('POST', '**/api/auth/cambiar-password', {
                statusCode: 401,
                body: {
                    codigo: 'CREDENCIALES_INVALIDAS',
                    mensaje: 'La contraseña actual no es correcta',
                },
            }).as('cambiarPasswordRechazado')

            completarFormulario({
                actual: 'incorrecta',
                nueva: 'NuevaClave2026!',
                confirmacion: 'NuevaClave2026!',
            })

            cy.wait('@cambiarPasswordRechazado')
            cy.get('[role="alert"]').should('contain', 'La contraseña actual no es correcta')
            cy.url().should('include', RUTA_CADUCIDAD)
        })

        it('muestra las violaciones de la politica que devuelve el backend y permanece en la pantalla', () => {
            cy.intercept('POST', '**/api/auth/cambiar-password', {
                statusCode: 400,
                body: {
                    codigo: 'CONTRASENA_NO_VALIDA',
                    mensaje: 'La contraseña no cumple la política de seguridad',
                    detalles: ['La contraseña debe contener al menos un número'],
                },
            }).as('cambiarPasswordRechazado')

            completarFormulario({
                actual: 'Actual123!',
                nueva: 'SinNumero!',
                confirmacion: 'SinNumero!',
            })

            cy.wait('@cambiarPasswordRechazado')

            cy.get('[role="alert"]')
                .should('contain', 'no cumple la política de seguridad')
                .and('contain', 'al menos un número')

            cy.url().should('include', RUTA_CADUCIDAD)
        })
    })
})
