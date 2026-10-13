
describe('HU-036 - Invalidacion de sesion', () => {
    it('cierra la sesion cuando el backend invalida el JWT', () => {
        let solicitudes = 0

        cy.intercept('GET', '**/api/usuarios/1', (req) => {
            solicitudes++

            if (solicitudes === 1) {
                req.reply({
                    statusCode: 200,
                    body: {
                        id: 1,
                        nombreCompleto: 'Andrey Melendez',
                        estado: 'Activo',
                    },
                })
            } else {
                req.reply({
                    statusCode: 401,
                    body: {
                        codigo: 'SESION_NO_VALIDA',
                        mensaje: 'No hay sesion activa',
                    },
                })
            }
        }).as('validarSesion')

        cy.visitarConSesion('/dashboard', {
            id: 1,
            nombreCompleto: 'Andrey Melendez',
            rol: 'Usuario de Campo',
        })

        // La primera validacion permite continuar.
        cy.wait('@validarSesion')
            .its('response.statusCode')
            .should('eq', 200)

        cy.url().should('include', '/dashboard')

        // Simular recuperacion de conexion.
        cy.window().then((win) => {
            win.dispatchEvent(new Event('online'))
        })

        // El backend rechaza ahora el JWT.
        cy.wait('@validarSesion')
            .its('response.statusCode')
            .should('eq', 401)

        // Debe regresar al login sin recargar.
        cy.url().should('include', '/login')

        // Las credenciales deben desaparecer.
        cy.window().then((win) => {
            expect(
                win.sessionStorage.getItem('capris_token'),
            ).to.equal(null)

            expect(
                win.sessionStorage.getItem('capris_usuario'),
            ).to.equal(null)
        })
    })

    it('mantiene la sesión cuando falla la conexión con el backend', () => {
        let solicitudes = 0

        cy.intercept('GET', '**/api/usuarios/1', (req) => {
            solicitudes++

            if (solicitudes === 1) {
                req.reply({
                    statusCode: 200,
                    body: {
                        id: 1,
                        nombreCompleto: 'Andrey Melendez',
                        estado: 'Activo',
                    },
                })
            } else {
                req.destroy()
            }
        }).as('validarSesion')

        cy.visitarConSesion('/dashboard', {
            id: 1,
            nombreCompleto: 'Andrey Melendez',
            rol: 'Usuario de Campo',
        })

        // Primera validación exitosa.
        cy.wait('@validarSesion')
            .its('response.statusCode')
            .should('eq', 200)

        cy.url().should('include', '/dashboard')

        // Simular una reconexión cuyo servidor no responde.
        cy.window().then((win) => {
            win.dispatchEvent(new Event('online'))
        })

        cy.wait('@validarSesion')
            .its('error')
            .should('exist')

        // La sesión no debe cerrarse por un error de red.
        cy.url().should('include', '/dashboard')

        cy.window().then((win) => {
            expect(
                win.sessionStorage.getItem('capris_token'),
            ).not.to.equal(null)

            expect(
                win.sessionStorage.getItem('capris_usuario'),
            ).not.to.equal(null)
        })
    })

})
