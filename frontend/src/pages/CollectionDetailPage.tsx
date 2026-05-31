import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiJson } from '../lib/api'
import styles from './CollectionDetailPage.module.css'

type CardItem = {
  id: number
  name: string
  corrected_url: string
}

type CollectionInfo = {
  id: number
  name: string
}

export function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const [collection, setCollection] = useState<CollectionInfo | null>(null)
  const [cards, setCards] = useState<CardItem[]>([])

  const load = useCallback(async () => {
    if (!id) return
    const [col, cardList] = await Promise.all([
      apiJson<CollectionInfo>(`/api/collections/${id}`, token),
      apiJson<CardItem[]>(`/api/cards/by-collection/${id}`, token),
    ])
    setCollection(col)
    setCards(cardList)
  }, [id, token])

  useEffect(() => {
    load()
  }, [load])

  if (!collection) return null

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>{collection.name}</h2>
        <Link
          to={`/collections/${id}/register`}
          className={styles.addBtn}
        >
          + Add Card
        </Link>
      </div>
      {cards.length === 0 ? (
        <p className={styles.empty}>No cards yet</p>
      ) : (
        <div className={styles.grid}>
          {cards.map((card) => (
            <Link
              key={card.id}
              to={`/cards/${card.id}`}
              className={styles.card}
            >
              <img
                src={card.corrected_url}
                alt={card.name}
                className={styles.cardImage}
              />
              <span className={styles.cardName}>{card.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
