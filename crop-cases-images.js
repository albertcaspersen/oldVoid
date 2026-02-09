import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const casesPicsDir = path.join(__dirname, 'public', 'pics', 'casesPics')

// Target dimensions (14:9 aspect ratio)
const TARGET_WIDTH = 2800
const TARGET_HEIGHT = 1800

// Funktion til at beskære et billede til center crop
async function cropImage(filePath) {
  try {
    const image = sharp(filePath)
    const metadata = await image.metadata()
    
    const originalAspect = metadata.width / metadata.height
    const targetAspect = TARGET_WIDTH / TARGET_HEIGHT
    
    let cropWidth, cropHeight, left, top
    
    if (originalAspect > targetAspect) {
      // Billedet er bredere end target - beskær fra siderne (center crop)
      cropHeight = metadata.height
      cropWidth = Math.round(cropHeight * targetAspect)
      left = Math.round((metadata.width - cropWidth) / 2)
      top = 0
    } else {
      // Billedet er højere end target - beskær fra top/bund (center crop)
      cropWidth = metadata.width
      cropHeight = Math.round(cropWidth / targetAspect)
      left = 0
      top = Math.round((metadata.height - cropHeight) / 2)
    }
    
    // Først beskær til korrekt aspect ratio (center crop)
    let croppedImage = image.extract({
      left: left,
      top: top,
      width: cropWidth,
      height: cropHeight
    })
    
    // Derefter resize til target størrelse - BARE resize, ikke mas sammen!
    // Vi bruger 'fit: cover' for at sikre at aspect ratio bevares
    const outputBuffer = await croppedImage
      .resize(TARGET_WIDTH, TARGET_HEIGHT, {
        kernel: sharp.kernel.lanczos3, // Bedste kvalitet
        fit: 'cover', // Cover sikrer at aspect ratio bevares - ingen masning!
        position: 'center' // Center crop
      })
      .png({
        quality: 100, // Maksimal kvalitet
        compressionLevel: 1, // Lav komprimering for bedre kvalitet
        adaptiveFiltering: true,
        palette: false, // Bevar alle farver (ikke konverter til palette)
        colors: 256, // Hvis palette bruges, brug maksimalt antal farver
        dither: 0, // Ingen dithering for bedre farver
        effort: 10 // Maksimal effort for bedste kvalitet
      })
      .keepMetadata() // Bevar metadata
      .toColorspace('srgb') // Sikre korrekt farverum
      .toBuffer()
    
    // Gem det beskårne billede
    fs.writeFileSync(filePath, outputBuffer)
    
    return { success: true }
  } catch (error) {
    console.error(`  ✗ Fejl ved beskæring af ${filePath}:`, error.message)
    return { success: false, error: error.message }
  }
}

// Hovedfunktion
async function main() {
  const files = fs.readdirSync(casesPicsDir)
  const pngFiles = files.filter(f => f.toLowerCase().endsWith('.png'))
  
  let successCount = 0
  let failCount = 0
  
  for (const file of pngFiles) {
    const filePath = path.join(casesPicsDir, file)
    const result = await cropImage(filePath)
    if (result.success) {
      successCount++
    } else {
      failCount++
    }
  }
}

main().catch(console.error)
