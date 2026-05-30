import { useCallback, useState } from 'react'
import styles from './App.module.css'
import { Loading } from './components/Loading'
import { ResultView } from './components/ResultView'
import { Upload } from './components/Upload'

type Result = {
  person: string
  background: string
  corrected?: string | null
}

export default function App() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSelect = useCallback(async (file: File) => {
    setLoading(true)
    setResult(null)
    setError(null)

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('/api/segment', { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.detail ?? `Error: ${res.status}`)
      }
      const data: Result = await res.json()
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className={styles.app}>
      <h1 className={styles.heading}>Remove Background</h1>
      <Upload onSelect={handleSelect} disabled={loading} />
      {error && <p className={styles.error}>{error}</p>}
      {loading && <Loading />}
      {result && (
        <>
          <hr className={styles.divider} />
          <ResultView person={result.person} background={result.background} corrected={result.corrected} />
        </>
      )}
    </div>
  )
}
