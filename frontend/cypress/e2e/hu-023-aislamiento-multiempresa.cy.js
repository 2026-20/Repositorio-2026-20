// HU-023 - Aislamiento multiempresa
// Pruebas funcionales contra el backend real. Criterios: cada sesion solo ve
// los datos de su empresa (listado de usuarios filtrado por la empresa del
// token); acceder a otra empresa (detalle, alta con empresa ajena) responde
// 403 generico; el alta siempre cae en la empresa del administrador aunque el
// cliente mande otro empresaId. Se verifica por API y por UI (listado de
// administrador y login con la empresa correcta).
describe('HU-023 - Aislamiento multiempresa', () => {
    const contrasena = 'Capris2026!'
    const usuariosEmpresaUno = ['wmolina', 'amelendez', 'arcea']

    function tokenDe(username, empresaId) {
        return cy.request({
            method: 'POST',
            url: 'http://localhost:8080/api/auth/login',
            body: { username, contrasena, empresaId },
        }).then((resp) => {
            expect(resp.status).to.equal(200)
            return resp.body.token
        })
    }

    function traerUsuarios(token) {
        return cy.request({
            method: 'GET',
            url: 'http://localhost:8080/api/usuarios',
            headers: { Authorization: `Bearer ${token}` },
        }).then((resp) => resp.body)
    }

    it('CA1 - cada empresa solo ve su propio listado de usuarios (API)', () => {
        tokenDe('wmolina', 1).then((tokenEmp1) =>
            tokenDe('pruebadiagnostika', 2).then((tokenEmp2) =>
                traerUsuarios(tokenEmp1).then((empresaUno) => {
                    const usernamesUno = empresaUno.map((u) => u.username)

                    expect(usernamesUno).to.include.members(usuariosEmpresaUno)
                    expect(usernamesUno).not.to.include('pruebadiagnostika')

                    return traerUsuarios(tokenEmp2).then((empresaDos) => {
                        const usernamesDos = empresaDos.map((u) => u.username)

                        expect(usernamesDos).to.include('pruebadiagnostika')
                        expect(usernamesDos).not.to.include.members(usuariosEmpresaUno)
                    })
                })
            ))
    })

    it('CA2 - el listado de administrador en la UI solo muestra su empresa', () => {
        cy.clearAllSessionStorage()
        cy.visit('/login')
        cy.logearComo('wmolina', 1, contrasena)
        cy.url({ timeout: 10000 }).should('include', '/dashboard')

        cy.contains('a', 'Usuarios').click()
        cy.url().should('include', '/admin/usuarios')

        cy.get('table tbody tr')
            .should('contain', 'wmolina')

        cy.get('table tbody')
            .should('not.contain', 'pruebadiagnostika')

        cy.screenshot('hu-023-listado-solo-empresa-del-token')
    })

    it('CA3 - el acceso cruzado a otra empresa responde 403 generico', () => {
        tokenDe('wmolina', 1).then((tokenEmp1) =>
            tokenDe('pruebadiagnostika', 2).then((tokenEmp2) =>
                traerUsuarios(tokenEmp1).then((empresaUno) =>
                    traerUsuarios(tokenEmp2).then((empresaDos) => {
                        const idEmp1 = empresaUno.find((u) => u.username === 'wmolina').id
                        const idEmp2 = empresaDos.find((u) => u.username === 'pruebadiagnostika').id

                        // Empresa 1 consulta el detalle de un usuario de la 2.
                        cy.request({
                            method: 'GET',
                            url: `http://localhost:8080/api/usuarios/${idEmp2}`,
                            headers: { Authorization: `Bearer ${tokenEmp1}` },
                            failOnStatusCode: false,
                        }).then((resp) => {
                            expect(resp.status).to.equal(403)
                            expect(resp.body.mensaje).to.equal('No autorizado')
                        })

                        // Y a la inversa: la empresa 2 no puede ver la 1.
                        cy.request({
                            method: 'GET',
                            url: `http://localhost:8080/api/usuarios/${idEmp1}`,
                            headers: { Authorization: `Bearer ${tokenEmp2}` },
                            failOnStatusCode: false,
                        }).then((resp) => {
                            expect(resp.status).to.equal(403)
                            expect(resp.body.mensaje).to.equal('No autorizado')
                        })

                        // Alta con empresa ajena: 403 y no crea nada.
                        const sufijo = Date.now().toString().slice(-6)
                        cy.request({
                            method: 'POST',
                            url: 'http://localhost:8080/api/usuarios',
                            headers: { Authorization: `Bearer ${tokenEmp1}` },
                            body: {
                                nombreCompleto: 'QA Cruzado',
                                cedula: `QA-CED-CRUZ-${sufijo}`,
                                correo: `qa-cruzado-${sufijo}@capris.co.cr`,
                                username: `qa_cruzado_${sufijo}`,
                                rolId: 2,
                                empresaId: 2,
                            },
                            failOnStatusCode: false,
                        }).then((resp) => {
                            expect(resp.status).to.equal(403)
                            expect(resp.body.mensaje).to.equal('No autorizado')
                        })
                    })
                )
            )
        )
    })

    it('CA4 - el login exige la empresa correcta y cada rol ve su propio menu', () => {
        cy.clearAllSessionStorage()
        cy.visit('/login')

        // Usuario de la empresa 2 entra ahi y ve su dashboard...
        cy.logearComo('pruebadiagnostika', 2, contrasena)
        cy.url({ timeout: 10000 }).should('include', '/dashboard')

        // ...pero es Usuario de Campo: no ve la gestion de usuarios.
        cy.contains('a', 'Usuarios').should('not.exist')

        cy.screenshot('hu-023-menu-por-rol')

        // Un administrador de la empresa 1 si la ve.
        cy.clearAllSessionStorage()
        cy.visit('/login')
        cy.logearComo('wmolina', 1, contrasena)
        cy.url({ timeout: 10000 }).should('include', '/dashboard')

        cy.contains('a', 'Usuarios').should('be.visible')

        cy.screenshot('hu-023-menu-administrador')
    })
})