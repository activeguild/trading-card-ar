import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  EighthwallCanvas,
  EighthwallCamera,
  ImageTracker,
} from '@j1ngzoue/8thwall-react-three-fiber'
import { CardPlane } from '../components/CardPlane'
import { EffectShaderPlane } from '../components/EffectShaderPlane'
import { PackTransitionPlane } from '../components/PackTransitionPlane'
import type { EffectSettings } from '../lib/shaders/index'
import * as THREE from 'three'
import styles from './ARViewerPage.module.css'

type ARCardData = {
  id: number
  marker_url: string
  target_url: string
  effect_url: string | null
  effect_settings: EffectSettings | null
}

export function ARViewerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [card, setCard] = useState<ARCardData | null>(null)
  const [error, setError] = useState('')
  const [arKey, setArKey] = useState(0)

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

  const handleRetry = () => {
    setArKey((k) => k + 1)
  }

  if (error) {
    return (
      <div className={styles.loading}>
        <p>{error}</p>
        <button className={styles.retryBtn} onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    )
  }

  if (!card) {
    return <div className={styles.loading}>Loading AR...</div>
  }

  const hasEffect = card.effect_settings &&
    (card.effect_settings.borderEffect || card.effect_settings.innerEffect)
  const hasTransition = card.effect_settings?.transition != null

  return (
    <div className={styles.container}>
      <button className={styles.closeBtn} onClick={() => navigate(-1)}>
        &times;
      </button>
      <div className={styles.cardName}>AR View</div>
      <button className={styles.retryFloating} onClick={handleRetry}>
        Reload
      </button>
      <EighthwallCanvas
        key={arKey}
        xrSrc="/xr.js"
        autoStart={true}
        disableWorldTracking={true}
        style={{ width: '100%', height: '100%' }}
        gl={{ toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
        onError={() => setError('AR failed to load')}
      >
        <EighthwallCamera />
        <ImageTracker targetImage={card.target_url}>
          <CardPlane src={card.marker_url} width={590} height={860} />
          {hasEffect && (
            <EffectShaderPlane
              cardImageUrl={card.marker_url}
              settings={card.effect_settings!}
              width={590}
              height={860}
            />
          )}
          {hasTransition && (
            <PackTransitionPlane
              transition={card.effect_settings!.transition!}
              packType={card.effect_settings!.packType}
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
