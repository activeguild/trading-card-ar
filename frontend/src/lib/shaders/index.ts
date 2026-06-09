// Shader index - maps effect/transition names to GLSL fragment shaders

// Effects (looping border/overlay effects)
import { hologramShader } from './effects/hologram'
import { glowShader } from './effects/glow'
import { diamondShader } from './effects/diamond'
import { cellophaneShader } from './effects/cellophane'
import { meteorShader } from './effects/meteor'
import { glitchShader } from './effects/glitch'
import { neonShader } from './effects/neon'
import { rgbSplitShader } from './effects/rgbSplit'
import { waveShader } from './effects/wave'
import { energyShader } from './effects/energy'
import { sparkleShader } from './effects/sparkle'
import { scanShader } from './effects/scan'
import { bokehShader } from './effects/bokeh'
import { heartbeatShader } from './effects/heartbeat'
import { matrixShader } from './effects/matrix'
import { heartsShader } from './effects/hearts'
import { rippleShader } from './effects/ripple'
import { radianceShader } from './effects/radiance'
import { dustShader } from './effects/dust'

// Transitions (one-shot animations)
import { slideShader } from './transitions/slide'
import { slideVShader } from './transitions/slideV'
import { vortexShader } from './transitions/vortex'
import { fadeOutShader } from './transitions/fadeOut'
import { wipeRightShader } from './transitions/wipeRight'
import { wipeDownShader } from './transitions/wipeDown'
import { circleCloseShader } from './transitions/circleClose'
import { rippleOutShader } from './transitions/rippleOut'
import { dissolveShader } from './transitions/dissolve'
import { blindsShader } from './transitions/blinds'
import { zoomOutShader } from './transitions/zoomOut'
import { pixelateShader } from './transitions/pixelate'
import { diamondWipeShader } from './transitions/diamondWipe'
import { burnShader } from './transitions/burn'
import { glitchTransitionShader } from './transitions/glitchTransition'
import { spiralShader } from './transitions/spiral'
import { curtainShader } from './transitions/curtain'
import { shatterShader } from './transitions/shatter'
import { explodeShader } from './transitions/explode'
import { meltShader } from './transitions/melt'
import { flickerShader } from './transitions/flicker'
import { magicDustShader } from './transitions/magicDust'

export type EffectName =
  | 'hologram' | 'glow' | 'diamond' | 'cellophane' | 'meteor'
  | 'glitch' | 'neon' | 'rgbSplit' | 'wave' | 'energy'
  | 'sparkle' | 'scan' | 'bokeh' | 'heartbeat' | 'matrix'
  | 'hearts' | 'ripple' | 'radiance' | 'dust'

export type TransitionName =
  | 'slide' | 'slideV' | 'vortex' | 'fadeOut' | 'wipeRight'
  | 'wipeDown' | 'circleClose' | 'rippleOut' | 'dissolve' | 'blinds'
  | 'zoomOut' | 'pixelate' | 'diamondWipe' | 'burn' | 'glitchTransition'
  | 'spiral' | 'curtain' | 'shatter' | 'explode' | 'melt'
  | 'flicker' | 'magicDust'

export const EFFECT_SHADERS: Record<EffectName, string> = {
  hologram: hologramShader,
  glow: glowShader,
  diamond: diamondShader,
  cellophane: cellophaneShader,
  meteor: meteorShader,
  glitch: glitchShader,
  neon: neonShader,
  rgbSplit: rgbSplitShader,
  wave: waveShader,
  energy: energyShader,
  sparkle: sparkleShader,
  scan: scanShader,
  bokeh: bokehShader,
  heartbeat: heartbeatShader,
  matrix: matrixShader,
  hearts: heartsShader,
  ripple: rippleShader,
  radiance: radianceShader,
  dust: dustShader,
}

export const TRANSITION_SHADERS: Record<TransitionName, string> = {
  slide: slideShader,
  slideV: slideVShader,
  vortex: vortexShader,
  fadeOut: fadeOutShader,
  wipeRight: wipeRightShader,
  wipeDown: wipeDownShader,
  circleClose: circleCloseShader,
  rippleOut: rippleOutShader,
  dissolve: dissolveShader,
  blinds: blindsShader,
  zoomOut: zoomOutShader,
  pixelate: pixelateShader,
  diamondWipe: diamondWipeShader,
  burn: burnShader,
  glitchTransition: glitchTransitionShader,
  spiral: spiralShader,
  curtain: curtainShader,
  shatter: shatterShader,
  explode: explodeShader,
  melt: meltShader,
  flicker: flickerShader,
  magicDust: magicDustShader,
}

export const EFFECT_LIST: { key: EffectName; label: string }[] = [
  { key: 'hologram', label: 'ホログラム' },
  { key: 'glow', label: 'グロー' },
  { key: 'diamond', label: 'ダイヤモンド' },
  { key: 'cellophane', label: 'セロハン' },
  { key: 'meteor', label: '流星' },
  { key: 'glitch', label: 'グリッチ' },
  { key: 'neon', label: 'ネオン' },
  { key: 'rgbSplit', label: 'RGB分離' },
  { key: 'wave', label: 'ウェーブ' },
  { key: 'energy', label: 'エナジー' },
  { key: 'sparkle', label: 'スパークル' },
  { key: 'scan', label: 'スキャン' },
  { key: 'bokeh', label: 'ボケ' },
  { key: 'heartbeat', label: 'ハートビート' },
  { key: 'matrix', label: 'マトリックス' },
  { key: 'hearts', label: 'ハート' },
  { key: 'ripple', label: 'リップル' },
  { key: 'radiance', label: 'ラディアンス' },
  { key: 'dust', label: 'ダスト' },
]

export const TRANSITION_LIST: { key: TransitionName; label: string }[] = [
  { key: 'slide', label: '横スライド' },
  { key: 'slideV', label: '縦スライド' },
  { key: 'vortex', label: '渦巻き' },
  { key: 'fadeOut', label: 'フェードアウト' },
  { key: 'wipeRight', label: 'ワイプ（右）' },
  { key: 'wipeDown', label: 'ワイプ（下）' },
  { key: 'circleClose', label: 'サークルクローズ' },
  { key: 'rippleOut', label: 'リップル（拡散消失）' },
  { key: 'dissolve', label: 'ディゾルブ' },
  { key: 'blinds', label: 'ブラインド' },
  { key: 'zoomOut', label: 'ズームアウト' },
  { key: 'pixelate', label: 'ピクセル化' },
  { key: 'diamondWipe', label: 'ダイヤワイプ' },
  { key: 'burn', label: 'バーン' },
  { key: 'glitchTransition', label: 'グリッチ消滅' },
  { key: 'spiral', label: 'スパイラル' },
  { key: 'curtain', label: 'カーテン' },
  { key: 'shatter', label: 'シャッター' },
  { key: 'explode', label: '爆散' },
  { key: 'melt', label: 'メルト' },
  { key: 'flicker', label: 'フリッカー' },
  { key: 'magicDust', label: '魔法の粒子' },
]

export type PackType = 'normal' | 'silver' | 'gold' | 'black'

export const PACK_LIST: { key: PackType; label: string }[] = [
  { key: 'normal', label: 'ノーマル' },
  { key: 'silver', label: 'シルバー' },
  { key: 'gold', label: 'ゴールド' },
  { key: 'black', label: 'ブラック' },
]

export const PACK_IMAGE_MAP: Record<PackType, string> = {
  normal: '/pack-normal.png',
  silver: '/pack-silver.png',
  gold: '/pack-gold.png',
  black: '/pack-black.png',
}

export interface EffectSettings {
  transition: TransitionName | null
  borderEffect: EffectName | null
  innerEffect: EffectName | null
  packType: PackType
}
