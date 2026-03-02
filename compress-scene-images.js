/**
 * Komprimerer scene-billeder med lossy PNG (palette) til -min versioner.
 * Kør: node compress-scene-images.js
 */
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const picsDir = path.join(__dirname, 'public', 'pics')

// Scene-billeder fra Void.vue imageConfig (de største først)
const SCENE_IMAGES = [
  'NYlandscape2.png',
  'NYslutbillede.png',
  'NYbænkogtræ.png',
  'NYlandingTræ2.png',
  'NYcypressVedslutning.png',
  'NYportFarve.png',
  'NYhydrangeaGate.png',
  'NYcypresBlyant3.png',
  'NYport.png',
  'NYfontaine.png',
  'NYdobbelBusk.png',
  'NYcypressFarve2.png',
  'NYcypressBlyant.png',
  'image 503.png',
  'NYcypresFarve1.png',
  'NYcypressBlyant2.png',
  'træPot.png',
  'NYgammeltTræ.png',
  'NYBuskmedBlomst.png',
  'NYlandingVenstreTræ.png',
]

async function compressImage(filePath) {
  try {
    const stats = fs.statSync(filePath)
    const originalSize = stats.size
    const dir = path.dirname(filePath)
    const base = path.basename(filePath, '.png')
    const outputPath = path.join(dir, `${base}-min.png`)

    // Skip hvis -min allerede findes og er nyere (så vi ikke overskriver manuelle komprimeringer)
    const outputBuffer = await sharp(filePath)
      .png({
        palette: true,
        quality: 80,
        compressionLevel: 9,
        effort: 10,
      })
      .toBuffer()

    const newSize = outputBuffer.length
    const savings = ((1 - newSize / originalSize) * 100).toFixed(1)

    fs.writeFileSync(outputPath, outputBuffer)

    return {
      file: path.basename(filePath),
      originalSize,
      newSize,
      savings,
      outputPath,
    }
  } catch (error) {
    console.error(`Fejl ved ${filePath}:`, error.message)
    return null
  }
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

async function main() {
  console.log('Komprimerer scene-billeder...\n')

  let totalOriginal = 0
  let totalNew = 0

  for (const filename of SCENE_IMAGES) {
    const filePath = path.join(picsDir, filename)
    if (!fs.existsSync(filePath)) {
      console.log(`⏭️  ${filename} – findes ikke, springer over`)
      continue
    }

    const result = await compressImage(filePath)
    if (result) {
      totalOriginal += result.originalSize
      totalNew += result.newSize
      console.log(
        `✅ ${result.file}\n   ${formatSize(result.originalSize)} → ${formatSize(result.newSize)} (${result.savings}% mindre)`
      )
    }
  }

  console.log('\n' + '─'.repeat(50))
  console.log(
    `Total: ${formatSize(totalOriginal)} → ${formatSize(totalNew)} (${((1 - totalNew / totalOriginal) * 100).toFixed(1)}% mindre)`
  )
  console.log('\nBrug -min.png filerne i Void.vue for at spare båndbredde.')
}

main().catch(console.error)
