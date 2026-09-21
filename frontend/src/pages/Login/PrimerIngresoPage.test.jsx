import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthContext } from '../../context/AuthContext'
import * as authService from '../../services/authService'
import PrimerIngresoPage from './PrimerIngresoPage'

function renderPagina(contexto = {}) {
    const valor = {
        token: 'jwt-prueba',
        usuario: { nombreCompleto: 'Usuario Nuevo', debeCambiarContrasena: true },
        logout: vi.fn(),
        marcarContrasenaCambiada: vi.fn(),
        ...contexto,
    }

    render(
        <AuthContext.Provider value={valor}>
            <MemoryRouter initialEntries={['/primer-ingreso/cambiar-password']}>
                <Routes>
                    <Route
                        path="/primer-ingreso/cambiar-password"
                        element={<PrimerIngresoPage />}
                    />
                    <Route path="/dashboard" element={<p>Dashboard</p>} />
                </Routes>
            </MemoryRouter>
        </AuthContext.Provider>,
    )

    return valor
}

function completar({ nueva = 'Nueva123!', confirmacion = 'Nueva123!' } = {}) {
    fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: nueva } })
    fireEvent.change(screen.getByLabelText('Confirmar contraseña nueva'), {
        target: { value: confirmacion },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))
}

// HU-044 AC2: pantalla de cambio obligatorio, sin contraseña actual (ya la dio en el login).
describe('PrimerIngresoPage', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('pide solo la contraseña nueva y su confirmacion', () => {
        renderPagina()

        expect(screen.getByLabelText('Contraseña nueva')).toBeInTheDocument()
        expect(screen.getByLabelText('Confirmar contraseña nueva')).toBeInTheDocument()
        expect(screen.queryByLabelText('Contraseña actual')).not.toBeInTheDocument()
    })

    it('al guardar, llama al backend, baja la bandera y lleva al dashboard', async () => {
        const cambiar = vi
            .spyOn(authService, 'cambiarContrasenaPrimerIngreso')
            .mockResolvedValue(null)
        const contexto = renderPagina()

        completar()

        expect(await screen.findByText('Dashboard')).toBeInTheDocument()
        expect(cambiar).toHaveBeenCalledWith('jwt-prueba', 'Nueva123!')
        expect(contexto.marcarContrasenaCambiada).toHaveBeenCalledTimes(1)
    })

    it('no llama al backend si la confirmacion no coincide', () => {
        const cambiar = vi.spyOn(authService, 'cambiarContrasenaPrimerIngreso')
        const contexto = renderPagina()

        completar({ confirmacion: 'Distinta123!' })

        expect(screen.getByRole('alert')).toHaveTextContent('no coincide')
        expect(cambiar).not.toHaveBeenCalled()
        expect(contexto.marcarContrasenaCambiada).not.toHaveBeenCalled()
    })

    it('si el backend la rechaza, muestra el error y se queda en la pantalla', async () => {
        vi.spyOn(authService, 'cambiarContrasenaPrimerIngreso').mockRejectedValue(
            Object.assign(new Error('La contraseña no cumple la política de seguridad'), {
                detalles: ['La contraseña debe tener al menos 8 caracteres'],
            }),
        )
        const contexto = renderPagina()

        completar({ nueva: 'corta', confirmacion: 'corta' })

        const alerta = await screen.findByRole('alert')
        expect(alerta).toHaveTextContent('al menos 8 caracteres')
        expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
        expect(contexto.marcarContrasenaCambiada).not.toHaveBeenCalled()
    })

    it('permite cerrar sesion sin cambiar la contraseña', () => {
        const contexto = renderPagina()

        fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

        expect(contexto.logout).toHaveBeenCalledTimes(1)
    })
})
