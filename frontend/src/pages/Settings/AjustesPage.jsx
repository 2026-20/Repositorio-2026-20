import Icon from '../../components/ui/Icon'
import { useTheme } from '../../hooks/useTheme'
import styles from './AjustesPage.module.css'

const OPCIONES_APARIENCIA = [
    { valor: 'claro', etiqueta: 'Claro', icono: 'temaClaro' },
    { valor: 'oscuro', etiqueta: 'Oscuro', icono: 'temaOscuro' },
]

// HU-029 (#67): AC1/AC2 -- eleccion explicita de modo claro/oscuro desde una
// pantalla de apariencia, con aplicacion inmediata. Por decision de negocio
// no se ofrece "seguir al sistema" como opcion aqui (ver useTheme) -- ese
// valor solo se usa internamente antes de la primera eleccion (AC3). AC4 y
// AC6 (persistencia local, sin sincronizar con el backend) los cubre
// useTheme via localStorage, sin acciones adicionales en esta pantalla.
export default function AjustesPage() {
    const { temaEfectivo, setTema } = useTheme()

    return (
        <main>
            <h1>Ajustes</h1>

            <section className={styles.seccion}>
                <h2 className={styles.tituloSeccion}>Apariencia</h2>

                <p className={styles.descripcion}>
                    Elegí cómo se ve la aplicación en este dispositivo. La
                    preferencia se guarda solo aquí y no se comparte con otros
                    dispositivos donde inicies sesión.
                </p>

                <div
                    className={styles.opciones}
                    role="radiogroup"
                    aria-label="Modo de visualización"
                >
                    {OPCIONES_APARIENCIA.map((opcion) => (
                        <button
                            key={opcion.valor}
                            type="button"
                            role="radio"
                            aria-checked={temaEfectivo === opcion.valor}
                            className={`${styles.opcion} ${
                                temaEfectivo === opcion.valor ? styles.seleccionada : ''
                            }`}
                            onClick={() => setTema(opcion.valor)}
                        >
                            <Icon name={opcion.icono} size={24} />
                            {opcion.etiqueta}
                        </button>
                    ))}
                </div>
            </section>
        </main>
    )
}
