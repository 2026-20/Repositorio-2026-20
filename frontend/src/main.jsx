import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Inter auto-hospedada (D03) -- la app es offline-first, un <link> a Google Fonts
// no cargaria sin conexion. Pesos 400 (texto base) y 600 (encabezados/botones/etiquetas).
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthProvider.jsx'

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <AuthProvider>
            <App />
        </AuthProvider>
    </StrictMode>,
)