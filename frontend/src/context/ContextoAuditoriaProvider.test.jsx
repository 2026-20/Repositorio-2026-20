import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { AuthContext } from './AuthContext'
import { CLAVE_CONTEXTO } from './ContextoAuditoriaContext'
import { ContextoAuditoriaProvider } from './ContextoAuditoriaProvider'
import { useContextoAuditoria } from './useContextoAuditoria'

const CONTRATO = { numCon: 'C-001', descripcion: 'HEMATOLOGIA', empresaId: 1, bodegas: [] }

function Consumidor() {
    const { contexto, establecerContexto, seleccionarBodega, limpiarContexto } = useContextoAuditoria()
    return (
        <>
            <span data-testid="contexto">{contexto?.numCon ?? 'ninguno'}</span>
            <span data-testid="bodega">{contexto?.codBodSeleccionada ?? 'sin bodega'}</span>
            <button type="button" onClick={() => seleccionarBodega('A1')}>
                bodega
            </button>
            <button type="button" onClick={() => establecerContexto({ ...CONTRATO, numCon: 'C-002' })}>
                otro
            </button>
            <button type="button" onClick={() => establecerContexto(CONTRATO)}>
                establecer
            </button>
            <button type="button" onClick={limpiarContexto}>
                limpiar
            </button>
        </>
    )
}

function arbol(usuario) {
    return (
        <AuthContext.Provider value={{ usuario }}>
            <ContextoAuditoriaProvider>
                <Consumidor />
            </ContextoAuditoriaProvider>
        </AuthContext.Provider>
    )
}

describe('ContextoAuditoriaProvider', () => {
    beforeEach(() => {
        sessionStorage.clear()
    })

    afterEach(() => {
        sessionStorage.clear()
    })

    it('arranca sin contexto activo', () => {
        render(arbol({ id: 7 }))

        expect(screen.getByTestId('contexto')).toHaveTextContent('ninguno')
    })

    it('establecerContexto lo deja activo y lo guarda en la sesion para sobrevivir a recargar (criterio 2)', () => {
        render(arbol({ id: 7 }))

        fireEvent.click(screen.getByRole('button', { name: 'establecer' }))

        expect(screen.getByTestId('contexto')).toHaveTextContent('C-001')
        const guardado = JSON.parse(sessionStorage.getItem(CLAVE_CONTEXTO))
        expect(guardado.usuarioId).toBe(7)
        expect(guardado.contrato.numCon).toBe('C-001')
        expect(guardado.contrato.seleccionadoEn).toBeTruthy()
    })

    it('al montar recupera el contexto guardado del mismo usuario', () => {
        sessionStorage.setItem(CLAVE_CONTEXTO, JSON.stringify({ usuarioId: 7, contrato: CONTRATO }))

        render(arbol({ id: 7 }))

        expect(screen.getByTestId('contexto')).toHaveTextContent('C-001')
    })

    it('no muestra el contexto que dejo otro usuario en el mismo dispositivo', () => {
        sessionStorage.setItem(CLAVE_CONTEXTO, JSON.stringify({ usuarioId: 99, contrato: CONTRATO }))

        render(arbol({ id: 7 }))

        expect(screen.getByTestId('contexto')).toHaveTextContent('ninguno')
    })

    it('al cerrar sesion se descarta el contexto', () => {
        const { rerender } = render(arbol({ id: 7 }))
        fireEvent.click(screen.getByRole('button', { name: 'establecer' }))

        rerender(arbol(null))

        expect(screen.getByTestId('contexto')).toHaveTextContent('ninguno')
        expect(sessionStorage.getItem(CLAVE_CONTEXTO)).toBeNull()
    })

    it('limpiarContexto quita el contexto activo', () => {
        render(arbol({ id: 7 }))
        fireEvent.click(screen.getByRole('button', { name: 'establecer' }))

        fireEvent.click(screen.getByRole('button', { name: 'limpiar' }))

        expect(screen.getByTestId('contexto')).toHaveTextContent('ninguno')
        expect(sessionStorage.getItem(CLAVE_CONTEXTO)).toBeNull()
    })

    it('seleccionarBodega guarda la bodega elegida dentro del contrato activo', () => {
        render(arbol({ id: 7 }))
        fireEvent.click(screen.getByRole('button', { name: 'establecer' }))

        fireEvent.click(screen.getByRole('button', { name: 'bodega' }))

        expect(screen.getByTestId('bodega')).toHaveTextContent('A1')
        expect(JSON.parse(sessionStorage.getItem(CLAVE_CONTEXTO)).contrato.codBodSeleccionada).toBe('A1')
    })

    it('cambiar de contrato descarta la bodega elegida del contrato anterior', () => {
        render(arbol({ id: 7 }))
        fireEvent.click(screen.getByRole('button', { name: 'establecer' }))
        fireEvent.click(screen.getByRole('button', { name: 'bodega' }))

        fireEvent.click(screen.getByRole('button', { name: 'otro' }))

        expect(screen.getByTestId('contexto')).toHaveTextContent('C-002')
        expect(screen.getByTestId('bodega')).toHaveTextContent('sin bodega')
    })
})
