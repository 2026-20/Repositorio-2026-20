// HU-042 - Política de contraseñas robustas (caracter especial, mayuscula,
// miniscula, numero y minimo 8 caracteres)
// Pruebas funcionales contra el backend real: la politica se valida tanto en el
// cambio obligatorio de primer ingreso como en el cambio voluntario de Ajustes
// (mismo ValidadorPoliticaContrasenaImpl). La UI describe la politica antes de
// enviar (CA2) y el backend devuelve el detalle de CADA requisito incumplido
// (CA1). El cambio voluntario se cubre en HU-043 con una cuenta ACTIVA.
describe('HU-042 - Política de contraseñas robusta', () => {
    const claveValida = 'ContraFuerte9!'
    const claveInvalida = 'abc'
    const claveSinNumero = 'Abcdefghi!'

    after(() => {
        cy.inactivarUsuariosCreadosQA()
    })

    function validarPrimerIngreso(cuenta, contrasenaNueva) {
        return cy.request({
            method: 'POST',
            url: 'http://localhost:8080/api/auth/login',
            body: {
                username: cuenta.username,
                contrasena: cuenta.temporal,
                empresaId: 1,
            },
        }).then((login) => cy.request({
            method: 'POST',
            url: 'http://localhost:8080/api/auth/primer-ingreso/cambiar-password',
            headers: { Authorization: `Bearer ${login.body.token}` },
            body: { contrasenaNueva },
            failOnStatusCode: false,
        }))
    }

    it('CA1 - rebaja cada requisito incumplido con su detalle (clave que falla todo)', () => {
        cy.crearUsuarioPendienteQA('HUL42').then((cuenta) =>
            validarPrimerIngreso(cuenta, claveInvalida)
                .then((resp) => {
                    expect(resp.status).to.equal(400)

                    const detalles = resp.body.detalles ?? []

                    expect(detalles).to.include(
                        'La contraseña debe tener al menos 8 caracteres')
                    expect(detalles).to.include(
                        'La contraseña debe contener al menos una letra mayúscula')
                    expect(detalles).to.include(
                        'La contraseña debe contener al menos un número')
                    expect(detalles).to.include(
                        'La contraseña debe contener al menos un carácter especial')

                    cy.screenshot('hu-042-rechazo-todos-los-requisitos')
                }))
    })

    it('CA1 - una clave sin digitos rebaja solo el requisito de numero', () => {
        cy.crearUsuarioPendienteQA('HUL42N').then((cuenta) =>
            validarPrimerIngreso(cuenta, claveSinNumero)
                .then((resp) => {
                    expect(resp.status).to.equal(400)
                    expect(resp.body.detalles ?? [])
                        .to.include('La contraseña debe contener al menos un número')
                }))
    })

    it('CA2 + CA3 - la pantalla describe la politica y una clave valida queda aceptada', () => {
        cy.crearUsuarioPendienteQA('HUL42C').then((cuenta) => {
            cy.logearComo(cuenta.username, 1, cuenta.temporal)
            cy.url({ timeout: 10000 })
                .should('include', '/primer-ingreso/cambiar-password')

            cy.contains('p', /Mínimo 8 caracteres, con al menos una mayúscula, una minúscula, un número y un carácter especial/)
                .should('be.visible')

            cy.screenshot('hu-042-ayuda-politica-en-pantalla')

            cy.campoContrasena('Contraseña nueva').type(claveValida)
            cy.campoContrasena('Confirmar contraseña nueva').type(claveValida)
            cy.contains('button', 'Guardar y continuar').click()

            cy.url({ timeout: 10000 })
                .should('include', '/dashboard')
        })
    })
})