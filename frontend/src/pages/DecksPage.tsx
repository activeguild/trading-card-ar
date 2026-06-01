import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiJson } from '../lib/api'
import styles from './DecksPage.module.css'

type DeckItem = {
  id: number
  name: string
  card_count: number
}

export function DecksPage() {
  const { token } = useAuth()
  const [decks, setDecks] = useState<DeckItem[]>([])
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')

  const load = useCallback(async () => {
    const data = await apiJson<DeckItem[]>('/api/decks', token)
    setDecks(data)
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    await apiJson('/api/decks', token, {
      method: 'POST',
      body: JSON.stringify({ name: newName.trim() }),
      headers: { 'Content-Type': 'application/json' },
    })
    setNewName('')
    setShowModal(false)
    load()
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Decks</h2>
        <button className={styles.addBtn} onClick={() => setShowModal(true)}>
          + New
        </button>
      </div>
      {decks.length === 0 ? (
        <p className={styles.empty}>No decks yet</p>
      ) : (
        <div className={styles.list}>
          {decks.map((d) => (
            <Link key={d.id} to={`/decks/${d.id}`} className={styles.card}>
              <span className={styles.cardName}>{d.name}</span>
              <span className={styles.cardCount}>{d.card_count}/5 cards</span>
            </Link>
          ))}
        </div>
      )}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <form
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreate}
          >
            <h3 className={styles.modalTitle}>New Deck</h3>
            <input
              className={styles.modalInput}
              placeholder="Deck name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <div className={styles.modalActions}>
              <button type="button" className={styles.modalCancel} onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="submit" className={styles.modalSubmit}>Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
