import { QRCodeSVG } from 'qrcode.react'
import styles from './QRModal.module.css'

type Props = {
  url: string
  onClose: () => void
}

export function QRModal({ url, onClose }: Props) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>Scan to view AR</h3>
        <div className={styles.qrWrapper}>
          <QRCodeSVG value={url} size={200} />
        </div>
        <p className={styles.hint}>Scan this QR code with your phone camera</p>
        <button className={styles.closeBtn} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
