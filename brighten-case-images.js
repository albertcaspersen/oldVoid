import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const casesPicsDir = path.join(__dirname, 'public', 'pics', 'casesPics')

// Filer der SKAL springes over (har allerede hvid lys baggrund)
const SKIP_FILES = [
  'Our-Landscape-Designs-Oxshott-Garden-Plan-Ourlandscapedesigns.com_-min-min.png',
  'Our-Landscape-Designs-garden-design-designer-Ourlandscapedesigns.com-copy-min-min.jpg'
]

async function brightenImage(filePath, ext) {
  try {
    let pipeline = sharp(filePath)
      .modulate({
        brightness: 1.2,
        saturation: 1.0
      })
      .gamma(1.1)

    if (ext === '.png') {
      pipeline = pipeline.png({
        quality: 100,
        compressionLevel: 1,
        adaptiveFiltering: true,
        palette: false
      })
    } else if (ext === '.jpg' || ext === '.jpeg') {
      pipeline = pipeline.jpeg({
        quality: 95
      })
    }

    const outputBuffer = await pipeline.toBuffer()
    fs.writeFileSync(filePath, outputBuffer)
    return { success: true }
  } catch (error) {
    console.error(`  ✗ Fejl:`, error.message)
    return { success: false, error: error.message }
  }
}

async function main() {
  const files = fs.readdirSync(casesPicsDir)
  const imageFiles = files.filter(f => {
    const ext = path.extname(f).toLowerCase()
    return ['.png', '.jpg', '.jpeg'].includes(ext) && !SKIP_FILES.includes(f)
  })

  console.log(`Lyser op ${imageFiles.length} billeder (springer ${SKIP_FILES.length} over)...`)

  let successCount = 0
  for (const file of imageFiles) {
    const filePath = path.join(casesPicsDir, file)
    const ext = path.extname(file).toLowerCase()
    process.stdout.write(`  ${file}... `)
    const result = await brightenImage(filePath, ext)
    if (result.success) {
      successCount++
      console.log('✓')
    }
  }

  console.log(`\nFærdig: ${successCount}/${imageFiles.length} billeder lyset op`)
}

main().catch(console.error)
