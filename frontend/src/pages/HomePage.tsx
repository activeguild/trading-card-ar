import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiJson } from '../lib/api'
import styles from './HomePage.module.css'

type Summary = {
  card_count: number
}

const RANKS = [
  { name: 'N', min: 0, max: 50, color: '#94a3b8', bg: '#f1f5f9' },
  { name: 'R', min: 50, max: 150, color: '#3b82f6', bg: '#dbeafe' },
  { name: 'SR', min: 150, max: 300, color: '#a855f7', bg: '#f3e8ff' },
  { name: 'SSR', min: 300, max: 500, color: '#f59e0b', bg: '#fef3c7' },
  { name: 'UR', min: 500, max: Infinity, color: '#ef4444', bg: '#fee2e2' },
]

function getRank(count: number) {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (count >= RANKS[i].min) return { rank: RANKS[i], index: i }
  }
  return { rank: RANKS[0], index: 0 }
}

export function HomePage() {
  const { token } = useAuth()
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    apiJson<Summary>('/api/collections/summary', token).then(setSummary)
  }, [token])

  const cardCount = summary?.card_count ?? 0
  const { rank, index } = getRank(cardCount)
  const nextRank = index < RANKS.length - 1 ? RANKS[index + 1] : null
  const progress = nextRank
    ? ((cardCount - rank.min) / (nextRank.min - rank.min)) * 100
    : 100

  return (
    <div className={styles.page}>
      <img src="/logo.webp" alt="トレカAR" className={styles.logo} />

      {summary && (
        <div className={styles.rankCard}>
          <div className={styles.rankHeader}>
            <span className={styles.rankBadge} style={{ background: rank.color }}>
              {rank.name}
            </span>
            <span className={styles.cardCount}>{cardCount} cards</span>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${Math.min(progress, 100)}%`, background: rank.color }}
            />
          </div>
          <div className={styles.rankFooter}>
            {nextRank ? (
              <span className={styles.nextRank}>
                Next: <strong style={{ color: nextRank.color }}>{nextRank.name}</strong> (あと{nextRank.min - cardCount}枚)
              </span>
            ) : (
              <span className={styles.nextRank}>MAX RANK!</span>
            )}
          </div>
          <div className={styles.allRanks}>
            {RANKS.map((r) => (
              <span
                key={r.name}
                className={styles.rankDot}
                style={{
                  background: cardCount >= r.min ? r.color : '#e2e8f0',
                  color: cardCount >= r.min ? 'white' : '#94a3b8',
                }}
              >
                {r.name}
              </span>
            ))}
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
