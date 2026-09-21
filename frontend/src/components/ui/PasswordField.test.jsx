import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import PasswordField from './PasswordField'

function renderCampo() {
    return render(
        <>
            <label htmlFor="clave">Contraseña</label>
            <PasswordField
                id="clave"
                value="Secreto2026!"
                onChange={() => {}}
            />
        </>,
    )
}

describe('PasswordField', () => {
    it('oculta el texto por defecto y lo muestra al tocar el ojito', () => {
        renderCampo()

        const campo = screen.getByLabelText('Contraseña')
        expect(campo).toHaveAttribute('type', 'password')

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Mostrar contraseña',
            }),
        )
        expect(campo).toHaveAttribute('type', 'text')

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Ocultar contraseña',
            }),
        )
        expect(campo).toHaveAttribute('type', 'password')
    })

    it('no envía el formulario al tocar el ojito', () => {
        const enviar = () => {
            throw new Error('el formulario no debe enviarse al alternar')
        }

        render(
            <form onSubmit={enviar}>
                <label htmlFor="clave">Contraseña</label>
                <PasswordField
                    id="clave"
                    value="Secreto2026!"
                    onChange={() => {}}
                />
            </form>,
        )

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Mostrar contraseña',
            }),
        )
    })
})