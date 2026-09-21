import {
    Bell,
    ChevronRight,
    ClipboardList,
    Eye,
    EyeOff,
    FileText,
    Home,
    Lock,
    LogOut,
    Moon,
    Settings,
    Sun,
    User,
    Users,
} from 'lucide-react'

// Componente central de iconografia: los llamadores piden un nombre
// semantico (igual que D09 -- <Icon name="sync" size={18} />), nunca
// importan lucide-react directo. Si el proyecto necesita cambiar de
// libreria mas adelante, solo se toca este archivo.
const ICONOS = {
    inicio: Home,
    usuarios: Users,
    conteo: ClipboardList,
    alertas: Bell,
    reportes: FileText,
    cerrarSesion: LogOut,
    usuario: User,
    chevronDerecha: ChevronRight,
    proximamente: Lock,
    cerradura: Lock,
    temaClaro: Sun,
    temaOscuro: Moon,
    ajustes: Settings,
    ojo: Eye,
    ojoOculto: EyeOff,
}

export default function Icon({ name, size = 20, className }) {
    const Componente = ICONOS[name]

    if (!Componente) return null

    return (
        <Componente
            size={size}
            className={className}
            aria-hidden="true"
            strokeWidth={1.8}
        />
    )
}
