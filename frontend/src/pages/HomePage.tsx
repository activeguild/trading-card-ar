import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiJson } from '../lib/api'
import styles from './HomePage.module.css'

type Summary = {
  collection_count: number
  card_count: number
  deck_count: number
  effect_count: number
}

export function HomePage() {
  const { token } = useAuth()
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    apiJson<Summary>('/api/collections/summary', token).then(setSummary)
  }, [token])

  return (
    <div className={styles.page}>
      <img src="/logo.webp" alt="トレカAR" className={styles.logo} />

      {summary && (
        <div className={styles.stats}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{summary.collection_count}</span>
            <span className={styles.statLabel}>Collections</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{summary.card_count}</span>
            <span className={styles.statLabel}>Cards</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{summary.effect_count}</span>
            <span className={styles.statLabel}>Effects</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{summary.deck_count}</span>
            <span className={styles.statLabel}>Decks</span>
          </div>
        </div>
      )}

      <div className={styles.menu}>
        <Link to="/collections" className={styles.menuItem}>
          <span className={styles.menuLabel}>Collections</span>
        </Link>
        <Link to="/decks" className={styles.menuItem}>
          <span className={styles.menuLabel}>Decks</span>
        </Link>
      </div>
    </div>
  )
}
