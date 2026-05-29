import styles from './ResultView.module.css'

type Props = {
  person: string
  background: string
}

function download(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

export function ResultView({ person, background }: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <p className={styles.title}>Person</p>
        <div className={styles.imageWrapper}>
          <img src={person} alt="Person" className={styles.image} />
        </div>
        <button
          className={styles.downloadBtn}
          onClick={() => download(person, 'person.png')}
        >
          Download
        </button>
      </div>
      <div className={styles.card}>
        <p className={styles.title}>Background</p>
        <div className={styles.imageWrapper}>
          <img src={background} alt="Background" className={styles.image} />
        </div>
        <button
          className={styles.downloadBtn}
          onClick={() => download(background, 'background.png')}
        >
          Download
        </button>
      </div>
    </div>
  )
}
