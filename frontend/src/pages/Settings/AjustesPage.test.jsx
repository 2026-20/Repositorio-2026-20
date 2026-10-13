import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../context/AuthContext'
import * as authService from '../../services/authService'
import * as usuarioService from '../../services/usuarioService'
import AjustesPage from './AjustesPage'

const PERFIL_DE_PRUEBA = {
    nombreCompleto: 'William Molina',
    correo: 'william@capris.cr',
    rol: 'Administrador',
    empresa: 'CAPRIS Médica',
}

function renderAjustes(usuario = { nombreCompleto: 'William Molina' }) {
    return render(
        <AuthContext.Provider value={{ token: 'jwt-prueba', usuario }}>
            <AjustesPage />
        </AuthContext.Provider>,
    )
}

describe('AjustesPage', () => {
    beforeEach(() => {
        localStorage.clear()
        document.documentElement.removeAttribute('data-theme')
        vi.spyOn(usuarioService, 'consultarPerfil').mockResolvedValue(PERFIL_DE_PRUEBA)
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
        localStorage.clear()
        document.documentElement.removeAttribute('data-theme')
    })

    it('muestra exactamente dos opciones: Claro y Oscuro (sin "sistema")', () => {
        renderAjustes()

        const opciones = screen.getAllByRole('radio')
        expect(opciones).toHaveLength(2)
        expect(screen.getByRole('radio', { name: /Claro/ })).toBeInTheDocument()
        expect(screen.getByRole('radio', { name: /Oscuro/ })).toBeInTheDocument()
        expect(screen.queryByText(/Sistema/i)).not.toBeInTheDocument()
    })

    it('al elegir Oscuro, aplica data-theme=dark de inmediato', () => {
        renderAjustes()

        fireEvent.click(screen.getByRole('radio', { name: /Oscuro/ }))

        expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
        expect(screen.getByRole('radio', { name: /Oscuro/ })).toHaveAttribute('aria-checked', 'true')
        expect(screen.getByRole('radio', { name: /Claro/ })).toHaveAttribute('aria-checked', 'false')
    })

    it('al elegir Claro, aplica data-theme=light y persiste la eleccion', () => {
        renderAjustes()

        fireEvent.click(screen.getByRole('radio', { name: /Claro/ }))

        expect(document.documentElement.getAttribute('data-theme')).toBe('light')
        expect(localStorage.getItem('capris_tema')).toBe('claro')
    })
})

// HU-022: consulta del perfil del usuario autenticado.
describe('AjustesPage - informacion del usuario', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
        localStorage.clear()
    })

    it('muestra el perfil consultado al backend', async () => {
        vi.spyOn(usuarioService, 'consultarPerfil').mockResolvedValue(PERFIL_DE_PRUEBA)
        renderAjustes()

        expect(await screen.findByText('William Molina')).toBeInTheDocument()
        expect(screen.getByText('william@capris.cr')).toBeInTheDocument()
        expect(screen.getByText('CAPRIS Médica')).toBeInTheDocument()
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('sin conexion, muestra la informacion guardada en la sesion en vez de un error', async () => {
        vi.stubGlobal('navigator', { ...navigator, onLine: false })
        vi.spyOn(usuarioService, 'consultarPerfil').mockRejectedValue(new Error('Failed to fetch'))

        renderAjustes({
            nombreCompleto: 'Andrey Meléndez',
            correo: 'andrey@capris.cr',
            rol: 'Usuario de Campo',
            empresaNombre: 'CAPRIS Médica',
        })

        expect(await screen.findByText('Andrey Meléndez')).toBeInTheDocument()
        expect(screen.getByText('andrey@capris.cr')).toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent('Sin conexión')
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('navigator.onLine da falso positivo, pero igual muestra la informacion de la sesion', async () => {
        // Wifi conectado pero sin salida real a internet: navigator.onLine
        // sigue en true, pero fetch() nunca llega a tener una respuesta real
        // (por eso el error no trae .status) -- la segunda barrera.
        vi.spyOn(usuarioService, 'consultarPerfil').mockRejectedValue(new Error('Failed to fetch'))

        renderAjustes({
            nombreCompleto: 'Andrey Meléndez',
            correo: 'andrey@capris.cr',
            rol: 'Usuario de Campo',
            empresaNombre: 'CAPRIS Médica',
        })

        expect(await screen.findByText('Andrey Meléndez')).toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent('Sin conexión')
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('en linea, si la consulta falla, muestra el error real', async () => {
        // error.status viene de procesarRespuesta ante un 4xx/5xx real del
        // backend -- lo que distingue esto de una falla de red (ver el
        // comentario de sinConexionDeVerdad en AjustesPage.jsx).
        vi.spyOn(usuarioService, 'consultarPerfil').mockRejectedValue(
            Object.assign(new Error('No fue posible consultar el perfil'), { status: 500 }),
        )
        renderAjustes()

        expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible consultar el perfil')
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
})

// HU-045 AC1 y AC3: seccion de cambio de contraseña con actual + nueva + confirmar.
describe('AjustesPage - cambio de contraseña', () => {
    beforeEach(() => {
        vi.spyOn(usuarioService, 'consultarPerfil').mockResolvedValue(PERFIL_DE_PRUEBA)
    })

    afterEach(() => {
        vi.restoreAllMocks()
        localStorage.clear()
    })

    function abrirModal() {
        fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
    }

    function completar({ actual = 'Actual123!', nueva = 'Nueva123!', confirmacion = 'Nueva123!' } = {}) {
        abrirModal()
        fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: actual } })
        fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: nueva } })
        fireEvent.change(screen.getByLabelText('Confirmar contraseña nueva'), {
            target: { value: confirmacion },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    }

    it('no muestra los campos hasta que se abre la ventana de cambio de contraseña', () => {
        renderAjustes()

        expect(screen.queryByLabelText('Contraseña actual')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeInTheDocument()
    })

    it('al hacer clic en Cambiar contraseña, abre la ventana con los tres campos', () => {
        renderAjustes()

        abrirModal()

        expect(screen.getByRole('dialog', { name: 'Cambiar contraseña' })).toBeInTheDocument()
        expect(screen.getByLabelText('Contraseña actual')).toBeInTheDocument()
        expect(screen.getByLabelText('Contraseña nueva')).toBeInTheDocument()
        expect(screen.getByLabelText('Confirmar contraseña nueva')).toBeInTheDocument()
    })

    it('cierra la ventana al hacer clic en el boton de cerrar', () => {
        renderAjustes()

        abrirModal()
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('llama al backend con el token, la actual y la nueva, y confirma el exito', async () => {
        const cambiar = vi.spyOn(authService, 'cambiarContrasena').mockResolvedValue(null)
        renderAjustes()

        completar()

        expect(await screen.findByRole('status')).toHaveTextContent('se cambió correctamente')
        expect(cambiar).toHaveBeenCalledWith('jwt-prueba', 'Actual123!', 'Nueva123!')
        expect(screen.getByLabelText('Contraseña actual')).toHaveValue('')
    })

    it('no llama al backend si la confirmacion no coincide con la nueva', () => {
        const cambiar = vi.spyOn(authService, 'cambiarContrasena').mockResolvedValue(null)
        renderAjustes()

        completar({ confirmacion: 'Distinta123!' })

        expect(screen.getByRole('alert')).toHaveTextContent('no coincide')
        expect(cambiar).not.toHaveBeenCalled()
    })

    it('no llama al backend si falta la contraseña actual', () => {
        const cambiar = vi.spyOn(authService, 'cambiarContrasena').mockResolvedValue(null)
        renderAjustes()

        completar({ actual: '' })

        expect(screen.getByRole('alert')).toHaveTextContent('contraseña actual')
        expect(cambiar).not.toHaveBeenCalled()
    })

    it('muestra el mensaje del backend y las violaciones de la politica', async () => {
        const error = Object.assign(new Error('La contraseña no cumple la política de seguridad'), {
            detalles: ['La contraseña debe contener al menos un número'],
        })
        vi.spyOn(authService, 'cambiarContrasena').mockRejectedValue(error)
        renderAjustes()

        completar({ nueva: 'SinNumero!', confirmacion: 'SinNumero!' })

        const alerta = await screen.findByRole('alert')
        expect(alerta).toHaveTextContent('no cumple la política de seguridad')
        expect(alerta).toHaveTextContent('al menos un número')
        await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    })

    it('muestra el mensaje del backend cuando la contraseña actual es incorrecta', async () => {
        vi.spyOn(authService, 'cambiarContrasena').mockRejectedValue(
            new Error('La contraseña actual no es correcta'),
        )
        renderAjustes()

        completar()

        expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña actual no es correcta')
    })
})
