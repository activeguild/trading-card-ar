import { Link } from 'react-router-dom'
import styles from './HomePage.module.css'

export function HomePage() {
  return (
    <div className={styles.page}>
      <img src="/logo.webp" alt="トレカAR" className={styles.logo} />
      <div className={styles.menu}>
        <Link to="/collections" className={styles.menuItem}>
          <span className={styles.menuIcon}>🃏</span>
          <span className={styles.menuLabel}>Collections</span>
        </Link>
        <Link to="/decks" className={styles.menuItem}>
          <span className={styles.menuIcon}>📦</span>
          <span className={styles.menuLabel}>Decks</span>
        </Link>
      </div>
    </div>
  )
}
