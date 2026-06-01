import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  EighthwallCanvas,
  EighthwallCamera,
  ImageTracker,
} from '@j1ngzoue/8thwall-react-three-fiber'
import { TransparentVideo } from '../components/TransparentVideo'
import styles from './ARViewerPage.module.css'

type ARCardData = {
  id: number
  name: string
  marker_url: string
  target_url: string
  effect_url: string | null
}

export function ARViewerPage() {
  const { id } = useParams<{ id: string }>()
  const [card, setCard] = useState<ARCardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    fetch(`/api/ar/card/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Card not found')
        return res.json()
      })
      .then((data) => setCard(data))
      .catch((e) => setError(e.message))
  }, [id])

  if (error) {
    return <div className={styles.loading}>{error}</div>
  }

  if (!card) {
    return <div className={styles.loading}>Loading AR...</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.cardName}>{card.name}</div>
      <EighthwallCanvas
        xrSrc="/xr.js"
        autoStart={true}
        disableWorldTracking={true}
        style={{ width: '100%', height: '100%' }}
      >
        <EighthwallCamera />
        <ImageTracker targetImage={card.target_url}>
          {card.effect_url && (
            <TransparentVideo
              src={card.effect_url}
              width={590}
              height={860}
            />
          )}
        </ImageTracker>
        <ambientLight intensity={1} />
      </EighthwallCanvas>
    </div>
  )
}
