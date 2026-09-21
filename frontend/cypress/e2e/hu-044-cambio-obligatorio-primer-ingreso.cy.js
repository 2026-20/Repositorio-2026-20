const RUTA_CAMBIO = '/primer-ingreso/cambiar-password'

describe('HU-044 - Cambio obligatorio de contraseña en el primer ingreso', () => {
    beforeEach(() => {
        cy.intercept('GET', '**/api/empresas', {
            statusCode: 200,
            body: [{ id: 1, nombre: 'CAPRIS Médica' }],
        }).as('obtenerEmpresas')

        cy.intercept('POST', '**/api/auth/primer-ingreso/cambiar-password', {
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

    function completarFormulario({ nueva, confirmacion }) {
        if (nueva) {
            cy.campoContrasena('Contraseña nueva').type(nueva)
        }

        if (confirmacion) {
            cy.campoContrasena('Confirmar contraseña nueva').type(confirmacion)
        }

        cy.contains('button', 'Guardar y continuar').click()
    }

    // ---- Criterio 1: la contraseña temporal solo vale mientras esté vigente ----

    describe('login con contraseña temporal', () => {
        function iniciarSesionConTemporal() {
            cy.visit('/login')
            cy.wait('@obtenerEmpresas')

            cy.get('#username').type('nuevo.usuario')
            cy.get('#contrasena').type('Temporal123!')
            cy.contains('button', 'Iniciar sesión').click()
        }

        it('lleva al cambio obligatorio en vez del dashboard', () => {
            cy.intercept('POST', '**/api/auth/login', {
                statusCode: 200,
                body: {
                    token: 'jwt-temporal',
                    usuarioId: 20,
                    nombreCompleto: 'Usuario Nuevo',
                    rol: 'Usuario de Campo',
                    debeCambiarContrasena: true,
                },
            }).as('login')

            iniciarSesionConTemporal()

            cy.wait('@login')

            cy.url().should('include', RUTA_CAMBIO)
            cy.contains('h1', 'Cambie su contraseña').should('be.visible')
        })

        it('con la temporal vencida, muestra que debe contactar al administrador y no entra', () => {
            cy.intercept('POST', '**/api/auth/login', {
                statusCode: 401,
                body: {
                    codigo: 'PASSWORD_TEMPORAL_VENCIDA',
                    mensaje:
                        'La contraseña temporal ha vencido. Debe contactar al administrador para que le genere una nueva',
                },
            }).as('login')

            iniciarSesionConTemporal()

            cy.wait('@login')

            cy.get('[role="alert"]')
                .should('contain', 'contactar al administrador')

            cy.url().should('include', '/login')
            cy.window().then((win) => {
                expect(win.sessionStorage.getItem('capris_token')).to.equal(null)
            })
        })
    })

    // ---- Criterio 2: el cambio es obligatorio, sin importar el rol ----

    describe('el cambio es obligatorio', () => {
        it('no deja entrar al dashboard ni a Ajustes mientras la contraseña sea temporal', () => {
            cy.visitarConSesion('/dashboard', {
                rol: 'Usuario de Campo',
                debeCambiarContrasena: true,
            })

            cy.url().should('include', RUTA_CAMBIO)

            // La sesion sigue en sessionStorage: una recarga directa a otra ruta tambien rebota.
            cy.visit('/ajustes')

            cy.url().should('include', RUTA_CAMBIO)
        })

        it('aplica tambien a un Administrador, aunque la ruta sea de su rol', () => {
            cy.visitarConSesion('/admin/usuarios', {
                rol: 'Administrador',
                debeCambiarContrasena: true,
            })

            cy.url().should('include', RUTA_CAMBIO)
            cy.contains('Panel de usuarios').should('not.exist')
            cy.get('@listarUsuarios.all').should('have.length', 0)
        })

        it('no muestra el menu de la aplicacion en la pantalla de cambio', () => {
            cy.visitarConSesion(RUTA_CAMBIO, {
                rol: 'Usuario de Campo',
                debeCambiarContrasena: true,
            })

            cy.contains('h1', 'Cambie su contraseña').should('be.visible')
            cy.get('nav').should('not.exist')
        })

        it('quien ya no tiene contraseña temporal no puede quedarse en esa pantalla', () => {
            cy.visitarConSesion(RUTA_CAMBIO, { debeCambiarContrasena: false })

            cy.url().should('include', '/dashboard')
        })

        it('permite cerrar sesion sin cambiar la contraseña', () => {
            cy.visitarConSesion(RUTA_CAMBIO, {
                rol: 'Usuario de Campo',
                debeCambiarContrasena: true,
            })

            cy.contains('button', 'Cerrar sesión').click()

            cy.wait('@logout')
            cy.url().should('include', '/login')
            cy.window().then((win) => {
                expect(win.sessionStorage.getItem('capris_token')).to.equal(null)
            })
        })
    })

    // ---- Criterio 3: la nueva contraseña se confirma y se valida ----

    describe('definir la contraseña nueva', () => {
        beforeEach(() => {
            cy.visitarConSesion(RUTA_CAMBIO, {
                nombreCompleto: 'Usuario Nuevo',
                rol: 'Usuario de Campo',
                debeCambiarContrasena: true,
            })
        })

        it('no pide la contraseña actual (ya la dio en el login)', () => {
            cy.contains('label', 'Contraseña actual').should('not.exist')
            cy.contains('label', /^Contraseña nueva$/).should('be.visible')
            cy.contains('label', /^Confirmar contraseña nueva$/).should('be.visible')
        })

        it('con exito, guarda, baja la bandera y entra a la aplicacion', () => {
            completarFormulario({ nueva: 'NuevaClave2026!', confirmacion: 'NuevaClave2026!' })

            cy.wait('@cambiarPassword').then(({ request }) => {
                expect(request.headers.authorization).to.equal('Bearer jwt-prueba')
                expect(request.body).to.deep.equal({ contrasenaNueva: 'NuevaClave2026!' })
            })

            cy.url().should('include', '/dashboard')
            cy.contains('Hola, Usuario').should('be.visible')

            cy.window().then((win) => {
                const usuario = JSON.parse(win.sessionStorage.getItem('capris_usuario'))
                expect(usuario.debeCambiarContrasena).to.equal(false)
                expect(win.sessionStorage.getItem('capris_token')).to.equal('jwt-prueba')
            })
        })

        it('tras cambiarla ya puede navegar y no vuelve a la pantalla de cambio', () => {
            completarFormulario({ nueva: 'NuevaClave2026!', confirmacion: 'NuevaClave2026!' })
            cy.wait('@cambiarPassword')
            cy.url().should('include', '/dashboard')

            // Recarga completa: solo pasa si la bandera se persistio en sessionStorage.
            cy.visit('/ajustes')

            cy.url().should('include', '/ajustes')
            cy.contains('h1', 'Ajustes').should('be.visible')
        })

        it('rechaza si la confirmacion no coincide, sin llamar al backend', () => {
            completarFormulario({ nueva: 'NuevaClave2026!', confirmacion: 'OtraClave2026!' })

            cy.get('[role="alert"]').should('contain', 'no coincide')
            cy.url().should('include', RUTA_CAMBIO)
            cy.get('@cambiarPassword.all').should('have.length', 0)
        })

        it('rechaza una contraseña nueva vacia, sin llamar al backend', () => {
            cy.contains('button', 'Guardar y continuar').click()

            cy.get('[role="alert"]').should('contain', 'contraseña nueva')
            cy.get('@cambiarPassword.all').should('have.length', 0)
        })

        it('muestra las violaciones de la politica que devuelve el backend y permanece en la pantalla', () => {
            cy.intercept('POST', '**/api/auth/primer-ingreso/cambiar-password', {
                statusCode: 400,
                body: {
                    codigo: 'CONTRASENA_NO_VALIDA',
                    mensaje: 'La contraseña no cumple la política de seguridad',
                    detalles: [
                        'La contraseña debe contener al menos un número',
                        'La contraseña debe contener al menos un carácter especial',
                    ],
                },
            }).as('cambiarPasswordRechazado')

            completarFormulario({ nueva: 'SinNumeroNiEspecial', confirmacion: 'SinNumeroNiEspecial' })

            cy.wait('@cambiarPasswordRechazado')

            cy.get('[role="alert"]')
                .should('contain', 'no cumple la política de seguridad')
                .and('contain', 'al menos un número')
                .and('contain', 'al menos un carácter especial')

            cy.url().should('include', RUTA_CAMBIO)
            cy.window().then((win) => {
                const usuario = JSON.parse(win.sessionStorage.getItem('capris_usuario'))
                expect(usuario.debeCambiarContrasena).to.equal(true)
            })
        })

        it('muestra el error del backend cuando el servidor rechaza la solicitud', () => {
            cy.intercept('POST', '**/api/auth/primer-ingreso/cambiar-password', {
                statusCode: 400,
                body: {
                    codigo: 'SOLICITUD_INVALIDA',
                    mensaje: 'La solicitud contiene datos no válidos',
                    detalles: ['La contraseña nueva es obligatoria'],
                },
            }).as('cambiarPasswordInvalido')

            completarFormulario({ nueva: 'NuevaClave2026!', confirmacion: 'NuevaClave2026!' })

            cy.wait('@cambiarPasswordInvalido')
            cy.get('[role="alert"]').should('contain', 'La contraseña nueva es obligatoria')
            cy.url().should('include', RUTA_CAMBIO)
        })
    })
})
