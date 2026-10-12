import styles from './Card.module.css'

// Tarjeta base (mismo patron que Card de la demo). Con interactive, se
// pinta como elemento clicable; "as" permite renderizarla como <button> o
// <Link> para que la tarjeta ENTERA sea accesible con teclado.
export default function Card({ as: Componente = 'div', interactive = false, className = '', children, ...rest }) {
    const clases = [styles.card, interactive ? styles.interactiva : '', className].filter(Boolean).join(' ')

    return (
        <Componente className={clases} {...rest}>
            {children}
        </Componente>
    )
}
