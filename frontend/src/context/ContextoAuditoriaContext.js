import { createContext } from 'react'

export const ContextoAuditoriaContext = createContext(null)

// HU-004: clave de sessionStorage del contrato activo (ver ContextoAuditoriaProvider).
export const CLAVE_CONTEXTO = 'capris_contexto_auditoria'
