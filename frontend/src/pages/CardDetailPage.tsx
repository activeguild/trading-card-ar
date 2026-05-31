import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiJson, apiFetch } from '../lib/api'
import styles from './CardDetailPage.module.css'

type CardDetail = {
  id: number
  collection_id: number
  name: string
  corrected_url: string
  effect_url: string | null
}

export function CardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()
  const [card, setCard] = useState<CardDetail | null>(null)

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

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>{card.name}</h2>
      <div className={styles.imageWrapper}>
        <img
          src={card.corrected_url}
          alt={card.name}
          className={styles.image}
        />
      </div>
      <div className={styles.actions}>
        {card.effect_url ? (
          <div className={styles.effectBadge}>Effect Applied</div>
        ) : (
          <Link to={`/cards/${card.id}/effect`} className={styles.effectBtn}>
            Add Effect
          </Link>
        )}
        <button className={styles.deleteBtn} onClick={handleDelete}>
          Delete Card
        </button>
      </div>
    </div>
  )
}
