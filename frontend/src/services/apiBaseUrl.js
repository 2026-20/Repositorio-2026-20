// Unico lugar donde vive el host:puerto del backend -- antes estaba
// copiado y pegado en cada servicio (auditoriaService.js, authService.js,
// usuarioService.js, recuperacionService.js), arriesgando que quedaran
// desincronizados si alguno cambiaba sin tocar los demas.
//
// Sin VITE_API_BASE_URL definida, apunta a localhost -- solo sirve si el
// backend corre en el mismo dispositivo. Para probar desde otro
// dispositivo en la misma red (celular, etc.) hay que definirla con la IP
// de quien corre el backend (ver .env.local).
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'
