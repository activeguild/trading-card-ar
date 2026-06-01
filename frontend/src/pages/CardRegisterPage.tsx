import { FormEvent, useCallback, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ApiError } from '../lib/api'
import { Loading } from '../components/Loading'
import styles from './CardRegisterPage.module.css'

type RegisterResult = {
  id: number
  name: string
  corrected_url: string
}

export function CardRegisterPage() {
  const { id: collectionId } = useParams<{ id: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<RegisterResult | null>(null)
  const [name, setName] = useState('')
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setError('')
  }, [])

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) handleFile(f)
    },
    [handleFile],
  )

  const handleUpload = useCallback(async () => {
    if (!file || !token) return
    setProcessing(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/cards/register/${collectionId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new ApiError(res.status, body?.detail ?? `Error: ${res.status}`)
      }
      const data: RegisterResult = await res.json()
      setResult(data)
      setName(data.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Processing failed')
    } finally {
      setProcessing(false)
    }
  }, [file, token, collectionId])

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!result || !token) return
    setSaving(true)
    try {
      await fetch(`/api/cards/${result.id}?name=${encodeURIComponent(name)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      navigate(`/collections/${collectionId}`)
    } catch {
      setError('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Add Card</h2>

      {!result && (
        <>
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
          {file && !processing && (
            <button className={styles.button} onClick={handleUpload}>
              Process Card
            </button>
          )}
        </>
      )}

      {result && (
        <form className={styles.form} onSubmit={handleSave}>
          <img
            src={result.corrected_url}
            alt="Corrected"
            className={styles.correctedPreview}
          />
          <div>
            <p className={styles.label}>Card Name</p>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button
            className={styles.button}
            type="submit"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Card'}
          </button>
        </form>
      )}
    </div>
  )
}
