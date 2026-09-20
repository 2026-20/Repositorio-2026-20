import { paths } from './paths'

// Secciones del menu principal. Cada item que no tiene "path" todavia
// (disponible: false) representa un modulo del backlog que aun no se
// implementa -- se muestra como "proximamente" en vez de ocultarse, para
// que el mapa completo del sistema sea visible desde ya (sprint 1).
//
// No se replica la jerarquia Clientes/Bodegas/Productos/Lotes del mockup
// de referencia: en este proyecto el aislamiento multiempresa (HU-023)
// significa que un usuario nunca navega entre "clientes", solo ve su
// propia empresa -- esa jerarquia no aplica a nuestro modelo de datos.
export const NAV_ITEMS = [
    {
        label: 'Inicio',
        path: paths.dashboard,
        icon: 'inicio',
        disponible: true,
    },
    {
        label: 'Conteo',
        icon: 'conteo',
        disponible: false,
        descripcion: 'Registro y corrección de conteos físicos (F03)',
    },
    {
        label: 'Alertas',
        icon: 'alertas',
        disponible: false,
        descripcion: 'Umbrales de desabastecimiento y vencimiento (F05)',
    },
    {
        label: 'Reportes',
        icon: 'reportes',
        disponible: false,
        descripcion: 'Transmisión al ERP, trazabilidad y reportes (F04)',
    },
    {
        label: 'Usuarios',
        path: paths.usuarios,
        icon: 'usuarios',
        disponible: true,
        rolRequerido: 'Administrador',
    },
    {
        label: 'Ajustes',
        path: paths.ajustes,
        icon: 'ajustes',
        disponible: true,
    },
]
