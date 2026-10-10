import { useContext } from 'react'
import { JornadaContext } from './JornadaContext'

export function useJornada() {
    return useContext(JornadaContext)
}
