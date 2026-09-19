import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RecuperarContrasena from './RecuperarContrasena'
import * as recuperacionService from '../../services/recuperacionService'

vi.mock('../../services/recuperacionService', async () => {
  const real = await vi.importActual('../../services/recuperacionService')
  return {
    ...real,
    solicitarRecuperacion: vi.fn(),
  }
})

describe('RecuperarContrasena', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
  })

  it('muestra el mensaje de sin conexión y no llama al backend si está offline', () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })

    render(<RecuperarContrasena />)

    expect(screen.getByText('Funcionalidad no disponible sin conexión a red')).toBeInTheDocument()
    expect(recuperacionService.solicitarRecuperacion).not.toHaveBeenCalled()
  })

  it('avanza al paso del OTP tras enviar el correo exitosamente', async () => {
    recuperacionService.solicitarRecuperacion.mockResolvedValue({
      mensaje: 'Si el correo corresponde a una cuenta registrada, vas a recibir un mensaje con instrucciones.',
    })

    render(<RecuperarContrasena />)

    fireEvent.change(screen.getByLabelText('Correo registrado'), { target: { value: 'persona@capris.cr' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))

    await waitFor(() => expect(screen.getByLabelText('Código de 6 dígitos')).toBeInTheDocument())
  })
})
