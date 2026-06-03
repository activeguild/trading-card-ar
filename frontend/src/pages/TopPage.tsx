import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import styles from './TopPage.module.css'

export function TopPage() {
  const navigate = useNavigate()
  const { token } = useAuth()

  const handleStart = () => {
    if (token) {
      navigate('/home')
    } else {
      navigate('/login')
    }
  }

  return (
    <div className={styles.page}>
      <img
        src="/top-hero.webp"
        alt="トレカAR - カードをかざせば、ARがはじまる。"
        className={styles.heroImage}
      />
      <button className={styles.startButton} onClick={handleStart}>
        はじめる
      </button>
    </div>
  )
}
