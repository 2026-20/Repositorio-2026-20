// HU-029 - Configurar modo de visualizacion claro u oscuro (#67)
// Pruebas funcionales del selector de apariencia (Ajustes) y del alternador de
// la barra superior, contra la aplicacion real (frontend localhost:5173).
// Preferencia de interfaz local: se testea en localStorage 'capris_tema' y en
// el atributo data-theme de <html>.
describe('HU-029 - Configurar modo de visualizacion claro u oscuro', () => {
    beforeEach(() => {
        cy.clearLocalStorage()
        cy.clearAllSessionStorage()
    })

    function visitarAjustes() {
        cy.visitarConSesion('/ajustes')
        cy.contains('h1', 'Ajustes').should('be.visible')
    }

    function elegirModo(nombre) {
        cy.get('[role="radiogroup"][aria-label="Modo de visualización"]')
            .contains('button', nombre)
            .click()
    }

    it('AC3 - sin preferencia guardada, la aplicacion sigue el modo del sistema', () => {
        cy.visitarConSesion('/ajustes')

        // Espera a que el arbol este montado (el hook aplica data-theme en un
        // effect) antes de inspeccionar el atributo.
        cy.contains('h1', 'Ajustes').should('be.visible')

        // El criterio exige que el default sea el del SO; se verifica que el
        // atributo refleje el valor de prefers-color-scheme y que NO exista
        // eleccion previa guardada.
        cy.window().then((win) => {
            const esperado = win.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light'

            expect(win.localStorage.getItem('capris_tema')).to.equal(null)

            cy.document().then((doc) => {
                expect(doc.documentElement.getAttribute('data-theme')).to.equal(esperado)
            })
        })
    })

    it('AC1 - seleccionar modo oscuro aplica la paleta oscura de inmediato y la guarda', () => {
        visitarAjustes()

        elegirModo('Oscuro')

        cy.document().then((doc) => {
            expect(doc.documentElement.getAttribute('data-theme')).to.equal('dark')
        })

        cy.get('[role="radio"][aria-checked="true"]')
            .should('contain', 'Oscuro')

        cy.window().then((win) => {
            expect(win.localStorage.getItem('capris_tema')).to.equal('oscuro')
        })

        cy.screenshot('hu-029-modo-oscuro-aplicado')
    })

    it('AC2 - seleccionar modo claro restaura la paleta clara en todas las pantallas', () => {
        visitarAjustes()

        elegirModo('Oscuro')
        elegirModo('Claro')

        cy.document().then((doc) => {
            expect(doc.documentElement.getAttribute('data-theme')).to.equal('light')
        })

        cy.get('[role="radio"][aria-checked="true"]')
            .should('contain', 'Claro')

        cy.window().then((win) => {
            expect(win.localStorage.getItem('capris_tema')).to.equal('claro')
        })
    })

    it('AC4 - la preferencia persiste al recargar o reabrir la aplicacion (local)', () => {
        visitarAjustes()

        elegirModo('Oscuro')

        // Recarga completa: la preferencia queda aplicada desde localStorage.
        cy.reload()
        cy.contains('h1', 'Ajustes').should('be.visible')

        cy.document().then((doc) => {
            expect(doc.documentElement.getAttribute('data-theme')).to.equal('dark')
        })

        cy.screenshot('hu-029-preferencia-persistida-tras-recarga')
    })

    it('AC1/AC2 - el alternador de la barra superior cambia el modo entre pantallas', () => {
        visitarAjustes()

        elegirModo('Claro')

        // Llega al dashboard y alterna con el boton compacto del TopBar
        // (sin texto visible: se localiza por aria-label).
        cy.visitarConSesion('/dashboard')

        cy.get('button[aria-label="Cambiar a modo oscuro"]')
            .click()

        cy.document().then((doc) => {
            expect(doc.documentElement.getAttribute('data-theme')).to.equal('dark')
        })

        cy.get('button[aria-label="Cambiar a modo claro"]')
            .should('be.visible')

        cy.screenshot('hu-029-alternador-topbar-oscuro')
    })

    it('AC6 - la preferencia es local al dispositivo y no requiere sesion para persistir', () => {
        visitarAjustes()

        elegirModo('Oscuro')

        // Simula el cierre/reapertura de la aplicacion sin sesion iniciada
        // (destruye sessionStorage de auth, conserva el localStorage del
        // dispositivo). No se usa el boton "Cerrar sesion" porque esta prueba
        // usa un token ficticio que el servidor rechazaria.
        cy.clearAllSessionStorage()
        cy.visit('/login')

        cy.contains('h1', 'Iniciar sesión').should('be.visible')

        // La preferencia quedo guardada localmente en el dispositivo
        // (localStorage), aunque la pantalla publica de login no monte el hook
        // de tema.
        cy.window().then((win) => {
            expect(win.localStorage.getItem('capris_tema')).to.equal('oscuro')
        })

        // Al iniciar sesion de nuevo, la preferencia del dispositivo se aplica
        // sin que el backend intervenga: el tema no depende de la cuenta.
        cy.get('#empresa').select('1')
        cy.get('#username').type('wmolina')
        cy.get('#contrasena').type('Capris2026!')
        cy.contains('button', 'Iniciar sesión').click()

        cy.url().should('include', '/dashboard')

        cy.get('html').should('have.attr', 'data-theme', 'dark')

        cy.screenshot('hu-029-preferencia-local-tras-nueva-sesion')
    })
})