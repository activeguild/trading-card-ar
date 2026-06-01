import { useCallback, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ApiError } from '../lib/api'
import { Loading } from '../components/Loading'
import styles from './CardRegisterPage.module.css'

export function CardRegisterPage() {
  const { id: collectionId } = useParams<{ id: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const [preview, setPreview] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  const handleFile = useCallback(
    async (f: File) => {
      setPreview(URL.createObjectURL(f))
      setProcessing(true)
      setError('')
      try {
        const form = new FormData()
        form.append('file', f)
        const res = await fetch(`/api/cards/register/${collectionId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        })
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new ApiError(res.status, body?.detail ?? `Error: ${res.status}`)
        }
        navigate(`/collections/${collectionId}`)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Processing failed')
      } finally {
        setProcessing(false)
      }
    },
    [token, collectionId, navigate],
  )

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) handleFile(f)
    },
    [handleFile],
  )

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Add Card</h2>

      {preview ? (
        <div className={styles.previewArea}>
          <img src={preview} alt="Preview" className={styles.preview} />
        </div>
      ) : (
        <div className={styles.buttonGroup}>
          <button
            className={styles.cameraBtn}
            onClick={() => cameraRef.current?.click()}
          >
            Take Photo
          </button>
          <button
            className={styles.galleryBtn}
            onClick={() => galleryRef.current?.click()}
          >
            Choose from Gallery
          </button>
        </div>
      )}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className={styles.hidden}
        onChange={onFileChange}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className={styles.hidden}
        onChange={onFileChange}
      />
      {processing && <Loading />}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
