import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  EighthwallCanvas,
  EighthwallCamera,
  ImageTracker,
} from '@j1ngzoue/8thwall-react-three-fiber'
import { CardPlane } from '../components/CardPlane'
import { EffectShaderPlane } from '../components/EffectShaderPlane'
import type { EffectSettings } from '../lib/effectRenderer'
import * as THREE from 'three'
import styles from './DeckARViewerPage.module.css'

type ApiEffectSettings = {
  hologram: boolean
  neon: boolean
  glow: boolean
  glow_color: [number, number, number]
}

type ARDeckCard = {
  id: number
  marker_url: string
  target_url: string
  effect_url: string | null
  effect_settings: ApiEffectSettings | null
}

type ARDeckData = {
  id: number
  name: string
  cards: ARDeckCard[]
}

function toEffectSettings(api: ApiEffectSettings): EffectSettings {
  return {
    hologram: api.hologram,
    neon: api.neon,
    glow: api.glow,
    glowColor: api.glow_color,
  }
}

export function DeckARViewerPage() {
  const { id } = useParams<{ id: string }>()
  const [deck, setDeck] = useState<ARDeckData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    fetch(`/api/ar/deck/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Deck not found')
        return res.json()
      })
      .then((data) => setDeck(data))
      .catch((e) => setError(e.message))
  }, [id])

  if (error) {
    return <div className={styles.loading}>{error}</div>
  }

  if (!deck) {
    return <div className={styles.loading}>Loading AR...</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.deckName}>{deck.name}</div>
      <EighthwallCanvas
        xrSrc="/xr.js"
        autoStart={true}
        disableWorldTracking={true}
        style={{ width: '100%', height: '100%' }}
        gl={{ toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
      >
        <EighthwallCamera />
        {deck.cards.map((card) => {
          const effectSettings = card.effect_settings ? toEffectSettings(card.effect_settings) : null
          return (
            <ImageTracker key={card.id} targetImage={card.target_url}>
              <CardPlane src={card.marker_url} width={590} height={860} />
              {effectSettings && (
                <EffectShaderPlane
                  cardImageUrl={card.marker_url}
                  settings={effectSettings}
                  width={590}
                  height={860}
                />
              )}
            </ImageTracker>
          )
        })}
        <ambientLight intensity={1} />
      </EighthwallCanvas>
    </div>
  )
}
