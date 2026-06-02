import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import styles from './TopPage.module.css'

export function TopPage() {
  const navigate = useNavigate()
  const { token } = useAuth()

  const handleStart = () => {
    if (token) {
      navigate('/collections')
    } else {
      navigate('/login')
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.heroWrapper}>
        <img
          src="/top-hero.webp"
          alt="トレカAR - カードをかざせば、ARがはじまる。"
          className={styles.heroImage}
        />
      </div>
      <div className={styles.bottomBar}>
        <button className={styles.startButton} onClick={handleStart}>
          はじめる
        </button>
      </div>
    </div>
  )
}
