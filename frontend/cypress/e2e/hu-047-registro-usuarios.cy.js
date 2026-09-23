// HU-047 - Registro de usuarios nuevos (#64)
// Pruebas funcionales contra el backend real (localhost:8080) y SMTP local
// (MailHog en localhost:8025) para la entrega de credenciales iniciales.
//
// Criterios: CA1 (campos obligatorios y validacion de duplicados), CA2 (rol y
// empresa desde listas del sistema; empresa = la del administrador, HU-023),
// CA3 (generacion automatica de contrasena temporal por correo, sin mostrarse
// al administrador, y primer ingreso forzado). CA4 (cola de sincronizacion
// offline) no existe todavia en la aplicacion y se documenta en el task.
describe('HU-047 - Registro de usuarios nuevos', () => {
    const sufijo = Date.now().toString().slice(-6)
    const datosNuevo = {
        nombreCompleto: `QA Registro ${sufijo}`,
        cedula: `QA-CED-${sufijo}`,
        correo: `qa-registro-${sufijo}@capris.co.cr`,
        username: `qa_registro_${sufijo}`,
    }
    const contrasenaAdmin = 'Capris2026!'

    beforeEach(() => {
        cy.vaciarCorreos()
        cy.logearComo('wmolina', 1, contrasenaAdmin)
        cy.url().should('include', '/dashboard')
        cy.visit('/admin/usuarios')
        cy.contains('h1', 'Usuarios').should('be.visible')
    })

    function abrirCrearUsuario() {
        cy.get('button')
            .contains('Crear usuario')
            .click()
    }

    function llenarFormulario(
        { nombre, cedula, correo, username, rol },
        { incluirRol = true } = {},
    ) {
        cy.get('#crear-nombre-completo').clear().type(nombre)
        cy.get('#crear-cedula').clear().type(cedula)
        cy.get('#crear-correo').clear().type(correo)
        cy.get('#crear-username').clear().type(username)
        if (incluirRol) {
            cy.get('#crear-rol').select(rol)
        }
    }

    function confirmarCreacion() {
        cy.get('[role="alertdialog"]')
            .contains('button', 'Crear usuario')
            .click()
    }

    it('CA1 - no permite guardar si falta algun campo obligatorio', () => {
        abrirCrearUsuario()

        confirmarCreacion()

        cy.get('[role="alertdialog"]')
            .contains('Debe completar todos los campos.')
            .should('be.visible')
    })

    it('CA1 - rechaza username y cedula ya registrados', () => {
        abrirCrearUsuario()

        // Username que ya existe (cedula y correo unicos, para forzar el fallo
        // a nivel de username).
        llenarFormulario({
            nombre: 'Duplicado Username',
            cedula: `QA-DUP-USR-${sufijo}`,
            correo: `qa-dup-usr-${sufijo}@capris.co.cr`,
            username: 'wmolina',
            rol: 'Usuario de Campo',
        })
        confirmarCreacion()

        cy.get('[role="alertdialog"]')
            .should('contain', 'Ya existe un usuario')

        // Cedula que ya existe (los demas campos unicos).
        llenarFormulario({
            nombre: 'Duplicado Cedula',
            cedula: 'PENDIENTE-003',
            correo: `qa-dup-ced-${sufijo}@capris.co.cr`,
            username: `qa_dup_ced_${sufijo}`,
            rol: 'Usuario de Campo',
        })
        confirmarCreacion()

        cy.get('[role="alertdialog"]')
            .should('contain', 'Ya existe un usuario')

        cy.screenshot('hu-047-rechazo-duplicados')
    })

    it('CA2/CA3 - crea un usuario Usuario de Campo, envia credenciales por correo y fuerza su primer ingreso', () => {
        abrirCrearUsuario()

        // El formulario carga los roles disponibles desde el sistema (CA2).
        cy.get('#crear-rol option[value="2"]')
            .should('exist')

        // La empresa NO se pide en el formulario: queda asociada a la empresa
        // del administrador autenticado (CA2 + aislamiento multiempresa HU-023).
        llenarFormulario({
            nombre: datosNuevo.nombreCompleto,
            cedula: datosNuevo.cedula,
            correo: datosNuevo.correo,
            username: datosNuevo.username,
            rol: 'Usuario de Campo',
        })
        confirmarCreacion()

        cy.screenshot('hu-047-modal-crear-usuario-lleno')

        // Confirmacion visual y aparicion en el listado con estado pendiente de
        // primer ingreso (CA3).
        cy.contains(
            `Se creó la cuenta de ${datosNuevo.nombreCompleto} y se envió un correo con las credenciales de acceso.`,
        ).should('be.visible')

        cy.contains('td', datosNuevo.username)
            .closest('tr')
            .should('contain', 'PENDIENTE_PRIMER_INGRESO')

        cy.screenshot('hu-047-usuario-creado-en-listado')

        // El correo llega via SMTP/MailHog con username y contrasena temporal
        // (la contrasena jamas se muestra al administrador: no aparece en la
        // pantalla en ningun momento -- solo el correo la lleva).
        cy.obtenerUltimoCorreo(datosNuevo.correo).should((correo) => {
            expect(correo.asunto).to.equal('Tus credenciales de acceso - CAPRIS Reactivos')
            expect(correo.cuerpo).to.contain(`Usuario: ${datosNuevo.username}`)
            expect(correo.cuerpo).to.match(/Contraseña temporal: \S+/)
        })

        // Con las credenciales iniciales el usuario entra y el sistema lo obliga
        // a definir su propia contraseña antes de continuar (HU-044).
        cy.obtenerUltimoCorreo(datosNuevo.correo).then((correo) => {
            const temporal = correo.cuerpo.match(/Contraseña temporal: (\S+)/)[1]

            cy.get('button[aria-label^="Menú de"]').click()
            cy.contains('[role="menuitem"]', 'Cerrar sesión').click()
            cy.url().should('include', '/login')

            cy.logearComo(datosNuevo.username, 1, temporal)

            cy.url({ timeout: 10000 })
                .should('include', '/primer-ingreso/cambiar-password')

            cy.screenshot('hu-047-primer-ingreso-forzado')
        })
    })
})