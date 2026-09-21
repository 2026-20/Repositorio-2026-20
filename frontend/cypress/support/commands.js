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
