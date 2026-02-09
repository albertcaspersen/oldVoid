import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const picsDir = path.join(__dirname, 'public', 'pics')

// Funktion til at finde alle billedfiler rekursivt
function findImageFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir)
  
  files.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    
    if (stat.isDirectory()) {
      findImageFiles(filePath, fileList)
    } else if (/\.(png|jpg|jpeg)$/i.test(file)) {
      fileList.push(filePath)
    }
  })
  
  return fileList
}

// Funktion til at komprimere et billede
async function compressImage(filePath) {
  try {
    const stats = fs.statSync(filePath)
    const originalSize = stats.size
    const ext = path.extname(filePath).toLowerCase()
    
    let outputBuffer
    
    if (ext === '.png') {
      // Komprimer PNG med optimeret kvalitet
      outputBuffer = await sharp(filePath)
        .png({ 
          quality: 85,
          compressionLevel: 9,
          adaptiveFiltering: true
        })
        .toBuffer()
    } else if (ext === '.jpg' || ext === '.jpeg') {
      // Komprimer JPG med optimeret kvalitet
      outputBuffer = await sharp(filePath)
        .jpeg({ 
          quality: 85,
          mozjpeg: true
        })
        .toBuffer()
    }
    
    const newSize = outputBuffer.length
    const savings = ((1 - newSize / originalSize) * 100).toFixed(1)
    
    // Gem det komprimerede billede
    fs.writeFileSync(filePath, outputBuffer)
    
    return { originalSize, newSize, savings }
  } catch (error) {
    console.error(`Fejl ved komprimering af ${filePath}:`, error.message)
    return null
  }
}

// Hovedfunktion
async function main() {
  const imageFiles = findImageFiles(picsDir)
  
  let totalOriginalSize = 0
  let totalNewSize = 0
  
  for (const filePath of imageFiles) {
    const result = await compressImage(filePath)
    if (result) {
      totalOriginalSize += result.originalSize
      totalNewSize += result.newSize
    }
  }
}

main().catch(console.error)
