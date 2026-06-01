import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiJson } from '../lib/api'
import { Loading } from '../components/Loading'
import { EffectPreview } from '../components/EffectPreview'
import styles from './EffectPage.module.css'

type EffectPreset = {
  id: string
  name: string
  description: string
}

type CardInfo = {
  id: number
  collection_id: number
  corrected_url: string
  effect_url: string | null
}

type GenerateResult = {
  effect_url: string
}

export function EffectPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()

  const [card, setCard] = useState<CardInfo | null>(null)
  const [effects, setEffects] = useState<EffectPreset[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [effectUrl, setEffectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([
      apiJson<CardInfo>(`/api/cards/${id}`, token),
      apiJson<EffectPreset[]>('/api/effects', token),
    ]).then(([c, e]) => {
      setCard(c)
      setEffects(e)
      if (e.length > 0) setSelected(e[0].id)
      if (c.effect_url) setEffectUrl(c.effect_url)
    })
  }, [id, token])

  const handleGenerate = useCallback(async () => {
    if (!selected || !id) return
    setGenerating(true)
    setError('')
    try {
      const result = await apiJson<GenerateResult>(`/api/cards/${id}/effect`, token, {
        method: 'POST',
        body: JSON.stringify({ effect_id: selected }),
        headers: { 'Content-Type': 'application/json' },
      })
      setEffectUrl(result.effect_url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }, [selected, id, token])

  if (!card) return null

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Add Effect</h2>

      {effectUrl ? (
        <div className={styles.previewSection}>
          <EffectPreview cardSrc={card.corrected_url} effectSrc={effectUrl} />
          <p className={styles.success}>Effect applied!</p>
          <button
            className={styles.doneBtn}
            onClick={() => navigate(`/cards/${id}`)}
          >
            Done
          </button>
        </div>
      ) : (
        <>
          <img
            src={card.corrected_url}
            alt="Card"
            className={styles.cardPreview}
          />
          <p className={styles.subtitle}>Select Effect</p>
          <div className={styles.effectList}>
            {effects.map((e) => (
              <div
                key={e.id}
                className={`${styles.effectCard} ${selected === e.id ? styles.effectCardSelected : ''}`}
                onClick={() => setSelected(e.id)}
              >
                <p className={styles.effectName}>{e.name}</p>
                <p className={styles.effectDesc}>{e.description}</p>
              </div>
            ))}
          </div>
          {error && <p className={styles.error}>{error}</p>}
          {generating && <Loading />}
          {!generating && (
            <button
              className={styles.generateBtn}
              onClick={handleGenerate}
              disabled={!selected}
            >
              Generate Effect
            </button>
          )}
        </>
      )}
    </div>
  )
}
