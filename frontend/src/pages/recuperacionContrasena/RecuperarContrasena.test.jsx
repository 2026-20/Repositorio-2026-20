import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

  it('en el paso del OTP indica que hacer si el correo no llega', async () => {
    recuperacionService.solicitarRecuperacion.mockResolvedValue({ mensaje: 'ok' })

    renderConRouter()

    fireEvent.change(screen.getByLabelText('Correo registrado'), { target: { value: 'persona@capris.cr' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))

    await screen.findByLabelText('Código de 6 dígitos')

    expect(screen.getByText(/Revisá también la carpeta de spam/)).toBeInTheDocument()
    expect(screen.getByText(/contactá a un administrador/)).toBeInTheDocument()
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

  describe('reenviar código', () => {
    // Los timers deben quedar "fake" desde antes de que se cree el primer
    // setTimeout de la cuenta regresiva -- si se instalan despues, ese
    // primer timer ya quedo armado con el reloj real y advanceTimersByTimeAsync
    // no lo controla.
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    async function llegarAlPasoOtp() {
      recuperacionService.solicitarRecuperacion.mockResolvedValue({ mensaje: 'ok' })

      renderConRouter()

      fireEvent.change(screen.getByLabelText('Correo registrado'), { target: { value: 'persona@capris.cr' } })
      fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))

      // Bajo fake timers, un solo flush no alcanza para que la promesa
      // mockeada y el cambio de paso terminen de propagarse -- se reintenta
      // hasta que el campo del OTP aparezca de verdad.
      for (let intentos = 0; intentos < 50; intentos += 1) {
        await vi.advanceTimersByTimeAsync(0)
        if (screen.queryByLabelText('Código de 6 dígitos')) {
          return
        }
      }
      throw new Error('No se llegó al paso del OTP')
    }

    async function agotarLaEspera() {
      // La cuenta regresiva se reprograma un segundo a la vez (un setTimeout
      // nuevo por cada render), y React tambien usa timers internos para
      // programar ese re-render -- con fake timers eso no avanza 1:1 contra
      // el tiempo simulado, asi que se avanza de a poco hasta que el boton
      // de verdad se habilite, en vez de asumir una cantidad fija de pasos.
      for (let intentos = 0; intentos < 200; intentos += 1) {
        await vi.advanceTimersByTimeAsync(1000)
        if (screen.queryByRole('button', { name: 'Reenviar código' })) {
          return
        }
      }
      throw new Error('La cuenta regresiva de reenvío no llegó a cero')
    }

    it('aparece deshabilitado con la cuenta regresiva de 60 segundos al llegar al paso del OTP', async () => {
      await llegarAlPasoOtp()

      const boton = screen.getByRole('button', { name: 'Reenviar código (60s)' })
      expect(boton).toBeDisabled()
    })

    it('se habilita despues de que pasa el minuto de espera', async () => {
      await llegarAlPasoOtp()
      await agotarLaEspera()

      const boton = screen.getByRole('button', { name: 'Reenviar código' })
      expect(boton).not.toBeDisabled()
    })

    it('al hacer clic, vuelve a pedir el codigo, limpia el campo y reinicia la cuenta regresiva', async () => {
      await llegarAlPasoOtp()

      fireEvent.change(screen.getByLabelText('Código de 6 dígitos'), { target: { value: '123456' } })

      await agotarLaEspera()

      recuperacionService.solicitarRecuperacion.mockResolvedValue({ mensaje: 'Te enviamos un código nuevo.' })
      fireEvent.click(screen.getByRole('button', { name: 'Reenviar código' }))
      await vi.advanceTimersByTimeAsync(0)

      expect(recuperacionService.solicitarRecuperacion).toHaveBeenCalledTimes(2)
      expect(screen.getByLabelText('Código de 6 dígitos')).toHaveValue('')
      expect(screen.getByRole('button', { name: 'Reenviar código (60s)' })).toBeDisabled()
    })
  })
})
