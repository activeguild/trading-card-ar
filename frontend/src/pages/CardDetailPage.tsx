import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiJson, apiFetch } from '../lib/api'
import { QRModal } from '../components/QRModal'
import { EffectPreviewCanvas } from '../components/EffectPreviewCanvas'
import type { EffectSettings } from '../lib/effectRenderer'
import styles from './CardDetailPage.module.css'

type ApiEffectSettings = {
  hologram: boolean
  neon: boolean
  glow: boolean
  glow_color: [number, number, number]
}

type CardDetail = {
  id: number
  collection_id: number
  corrected_url: string
  effect_url: string | null
  effect_settings: ApiEffectSettings | null
}

function toEffectSettings(api: ApiEffectSettings): EffectSettings {
  return {
    hologram: api.hologram,
    neon: api.neon,
    glow: api.glow,
    glowColor: api.glow_color,
  }
}

export function CardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()
  const [card, setCard] = useState<CardDetail | null>(null)
  const [showQR, setShowQR] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    const data = await apiJson<CardDetail>(`/api/cards/${id}`, token)
    setCard(data)
  }, [id, token])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async () => {
    if (!card || !confirm('Delete this card?')) return
    await apiFetch(`/api/cards/${card.id}`, token, { method: 'DELETE' })
    navigate(`/collections/${card.collection_id}`)
  }

  if (!card) return null

  const arUrl = `${window.location.origin}/ar/card/${card.id}`
  const hasEffect = !!card.effect_settings

  return (
    <div className={styles.page}>
      <div className={styles.imageWrapper}>
        {hasEffect ? (
          <EffectPreviewCanvas
            cardImageUrl={card.corrected_url}
            settings={toEffectSettings(card.effect_settings!)}
            className={styles.effectCanvas}
          />
        ) : (
          <img
            src={card.corrected_url}
            alt={`Card ${card.id}`}
            className={styles.image}
          />
        )}
      </div>
      <div className={styles.actions}>
        {hasEffect ? (
          <>
            <Link to={`/cards/${card.id}/effect`} className={styles.effectBtn}>
              Edit Effect
            </Link>
            <Link to={`/ar/card/${card.id}`} className={styles.arBtn}>
              AR Preview
            </Link>
            <button
              className={styles.qrBtn}
              onClick={() => setShowQR(true)}
            >
              Share QR
            </button>
          </>
        ) : (
          <Link to={`/cards/${card.id}/effect`} className={styles.effectBtn}>
            Add Effect
          </Link>
        )}
        <button className={styles.deleteBtn} onClick={handleDelete}>
          Delete Card
        </button>
      </div>
      {showQR && <QRModal url={arUrl} onClose={() => setShowQR(false)} />}
    </div>
  )
}
