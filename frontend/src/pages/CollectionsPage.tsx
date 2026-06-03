import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiJson } from '../lib/api'
import styles from './CollectionsPage.module.css'

type Collection = {
  id: number
  name: string
  card_count: number
  created_at: string
}

export function CollectionsPage() {
  const { token } = useAuth()
  const [collections, setCollections] = useState<Collection[]>([])
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()
  const [newName, setNewName] = useState('')

  const load = useCallback(async () => {
    const data = await apiJson<Collection[]>('/api/collections', token)
    setCollections(data)
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    const created = await apiJson<Collection>('/api/collections', token, {
      method: 'POST',
      body: JSON.stringify({ name: newName.trim() }),
      headers: { 'Content-Type': 'application/json' },
    })
    setNewName('')
    setShowModal(false)
    navigate(`/collections/${created.id}`)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Collections</h2>
        <button className={styles.addBtn} onClick={() => setShowModal(true)}>
          + New
        </button>
      </div>
      {collections.length === 0 ? (
        <p className={styles.empty}>No collections yet</p>
      ) : (
        <div className={styles.list}>
          {collections.map((c) => (
            <Link
              key={c.id}
              to={`/collections/${c.id}`}
              className={styles.card}
            >
              <span className={styles.cardName}>{c.name}</span>
              <span className={styles.cardCount}>{c.card_count} cards</span>
            </Link>
          ))}
        </div>
      )}
      {showModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowModal(false)}
        >
          <form
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreate}
          >
            <h3 className={styles.modalTitle}>New Collection</h3>
            <input
              className={styles.modalInput}
              placeholder="Collection name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className={styles.modalSubmit}>
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
