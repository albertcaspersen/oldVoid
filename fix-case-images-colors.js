import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const casesPicsDir = path.join(__dirname, 'public', 'pics', 'casesPics')

// Funktion til at forbedre farverne på et billede
async function fixImageColors(filePath) {
  try {
    console.log(`Forbedrer farver: ${path.basename(filePath)}`)
    
    // Læs billedet og juster farverne
    const outputBuffer = await sharp(filePath)
      .modulate({
        brightness: 0.75, // Mørkere (1.0 = ingen ændring, <1.0 = mørkere)
        saturation: 1.2, // Mere mættet (1.0 = ingen ændring, >1.0 = mere mættet)
        hue: 0 // Ingen hue ændring
      })
      .gamma(1.2) // Juster gamma for bedre kontrast
      .png({
        quality: 100,
        compressionLevel: 1,
        adaptiveFiltering: true,
        palette: false,
        effort: 10
      })
      .toBuffer()
    
    // Gem det forbedrede billede
    fs.writeFileSync(filePath, outputBuffer)
    
    console.log(`  ✓ Færdig`)
    
    return { success: true }
  } catch (error) {
    console.error(`  ✗ Fejl:`, error.message)
    return { success: false, error: error.message }
  }
}

// Hovedfunktion
async function main() {
  console.log('=== Forbedrer farver på cases billeder ===\n')
  
  const files = fs.readdirSync(casesPicsDir)
  const pngFiles = files.filter(f => f.toLowerCase().endsWith('.png'))
  
  console.log(`Fundet ${pngFiles.length} PNG filer\n`)
  
  let successCount = 0
  let failCount = 0
  
  for (const file of pngFiles) {
    const filePath = path.join(casesPicsDir, file)
    const result = await fixImageColors(filePath)
    if (result.success) {
      successCount++
    } else {
      failCount++
    }
  }
  
  console.log(`\n=== Færdig ===`)
  console.log(`Succes: ${successCount}`)
  console.log(`Fejl: ${failCount}`)
  console.log(`\nBemærk: Hvis farverne stadig ikke ser korrekte ud, kan du justere værdierne i scriptet:`)
  console.log(`- brightness: 0.85 (lavere = mørkere)`)
  console.log(`- saturation: 1.15 (højere = mere mættet)`)
  console.log(`- gamma: 1.1 (højere = mere kontrast)`)
}

main().catch(console.error)
