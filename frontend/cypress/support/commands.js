// Comandos personalizados de Cypress compartidos entre specs.

// Abre `ruta` con una sesion ya iniciada, sin pasar por el formulario de login
// ni depender de la bienvenida animada. Sirve para probar pantallas que solo
// existen con sesion (HU-044, HU-045). Las claves de sessionStorage son las
// mismas que usa AuthProvider.
Cypress.Commands.add('visitarConSesion', (ruta, sesion = {}) => {
    const usuario = {
        id: 3,
        nombreCompleto: 'William A. Molina Quirós',
        rol: 'Administrador',
        debeCambiarContrasena: false,
        ...sesion,
    }

    cy.visit(ruta, {
        onBeforeLoad(win) {
            win.sessionStorage.setItem('capris_token', 'jwt-prueba')
            win.sessionStorage.setItem('capris_usuario', JSON.stringify(usuario))
        },
    })
})

// Los ids de los campos de contraseña los genera React (useId), asi que se
// localizan por el texto exacto de su etiqueta.
Cypress.Commands.add('campoContrasena', (etiqueta) => {
    cy.contains('label', new RegExp(`^${etiqueta}$`))
        .invoke('attr', 'for')
        .then((id) => cy.get(`[id="${id}"]`))
})

// Login real contra el backend (backend up: http://localhost:8080, frontend
// dev server en la baseUrl de Cypress). El select de empresa carga de forma
// asincrona desde GET /api/empresas, asi que se espera la opcion antes.
Cypress.Commands.add('logearComo', (username, empresaId, contrasena) => {
    cy.visit('/login')

    // Las empresas se cargan de forma asincrona desde GET /api/empresas.
    cy.get(`#empresa option[value="${empresaId}"]`)
        .should('exist')

    cy.get('#empresa')
        .select(String(empresaId))

    cy.get('#username')
        .type(username)

    cy.get('#contrasena')
        .type(contrasena, { log: false })

    cy.contains('button', 'Iniciar sesión')
        .click()
})

// Lee el ultimo correo recibido en MailHog (http://localhost:8025) para un
// destinatario. Devuelve { asunto, cuerpo }. Los correos de credenciales
// (HU-047/044) y los OTP de recuperacion (HU-046) viajan por el SMTP real
// (app.email.proveedor=smtp) apuntando a MailHog.
Cypress.Commands.add('obtenerUltimoCorreo', (destinatario, opciones = {}) => {
    const timeout = opciones.timeout ?? 15000
    const inicio = Date.now()

    const llegaA = (mensaje) => {
        const destinatarios = [
            ...(mensaje.Raw?.To ?? []),
            ...(mensaje.Content?.Headers?.To ?? []),
        ]

        return destinatarios.some((dir) =>
            String(dir).toLowerCase().includes(destinatario.toLowerCase()))
    }

    const quitarCodificacionQP = (texto) => {
        const sinSaltos = texto.replace(/=\r?\n/g, '')
        const bytes = []

        for (let i = 0; i < sinSaltos.length; i++) {
            const restante = sinSaltos.slice(i)
            const codificado = restante.match(/^=([0-9A-Fa-f]{2})/)

            if (codificado) {
                bytes.push(parseInt(codificado[1], 16))
                i += 2
                continue
            }

            const cadena = sinSaltos[i]
            if (cadena.codePointAt(0) < 0x80) {
                bytes.push(cadena.codePointAt(0))
            } else {
                bytes.push(...new TextEncoder().encode(cadena))
            }
        }

        return new TextDecoder('utf-8').decode(Uint8Array.from(bytes))
    }

    const cuerpoDe = (mensaje) =>
        quitarCodificacionQP(mensaje.Content?.Body ?? '')

    function intentar() {
        return cy.request('GET', 'http://localhost:8025/api/v2/messages')
            .then((respuesta) => {
                const coincidentes = (respuesta.body.items ?? [])
                    .filter(llegaA)

                if (coincidentes.length > 0) {
                    const ultimo = coincidentes[coincidentes.length - 1]

                    return {
                        asunto: (ultimo.Content?.Headers?.Subject ?? [''])[0] ?? '',
                        cuerpo: cuerpoDe(ultimo),
                    }
                }

                if (Date.now() - inicio > timeout) {
                    throw new Error(`Tiempo agotado: no llego correo a ${destinatario}`)
                }

                cy.wait(600)
                return intentar()
            })
    }

    return intentar()
})

// Limpia la bandeja de MailHog entre pruebas para que cada spec arranque
// desde cero y los aserts de "correo recibido" no confundan correos viejos.
Cypress.Commands.add('vaciarCorreos', () => {
    cy.request({
        method: 'DELETE',
        url: 'http://localhost:8025/api/v1/messages',
        failOnStatusCode: false,
    })
})
