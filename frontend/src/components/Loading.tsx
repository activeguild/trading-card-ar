import styles from './Loading.module.css'

export function Loading() {
  return (
    <div className={styles.overlay}>
      <div className={styles.spinner} />
      <p className={styles.text}>Processing...</p>
    </div>
  )
}
