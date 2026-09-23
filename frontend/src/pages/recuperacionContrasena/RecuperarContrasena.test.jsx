import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RecuperarContrasena from './RecuperarContrasena'
import * as recuperacionService from '../../services/recuperacionService'

function renderConRouter() {
  return render(
    <MemoryRouter>
      <RecuperarContrasena />
    </MemoryRouter>,
  )
}

vi.mock('../../services/recuperacionService', async () => {
  const real = await vi.importActual('../../services/recuperacionService')
  return {
    ...real,
    solicitarRecuperacion: vi.fn(),
    validarOtp: vi.fn(),
    establecerNuevaContrasena: vi.fn(),
  }
})

describe('RecuperarContrasena', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
  })

  it('muestra el mensaje de sin conexión y no llama al backend si está offline', () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })

    renderConRouter()

    expect(screen.getByText('Funcionalidad no disponible sin conexión a red')).toBeInTheDocument()
    expect(recuperacionService.solicitarRecuperacion).not.toHaveBeenCalled()
  })

  it('avanza al paso del OTP tras enviar el correo exitosamente', async () => {
    recuperacionService.solicitarRecuperacion.mockResolvedValue({
      mensaje: 'Si el correo corresponde a una cuenta registrada, vas a recibir un mensaje con instrucciones.',
    })

    renderConRouter()

    fireEvent.change(screen.getByLabelText('Correo registrado'), { target: { value: 'persona@capris.cr' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))

    await waitFor(() => expect(screen.getByLabelText('Código de 6 dígitos')).toBeInTheDocument())
  })

  it('si se envia el correo vacio, muestra el error en español sin llamar al backend', () => {
    renderConRouter()

    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Ingresá el correo registrado.')
    expect(recuperacionService.solicitarRecuperacion).not.toHaveBeenCalled()
  })

  it('si el correo no tiene formato valido, muestra el error en español sin llamar al backend', () => {
    renderConRouter()

    fireEvent.change(screen.getByLabelText('Correo registrado'), { target: { value: 'no-es-un-correo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Ingresá un correo válido.')
    expect(recuperacionService.solicitarRecuperacion).not.toHaveBeenCalled()
  })

  it('ofrece un enlace para volver al login mientras el flujo no ha terminado', () => {
    renderConRouter()

    const enlace = screen.getByRole('link', { name: 'Volver al inicio de sesión' })
    expect(enlace).toBeInTheDocument()
    expect(enlace).toHaveAttribute('href', '/login')
  })

  it('al terminar el flujo, muestra un boton para ir al login y ya no el enlace de volver', async () => {
    recuperacionService.solicitarRecuperacion.mockResolvedValue({ mensaje: 'ok' })
    recuperacionService.validarOtp.mockResolvedValue({ tokenSesionTemporal: 'token-temporal' })
    recuperacionService.establecerNuevaContrasena.mockResolvedValue({
      mensaje: 'Contraseña actualizada. Ya podés iniciar sesión con la nueva.',
    })

    renderConRouter()

    fireEvent.change(screen.getByLabelText('Correo registrado'), { target: { value: 'persona@capris.cr' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
    await screen.findByLabelText('Código de 6 dígitos')

    fireEvent.change(screen.getByLabelText('Código de 6 dígitos'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar código' }))
    await screen.findByLabelText('Nueva contraseña')

    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'Nueva123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nueva contraseña' }))

    const boton = await screen.findByRole('link', { name: 'Ir a iniciar sesión' })
    expect(boton).toHaveAttribute('href', '/login')
    expect(screen.queryByRole('link', { name: 'Volver al inicio de sesión' })).not.toBeInTheDocument()
  })
})
