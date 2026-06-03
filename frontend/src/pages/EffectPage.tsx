import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiJson } from '../lib/api'
import {
  type EffectData,
  type EffectSettings,
  prepareEffectData,
  renderFrame,
} from '../lib/effectRenderer'
import { Loading } from '../components/Loading'
import styles from './EffectPage.module.css'

type ApiEffectSettings = {
  hologram: boolean
  neon: boolean
  glow: boolean
  glow_color: [number, number, number]
}

type CardInfo = {
  id: number
  collection_id: number
  corrected_url: string
  effect_settings: ApiEffectSettings | null
}

const GLOW_COLORS = [
  { label: 'Purple', value: '#a855f7', rgb: [0.66, 0.33, 0.97] as [number, number, number] },
  { label: 'Cyan', value: '#06b6d4', rgb: [0.02, 0.71, 0.83] as [number, number, number] },
  { label: 'Pink', value: '#ec4899', rgb: [0.93, 0.28, 0.6] as [number, number, number] },
  { label: 'Green', value: '#22c55e', rgb: [0.13, 0.77, 0.37] as [number, number, number] },
  { label: 'Gold', value: '#eab308', rgb: [0.92, 0.70, 0.03] as [number, number, number] },
  { label: 'White', value: '#ffffff', rgb: [1, 1, 1] as [number, number, number] },
]

function findGlowColorIdx(rgb: [number, number, number] | undefined): number {
  if (!rgb) return 0
  return GLOW_COLORS.findIndex(
    (c) => Math.abs(c.rgb[0] - rgb[0]) < 0.01 && Math.abs(c.rgb[1] - rgb[1]) < 0.01 && Math.abs(c.rgb[2] - rgb[2]) < 0.01,
  ) ?? 0
}

export function EffectPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(0)

  const [card, setCard] = useState<CardInfo | null>(null)
  const [effectData, setEffectData] = useState<EffectData | null>(null)
  const [hologram, setHologram] = useState(true)
  const [neon, setNeon] = useState(true)
  const [glow, setGlow] = useState(true)
  const [glowColorIdx, setGlowColorIdx] = useState(0)
  const [saving, setSaving] = useState(false)

  // Load card data and restore settings
  useEffect(() => {
    if (!id) return
    apiJson<CardInfo>(`/api/cards/${id}`, token).then((data) => {
      setCard(data)
      if (data.effect_settings) {
        setHologram(data.effect_settings.hologram)
        setNeon(data.effect_settings.neon)
        setGlow(data.effect_settings.glow)
        setGlowColorIdx(findGlowColorIdx(data.effect_settings.glow_color))
      }
    })
  }, [id, token])

  // Prepare effect data when card image loads
  useEffect(() => {
    if (!card) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setEffectData(prepareEffectData(img))
    img.src = card.corrected_url
  }, [card])

  // Animation loop
  const settings: EffectSettings = {
    hologram,
    neon,
    glow,
    glowColor: GLOW_COLORS[glowColorIdx].rgb,
  }
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => {
    if (!effectData || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    canvas.width = effectData.totalWidth
    canvas.height = effectData.totalHeight
    startRef.current = performance.now()

    const loop = () => {
      const t = ((performance.now() - startRef.current) / 1000) % 8
      renderFrame(ctx, effectData, t, settingsRef.current)
      rafRef.current = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(rafRef.current)
  }, [effectData])

  // Save settings to server
  const handleSave = useCallback(async () => {
    if (!id || !token) return
    setSaving(true)
    try {
      await apiJson(`/api/cards/${id}/effect-settings`, token, {
        method: 'POST',
        body: JSON.stringify({
          hologram,
          neon,
          glow,
          glow_color: GLOW_COLORS[glowColorIdx].rgb,
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      navigate(`/cards/${id}`)
    } catch (e) {
      console.error('Save failed:', e)
      alert('Save failed')
    } finally {
      setSaving(false)
    }
  }, [id, token, hologram, neon, glow, glowColorIdx, navigate])

  if (!card || !effectData) return <Loading />

  return (
    <div className={styles.page}>
      <canvas
        ref={canvasRef}
        className={styles.preview}
      />

      <div className={styles.controls}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={hologram}
            onChange={(e) => setHologram(e.target.checked)}
          />
          <span className={styles.toggleLabel}>Hologram</span>
        </label>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={neon}
            onChange={(e) => setNeon(e.target.checked)}
          />
          <span className={styles.toggleLabel}>Neon</span>
        </label>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={glow}
            onChange={(e) => setGlow(e.target.checked)}
          />
          <span className={styles.toggleLabel}>Glow</span>
        </label>
      </div>

      {glow && (
        <div className={styles.colorPicker}>
          <p className={styles.colorLabel}>Glow Color</p>
          <div className={styles.colorOptions}>
            {GLOW_COLORS.map((c, i) => (
              <button
                key={c.value}
                className={`${styles.colorBtn} ${i === glowColorIdx ? styles.colorBtnActive : ''}`}
                style={{ background: c.value, border: c.value === '#ffffff' ? '2px solid #cbd5e1' : 'none' }}
                onClick={() => setGlowColorIdx(i)}
              />
            ))}
          </div>
        </div>
      )}

      <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Effect'}
      </button>
    </div>
  )
}
