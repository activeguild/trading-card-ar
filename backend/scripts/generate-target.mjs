#!/usr/bin/env node
/**
 * Generate 8thwall image target from a card image.
 * Usage: node generate-target.mjs <input-image> <output-dir> <name>
 *
 * Uses @8thwall/image-target-cli's applyCrop directly.
 */
import { applyCrop } from '@8thwall/image-target-cli/src/apply.js'
import sharp from 'sharp'

const [,, inputPath, outputDir, name] = process.argv

if (!inputPath || !outputDir || !name) {
  console.error('Usage: node generate-target.mjs <input-image> <output-dir> <name>')
  process.exit(1)
}

const rawImage = sharp(inputPath)
const metadata = await rawImage.metadata()

const crop = {
  type: 'PLANAR',
  geometry: {
    top: 0,
    left: 0,
    width: metadata.width,
    height: metadata.height,
    isRotated: false,
    originalWidth: metadata.width,
    originalHeight: metadata.height,
  },
}

await applyCrop(rawImage, crop, outputDir, name, true)
console.log(JSON.stringify({ ok: true, name }))
