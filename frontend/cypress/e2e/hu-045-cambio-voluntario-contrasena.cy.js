describe('HU-045 - Cambio voluntario de contraseña', () => {
    beforeEach(() => {
        cy.intercept('POST', '**/api/auth/cambiar-password', {
            statusCode: 204,
        }).as('cambiarPassword')

        cy.intercept('POST', '**/api/auth/logout', {
            statusCode: 204,
        }).as('logout')

        cy.visitarConSesion('/ajustes', { debeCambiarContrasena: false })
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

        cy.contains('button', 'Cambiar contraseña').click()
    }

    function interceptarRechazo(statusCode, body) {
        cy.intercept('POST', '**/api/auth/cambiar-password', { statusCode, body })
            .as('cambiarPasswordRechazado')
    }

    // ---- Criterio 1: existe la opción en Ajustes y pide la contraseña actual ----

    describe('seccion de contraseña en Ajustes', () => {
        it('ofrece contraseña actual, nueva y confirmacion', () => {
            cy.contains('h2', 'Contraseña').should('be.visible')

            cy.campoContrasena('Contraseña actual').should('be.visible')
            cy.campoContrasena('Contraseña nueva').should('be.visible')
            cy.campoContrasena('Confirmar contraseña nueva').should('be.visible')
            cy.contains('button', 'Cambiar contraseña').should('be.visible')
        })

        it('no pisa la seccion de Apariencia', () => {
            cy.contains('h2', 'Apariencia').should('be.visible')
            cy.get('[role="radio"]').should('have.length', 2)
        })
    })

    describe('cambio exitoso', () => {
        it('envia el token, la actual y la nueva, y confirma el cambio', () => {
            completarFormulario({
                actual: 'Capris2026!',
                nueva: 'NuevaClave2026!',
                confirmacion: 'NuevaClave2026!',
            })

            cy.wait('@cambiarPassword').then(({ request }) => {
                expect(request.headers.authorization).to.equal('Bearer jwt-prueba')
                expect(request.body).to.deep.equal({
                    contrasenaActual: 'Capris2026!',
                    contrasenaNueva: 'NuevaClave2026!',
                })
            })

            cy.get('[role="status"]')
                .should('contain', 'se cambió correctamente')
        })

        it('limpia los campos y mantiene la sesion abierta', () => {
            completarFormulario({
                actual: 'Capris2026!',
                nueva: 'NuevaClave2026!',
                confirmacion: 'NuevaClave2026!',
            })

            cy.wait('@cambiarPassword')

            cy.campoContrasena('Contraseña actual').should('have.value', '')
            cy.campoContrasena('Contraseña nueva').should('have.value', '')
            cy.campoContrasena('Confirmar contraseña nueva').should('have.value', '')

            cy.url().should('include', '/ajustes')
            cy.get('@logout.all').should('have.length', 0)
            cy.window().then((win) => {
                expect(win.sessionStorage.getItem('capris_token')).to.equal('jwt-prueba')
            })
        })
    })

    // ---- Criterio 3: confirmacion y campos obligatorios, validados antes de enviar ----

    describe('validaciones del formulario', () => {
        it('rechaza si la confirmacion no coincide, sin llamar al backend', () => {
            completarFormulario({
                actual: 'Capris2026!',
                nueva: 'NuevaClave2026!',
                confirmacion: 'OtraClave2026!',
            })

            cy.get('[role="alert"]').should('contain', 'no coincide')
            cy.get('@cambiarPassword.all').should('have.length', 0)
        })

        it('exige la contraseña actual, sin llamar al backend', () => {
            completarFormulario({
                nueva: 'NuevaClave2026!',
                confirmacion: 'NuevaClave2026!',
            })

            cy.get('[role="alert"]').should('contain', 'contraseña actual')
            cy.get('@cambiarPassword.all').should('have.length', 0)
        })

        it('exige la contraseña nueva, sin llamar al backend', () => {
            completarFormulario({ actual: 'Capris2026!' })

            cy.get('[role="alert"]').should('contain', 'contraseña nueva')
            cy.get('@cambiarPassword.all').should('have.length', 0)
        })

        it('muestra las violaciones de la politica de complejidad que devuelve el backend', () => {
            interceptarRechazo(400, {
                codigo: 'CONTRASENA_NO_VALIDA',
                mensaje: 'La contraseña no cumple la política de seguridad',
                detalles: [
                    'La contraseña debe tener al menos 8 caracteres',
                    'La contraseña debe contener al menos una letra mayúscula',
                ],
            })

            completarFormulario({
                actual: 'Capris2026!',
                nueva: 'corta',
                confirmacion: 'corta',
            })

            cy.wait('@cambiarPasswordRechazado')

            cy.get('[role="alert"]')
                .should('contain', 'no cumple la política de seguridad')
                .and('contain', 'al menos 8 caracteres')
                .and('contain', 'al menos una letra mayúscula')
            cy.get('[role="status"]').should('not.exist')
        })

        it('muestra el rechazo cuando la nueva es igual a la actual', () => {
            interceptarRechazo(400, {
                codigo: 'CONTRASENA_NO_VALIDA',
                mensaje: 'La contraseña no cumple la política de seguridad',
                detalles: ['La contraseña nueva no puede ser igual a la actual'],
            })

            completarFormulario({
                actual: 'Capris2026!',
                nueva: 'Capris2026!',
                confirmacion: 'Capris2026!',
            })

            cy.wait('@cambiarPasswordRechazado')

            cy.get('[role="alert"]').should('contain', 'no puede ser igual a la actual')
        })
    })

    // ---- Criterio 2: la actual incorrecta cuenta para el bloqueo (lo aplica el backend) ----

    describe('contraseña actual incorrecta', () => {
        it('informa que la actual no es correcta y no cambia nada', () => {
            interceptarRechazo(401, {
                codigo: 'CREDENCIALES_INVALIDAS',
                mensaje: 'La contraseña actual no es correcta',
            })

            completarFormulario({
                actual: 'incorrecta',
                nueva: 'NuevaClave2026!',
                confirmacion: 'NuevaClave2026!',
            })

            cy.wait('@cambiarPasswordRechazado')

            cy.get('[role="alert"]').should('contain', 'La contraseña actual no es correcta')
            cy.get('[role="status"]').should('not.exist')
            cy.url().should('include', '/ajustes')
        })

        it('al llegar al bloqueo por intentos fallidos, muestra el mensaje de cuenta bloqueada', () => {
            interceptarRechazo(423, {
                codigo: 'CUENTA_BLOQUEADA',
                mensaje:
                    'Cuenta bloqueada temporalmente por 7 minutos tras múltiples intentos fallidos',
            })

            completarFormulario({
                actual: 'incorrecta',
                nueva: 'NuevaClave2026!',
                confirmacion: 'NuevaClave2026!',
            })

            cy.wait('@cambiarPasswordRechazado')

            cy.get('[role="alert"]').should('contain', 'Cuenta bloqueada temporalmente')
        })

        it('permite corregir y reintentar tras un rechazo', () => {
            interceptarRechazo(401, {
                codigo: 'CREDENCIALES_INVALIDAS',
                mensaje: 'La contraseña actual no es correcta',
            })

            completarFormulario({
                actual: 'incorrecta',
                nueva: 'NuevaClave2026!',
                confirmacion: 'NuevaClave2026!',
            })

            cy.wait('@cambiarPasswordRechazado')
            cy.get('[role="alert"]').should('be.visible')

            cy.intercept('POST', '**/api/auth/cambiar-password', { statusCode: 204 })
                .as('cambiarPasswordCorregido')

            cy.campoContrasena('Contraseña actual').clear().type('Capris2026!')
            cy.contains('button', 'Cambiar contraseña').click()

            cy.wait('@cambiarPasswordCorregido')

            cy.get('[role="status"]').should('contain', 'se cambió correctamente')
            cy.get('[role="alert"]').should('not.exist')
        })
    })
})
