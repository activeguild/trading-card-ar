import styles from './HomePage.module.css'

export function HomePage() {
  return (
    <div className={styles.page}>
      <p className={styles.message}>Select a tab below to get started.</p>
    </div>
  )
}
