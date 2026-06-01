import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiJson, apiFetch } from '../lib/api'
import { QRModal } from '../components/QRModal'
import styles from './DeckDetailPage.module.css'

type CardInDeck = {
  id: number
  card_id: number
  position: number
  corrected_url: string
  effect_url: string | null
}

type DeckDetail = {
  id: number
  name: string
  cards: CardInDeck[]
}

type PickableCard = {
  id: number
  corrected_url: string
}

export function DeckDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()
  const [deck, setDeck] = useState<DeckDetail | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [pickCards, setPickCards] = useState<PickableCard[]>([])
  const [showQR, setShowQR] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    const data = await apiJson<DeckDetail>(`/api/decks/${id}`, token)
    setDeck(data)
  }, [id, token])

  useEffect(() => {
    load()
  }, [load])

  const openPicker = async () => {
    const collections = await apiJson<{ id: number }[]>('/api/collections', token)
    const allCards: PickableCard[] = []
    for (const col of collections) {
      const cards = await apiJson<PickableCard[]>(
        `/api/cards/by-collection/${col.id}`,
        token,
      )
      allCards.push(...cards)
    }
    const deckCardIds = new Set(deck?.cards.map((c) => c.card_id) ?? [])
    setPickCards(allCards.filter((c) => !deckCardIds.has(c.id)))
    setShowPicker(true)
  }

  const handleAdd = async (cardId: number) => {
    if (!id) return
    await apiJson(`/api/decks/${id}/cards`, token, {
      method: 'POST',
      body: JSON.stringify({ card_id: cardId }),
      headers: { 'Content-Type': 'application/json' },
    })
    setShowPicker(false)
    load()
  }

  const handleRemove = async (deckCardId: number) => {
    if (!id) return
    await apiFetch(`/api/decks/${id}/cards/${deckCardId}`, token, {
      method: 'DELETE',
    })
    load()
  }

  const handleDeleteDeck = async () => {
    if (!deck || !confirm('Delete this deck?')) return
    await apiFetch(`/api/decks/${deck.id}`, token, { method: 'DELETE' })
    navigate('/decks')
  }

  if (!deck) return null

  const arUrl = `${window.location.origin}/ar/deck/${deck.id}`

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>{deck.name}</h2>
        <div className={styles.actions}>
          {deck.cards.length > 0 && (
            <>
              <Link to={`/ar/deck/${deck.id}`} className={styles.arBtn}>
                AR
              </Link>
              <button className={styles.qrBtn} onClick={() => setShowQR(true)}>
                QR
              </button>
            </>
          )}
          {deck.cards.length < 5 && (
            <button className={styles.addBtn} onClick={openPicker}>
              + Add
            </button>
          )}
        </div>
      </div>
      {deck.cards.length === 0 ? (
        <p className={styles.empty}>No cards in this deck</p>
      ) : (
        <div className={styles.grid}>
          {deck.cards.map((c) => (
            <div key={c.id} className={styles.card}>
              <button
                className={styles.removeBtn}
                onClick={() => handleRemove(c.id)}
              >
                x
              </button>
              <img
                src={c.corrected_url}
                alt={`Card ${c.card_id}`}
                className={styles.cardImage}
              />
            </div>
          ))}
        </div>
      )}
      <button className={styles.deleteBtn} onClick={handleDeleteDeck}>
        Delete Deck
      </button>
      {showPicker && (
        <div className={styles.modalOverlay} onClick={() => setShowPicker(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Add Card to Deck</h3>
            {pickCards.length === 0 ? (
              <p>No cards available</p>
            ) : (
              pickCards.map((c) => (
                <div
                  key={c.id}
                  className={styles.pickItem}
                  onClick={() => handleAdd(c.id)}
                >
                  <img
                    src={c.corrected_url}
                    alt={`Card ${c.id}`}
                    className={styles.pickThumb}
                  />
                </div>
              ))
            )}
            <button
              className={styles.modalClose}
              onClick={() => setShowPicker(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {showQR && <QRModal url={arUrl} onClose={() => setShowQR(false)} />}
    </div>
  )
}
