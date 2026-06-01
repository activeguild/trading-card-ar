#!/usr/bin/env node
/**
 * Generate 8thwall image target from a card image.
 * Usage: node generate-target.mjs <input-image> <output-dir> <name>
 *
 * Based on 8thwall-react-three-fiber/example/generate-target.mjs
 */
import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'

const THUMBNAIL_HEIGHT = 350
const LUMINANCE_HEIGHT = 640

const [,, inputPath, outputDir, name, baseUrl] = process.argv

if (!inputPath || !outputDir || !name) {
  console.error('Usage: node generate-target.mjs <input-image> <output-dir> <name> [base-url]')
  process.exit(1)
}

const rawImage = sharp(inputPath)
const meta = await rawImage.metadata()
const { width, height } = meta

const geometry = {
  top: 0,
  left: 0,
  width,
  height,
  isRotated: false,
  originalWidth: width,
  originalHeight: height,
}

const resources = {
  croppedImage: `${name}_cropped.jpeg`,
  thumbnailImage: `${name}_thumbnail.jpeg`,
  luminanceImage: `${name}_luminance.jpeg`,
}

// imagePath: absolute URL path from page root, or relative filename
const luminancePath = baseUrl
  ? `${baseUrl}/${resources.luminanceImage}`
  : resources.luminanceImage
const data = {
  imagePath: luminancePath,
  name,
  type: 'PLANAR',
  properties: geometry,
  resources,
  userMetadataIsJson: true,
  loadAutomatically: false,
  created: Date.now(),
  updated: Date.now(),
}

await fs.mkdir(outputDir, { recursive: true })

const croppedImage = rawImage.clone().extract({
  left: geometry.left,
  top: geometry.top,
  width: geometry.width,
  height: geometry.height,
})

await Promise.all([
  croppedImage.clone().toFile(path.join(outputDir, resources.croppedImage)),
  croppedImage.clone().resize({ height: THUMBNAIL_HEIGHT }).toFile(path.join(outputDir, resources.thumbnailImage)),
  croppedImage.clone().resize({ height: LUMINANCE_HEIGHT }).grayscale().toFile(path.join(outputDir, resources.luminanceImage)),
  fs.writeFile(path.join(outputDir, `${name}.json`), JSON.stringify(data, null, 2) + '\n'),
])

console.log(JSON.stringify({ ok: true, name }))
