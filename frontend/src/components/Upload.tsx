import { useCallback, useRef, useState } from 'react'
import styles from './Upload.module.css'

type Props = {
  onSelect: (file: File) => void
  disabled?: boolean
}

export function Upload({ onSelect, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const handleFile = useCallback(
    (file: File) => {
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(file)
      })
      onSelect(file)
    },
    [onSelect],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  return (
    <div
      className={`${styles.dropzone} ${dragActive ? styles.active : ''}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragActive(true)
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={styles.input}
        onChange={handleChange}
        disabled={disabled}
      />
      {preview ? (
        <img src={preview} alt="Preview" className={styles.preview} />
      ) : (
        <>
          <p className={styles.label}>Drop an image here or click to select</p>
          <p className={styles.sublabel}>JPEG, PNG</p>
        </>
      )}
    </div>
  )
}
