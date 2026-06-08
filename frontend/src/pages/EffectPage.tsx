import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiJson } from '../lib/api'
import { useCardEffectRenderer, type RendererConfig } from '../lib/useCardEffectRenderer'
import {
  EFFECT_LIST,
  TRANSITION_LIST,
  PACK_LIST,
  PACK_IMAGE_MAP,
  type EffectName,
  type EffectSettings,
  type TransitionName,
  type PackType,
} from '../lib/shaders/index'
import { Loading } from '../components/Loading'
import styles from './EffectPage.module.css'

type CardInfo = {
  id: number
  collection_id: number
  corrected_url: string
  effect_settings: EffectSettings | null
}

export function EffectPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [card, setCard] = useState<CardInfo | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [transition, setTransition] = useState<TransitionName | null>(null)
  const [borderEffect, setBorderEffect] = useState<EffectName | null>(null)
  const [innerEffect, setInnerEffect] = useState<EffectName | null>(null)
  const [packType, setPackType] = useState<PackType>('normal')
  const [saving, setSaving] = useState(false)

  // Load card data
  useEffect(() => {
    if (!id) return
    apiJson<CardInfo>(`/api/cards/${id}`, token).then((data) => {
      setCard(data)
      if (data.effect_settings) {
        setTransition(data.effect_settings.transition ?? null)
        setBorderEffect(data.effect_settings.borderEffect ?? null)
        setInnerEffect(data.effect_settings.innerEffect ?? null)
        setPackType(data.effect_settings.packType ?? 'normal')
      }
    })
  }, [id, token])

  // Load image
  useEffect(() => {
    if (!card) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setImage(img)
    img.src = card.corrected_url
  }, [card])

  // Pack overlay state: -1=hidden, 0~1=transition progress
  const [packProgress, setPackProgress] = useState(-1)

  // Renderer config
  const config: RendererConfig = { transition, borderEffect, innerEffect, packType }
  const { reset } = useCardEffectRenderer(canvasRef, image, config, setPackProgress)

  const packVisible = transition !== null && packProgress >= 0 && packProgress < 1

  // Save
  const handleSave = useCallback(async () => {
    if (!id || !token) return
    setSaving(true)
    try {
      const settings: EffectSettings = { transition, borderEffect, innerEffect, packType }
      await apiJson(`/api/cards/${id}/effect-settings`, token, {
        method: 'POST',
        body: JSON.stringify(settings),
        headers: { 'Content-Type': 'application/json' },
      })
      navigate(`/cards/${id}`)
    } catch (e) {
      console.error('Save failed:', e)
      alert('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }, [id, token, transition, borderEffect, innerEffect, packType, navigate])

  if (!card || !image) return <Loading />

  const packDisabled = transition === null

  return (
    <div className={styles.page}>
      <div className={styles.previewArea}>
        <div className={styles.previewContainer}>
          <canvas ref={canvasRef} className={styles.preview} />
          {packVisible && (
            <img
              src={PACK_IMAGE_MAP[packType]}
              alt="Pack"
              className={styles.packOverlay}
              style={{ opacity: 1 - packProgress }}
            />
          )}
        </div>
        <button className={styles.resetBtn} onClick={reset}>&#8635;</button>
      </div>

      {/* Transition selector */}
      <div className={styles.selectorGroup}>
        <p className={styles.selectorLabel}>トランジション</p>
        <div className={styles.selectorScroll}>
          <button
            className={`${styles.chip} ${transition === null ? styles.chipActive : ''}`}
            onClick={() => setTransition(null)}
          >
            なし
          </button>
          {TRANSITION_LIST.map((t) => (
            <button
              key={t.key}
              className={`${styles.chip} ${transition === t.key ? styles.chipActive : ''}`}
              onClick={() => setTransition(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pack selector */}
      <div className={`${styles.selectorGroup} ${packDisabled ? styles.selectorDisabled : ''}`}>
        <p className={styles.selectorLabel}>パック</p>
        <div className={styles.selectorScroll}>
          {PACK_LIST.map((p) => (
            <button
              key={p.key}
              className={`${styles.chip} ${packType === p.key ? styles.chipActive : ''}`}
              onClick={() => !packDisabled && setPackType(p.key)}
              disabled={packDisabled}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Border effect selector */}
      <div className={styles.selectorGroup}>
        <p className={styles.selectorLabel}>枠エフェクト</p>
        <div className={styles.selectorScroll}>
          <button
            className={`${styles.chip} ${borderEffect === null ? styles.chipActive : ''}`}
            onClick={() => setBorderEffect(null)}
          >
            なし
          </button>
          {EFFECT_LIST.map((e) => (
            <button
              key={e.key}
              className={`${styles.chip} ${borderEffect === e.key ? styles.chipActive : ''}`}
              onClick={() => setBorderEffect(e.key)}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inner effect selector */}
      <div className={styles.selectorGroup}>
        <p className={styles.selectorLabel}>枠内エフェクト</p>
        <div className={styles.selectorScroll}>
          <button
            className={`${styles.chip} ${innerEffect === null ? styles.chipActive : ''}`}
            onClick={() => setInnerEffect(null)}
          >
            なし
          </button>
          {EFFECT_LIST.map((e) => (
            <button
              key={e.key}
              className={`${styles.chip} ${innerEffect === e.key ? styles.chipActive : ''}`}
              onClick={() => setInnerEffect(e.key)}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
        {saving ? '保存中...' : 'エフェクトを保存'}
      </button>
    </div>
  )
}
