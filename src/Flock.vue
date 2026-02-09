<script setup>
import { onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'

const props = defineProps({
  scene: {
    type: Object,
    required: true
  }
})

// ============================================
// MURMURATION - Ægte stære-flok simulation
// ============================================

let birds = []
let birdTexture = null
const birdCount = 250 // Flere fugle for bedre murmuration-effekt

// Boids parametre - tunet til murmuration
const perceptionRadius = 12 // Hvor langt en fugl kan "se" (øget for bedre flocking)
const separationRadius = 2.0 // Minimum afstand mellem fugle (øget for bedre spredning)
const maxSpeed = 0.07 // Maksimal hastighed
const minSpeed = 0.02 // Minimum hastighed (fugle stopper aldrig helt)
const maxForce = 0.005 // Maksimal steering kraft

// Murmuration-specifik
let flockTime = 0
let wanderTarget = new THREE.Vector3(0, 4, 0) // Flokkens mål-punkt der bevæger sig (centrum af planen)
let wanderAngle = 0

// Form-skabende parametre - skaber flydende former som ægte stære
let currentShape = 0 // 0 = flydende, 1 = bølge, 2 = drejning, 3 = strøm
let shapeTransitionTime = 0
const shapeDuration = 15 // Sekunder før form skifter
let secondaryTarget = new THREE.Vector3(0, 5, 0) // Sekundært mål (centrum af planen)

// Vægte for boids-kræfter
const weights = {
  separation: 2.5, // Øget for mere dramatisk spredning
  alignment: 1.2,
  cohesion: 2.0, // Øget for mere dramatisk samling
  wander: 0.2,
  boundary: 1.0,
  shape: 0.12 // Form-skabende kraft
}

// Scene boundaries - matcher planens størrelse (75x75)
const bounds = {
  x: 37.5, // Planen går fra -37.5 til +37.5
  y: { min: 1.5, max: 12 },
  z: 37.5 // Planen går fra -37.5 til +37.5
}

// Opret fugle texture (lille elegant fugle-silhuet)
const createBirdTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')
  
  // Tegn en simpel fugle-silhuet
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath()
  // Krop
  ctx.ellipse(16, 16, 10, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  // Vinger
  ctx.beginPath()
  ctx.moveTo(16, 16)
  ctx.lineTo(8, 10)
  ctx.lineTo(12, 16)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(16, 16)
  ctx.lineTo(8, 22)
  ctx.lineTo(12, 16)
  ctx.closePath()
  ctx.fill()
  
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

// Hjælpefunktion: Begræns vektor til maksimal længde
const limit = (vec, max) => {
  const lengthSq = vec.lengthSq()
  if (lengthSq > max * max) {
    vec.divideScalar(Math.sqrt(lengthSq)).multiplyScalar(max)
  }
  return vec
}

// Hjælpefunktion: Steering kraft mod et mål
const steerTowards = (bird, target) => {
  const desired = new THREE.Vector3().subVectors(target, bird.position)
  desired.normalize().multiplyScalar(maxSpeed)
  const steer = new THREE.Vector3().subVectors(desired, bird.velocity)
  limit(steer, maxForce)
  return steer
}

// Opret alle fugle
const createBirds = () => {
  birdTexture = createBirdTexture()
  
  // Start alle fugle i en klump for naturlig flok-dannelse - i midten af planen
  const startCenter = new THREE.Vector3(0, 4, 0) // Centrum af planen
  const startSpread = 8 // Lidt større spredning så de kan bruge hele området
  
  for (let i = 0; i < birdCount; i++) {
    // Sfærisk fordeling omkring centrum
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = Math.random() * startSpread
    
    const position = new THREE.Vector3(
      startCenter.x + r * Math.sin(phi) * Math.cos(theta),
      startCenter.y + r * Math.sin(phi) * Math.sin(theta) * 0.5, // Fladtrykt i Y
      startCenter.z + r * Math.cos(phi)
    )
    
    // Start med tilfældig retning
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5),
      (Math.random() - 0.5) * 0.3,
      (Math.random() - 0.5)
    ).normalize().multiplyScalar(maxSpeed * 0.5)
    
    // Opret sprite med individuel material for opacity variation
    const birdMaterial = new THREE.SpriteMaterial({
      map: birdTexture,
      transparent: true,
      opacity: 0.75 + Math.random() * 0.25,
      color: new THREE.Color().setHSL(0, 0, 0.02 + Math.random() * 0.08)
    })
    
    const sprite = new THREE.Sprite(birdMaterial)
    const baseSize = 0.2 + Math.random() * 0.1 // Mindre fugle
    sprite.scale.set(baseSize, baseSize, 1)
    sprite.position.copy(position)
    
    props.scene.add(sprite)
    
    birds.push({
      position: position,
      velocity: velocity,
      acceleration: new THREE.Vector3(0, 0, 0),
      sprite: sprite,
      baseSize: baseSize,
      // Individuelle variationer for mere organisk bevægelse
      noiseOffset: Math.random() * 1000,
      turnBias: (Math.random() - 0.5) * 0.002 // Lille tendens til at dreje
    })
  }
}

// Spatial hashing for effektiv nabo-søgning
const getCellKey = (x, y, z, cellSize) => {
  return `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)},${Math.floor(z / cellSize)}`
}

const buildSpatialHash = (cellSize) => {
  const hash = {}
  birds.forEach((bird, index) => {
    const key = getCellKey(bird.position.x, bird.position.y, bird.position.z, cellSize)
    if (!hash[key]) hash[key] = []
    hash[key].push(index)
  })
  return hash
}

const getNearbyBirds = (bird, hash, cellSize) => {
  const nearby = []
  const cx = Math.floor(bird.position.x / cellSize)
  const cy = Math.floor(bird.position.y / cellSize)
  const cz = Math.floor(bird.position.z / cellSize)
  
  // Check 3x3x3 celler omkring fuglen
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = `${cx + dx},${cy + dy},${cz + dz}`
        if (hash[key]) {
          nearby.push(...hash[key])
        }
      }
    }
  }
  return nearby
}

// Opdater wander target og skab forskellige former
const updateWanderTarget = () => {
  wanderAngle += 0.002 + Math.sin(flockTime * 0.3) * 0.001
  
  // Skift form periodisk
  shapeTransitionTime += 0.016
  if (shapeTransitionTime > shapeDuration) {
    shapeTransitionTime = 0
    currentShape = (currentShape + 1) % 4
  }
  
  const baseZ = 0 // Centrum af planen (planen går fra -37.5 til +37.5)
  const baseY = 4
  const maxRadius = 30 // Maksimal radius for at bruge hele planen
  
  switch (currentShape) {
    case 0: // FLYDENDE BÅND - langstrakt form der glider gennem luften
      const ribbonLength = maxRadius * 0.7 + Math.sin(flockTime * 0.15) * maxRadius * 0.3
      const ribbonCurve = Math.sin(flockTime * 0.1) * 0.5
      wanderTarget.x = Math.cos(wanderAngle) * ribbonLength + Math.sin(wanderAngle * 2) * maxRadius * 0.2
      wanderTarget.y = baseY + Math.sin(flockTime * 0.12) * 2.5 + ribbonCurve
      wanderTarget.z = baseZ + Math.sin(wanderAngle * 0.8) * ribbonLength * 0.6
      break
      
    case 1: // BØLGENDE STRØM - flokken bølger som en flod i luften
      const waveLength = maxRadius * 0.8
      const waveHeight = Math.sin(flockTime * 0.2) * 2
      wanderTarget.x = Math.sin(flockTime * 0.15) * waveLength
      wanderTarget.y = baseY + waveHeight + Math.cos(flockTime * 0.18) * 1.5
      wanderTarget.z = baseZ + Math.cos(flockTime * 0.12) * waveLength * 0.6
      break
      
    case 2: // DREJENDE SPIRAL - langsom rotation der strækker flokken
      const spiralRadius = maxRadius * 0.6 + Math.sin(flockTime * 0.1) * maxRadius * 0.2
      wanderTarget.x = Math.cos(wanderAngle * 0.8) * spiralRadius
      wanderTarget.y = baseY + Math.sin(flockTime * 0.15) * 2
      wanderTarget.z = baseZ + Math.sin(wanderAngle * 0.8) * spiralRadius * 0.7
      break
      
    case 3: // GLIDENDE KURVE - S-formet bevægelse
      const curveAmplitude = maxRadius * 0.7
      const curvePhase = flockTime * 0.1
      wanderTarget.x = Math.sin(curvePhase) * curveAmplitude
      wanderTarget.y = baseY + Math.cos(curvePhase * 1.5) * 2
      wanderTarget.z = baseZ + Math.cos(curvePhase * 0.7) * curveAmplitude * 0.5
      break
  }
}

// Beregn form-kraft for en fugl (skaber flydende former som ægte stære)
const getShapeForce = (bird, index) => {
  const force = new THREE.Vector3()
  
  switch (currentShape) {
    case 0: // FLYDENDE BÅND - fugle i kanten af flokken trækkes med
      // Tilføj en lille tangentiel kraft for at skabe bånd-effekt
      const toBandCenter = new THREE.Vector3().subVectors(wanderTarget, bird.position)
      toBandCenter.y *= 0.3 // Reducer vertikal påvirkning
      const tangent = new THREE.Vector3(-toBandCenter.z, 0, toBandCenter.x).normalize()
      force.add(tangent.multiplyScalar(0.0008))
      break
      
    case 2: // DREJENDE SPIRAL - langsom rotation
      const toSpiral = new THREE.Vector3().subVectors(wanderTarget, bird.position)
      toSpiral.y = 0
      const spiralTangent = new THREE.Vector3(-toSpiral.z, 0, toSpiral.x).normalize()
      force.add(spiralTangent.multiplyScalar(0.0006))
      break
  }
  
  // Tilføj bølge-effekt der går gennem flokken (skaber levende bevægelse)
  const wavePhase = flockTime * 0.4 + bird.position.x * 0.08 + bird.position.z * 0.04
  force.y += Math.sin(wavePhase) * 0.0005
  
  // Horisontal bølge for mere organisk bevægelse
  const hWavePhase = flockTime * 0.3 + bird.position.z * 0.06
  force.x += Math.sin(hWavePhase) * 0.0003
  
  return force
}

// Hovedopdatering af fugleflok
const updateBirds = () => {
  if (birds.length === 0) return
  
  flockTime += 0.016
  updateWanderTarget()
  
  // Byg spatial hash for effektiv nabo-søgning
  const spatialHash = buildSpatialHash(perceptionRadius)
  
  // Beregn dynamiske vægte - REALISTISK stære-adfærd
  // Ægte stære samles IKKE i en kugle - de laver flydende, langstrakte former
  
  // Langsom variation der ændrer flokkens tæthed (men aldrig ekstrem)
  const densityPulse = Math.sin(flockTime * 0.15) * 0.3 + 0.7 // 0.4 til 1.0 - altid moderat
  
  // Cohesion holder flokken sammen men ikke for tæt
  const dynamicCohesion = weights.cohesion * (0.8 + densityPulse * 0.4) // 0.8 til 1.2 - moderat variation
  
  // Separation holder fuglene fra at kollidere men tillader tæthed
  const dynamicSeparation = weights.separation * (0.9 + (1 - densityPulse) * 0.3) // 0.9 til 1.2 - moderat
  
  // STRÆKNINGS-EFFEKT: Flokken strækker sig i en retning (som ægte murmurations)
  const stretchDirection = new THREE.Vector3(
    Math.cos(flockTime * 0.08),
    Math.sin(flockTime * 0.05) * 0.3,
    Math.sin(flockTime * 0.08)
  ).normalize()
  
  // Strækningsstyrke varierer over tid
  const stretchAmount = Math.sin(flockTime * 0.1) * 0.5 + 0.5 // 0 til 1
  
  birds.forEach((bird, index) => {
    // Nulstil acceleration
    bird.acceleration.set(0, 0, 0)
    
    // Find naboer effektivt via spatial hash
    const nearbyIndices = getNearbyBirds(bird, spatialHash, perceptionRadius)
    
    // Boids kræfter
    const separation = new THREE.Vector3()
    const alignment = new THREE.Vector3()
    const cohesion = new THREE.Vector3()
    
    let separationCount = 0
    let flockmates = 0
    
    nearbyIndices.forEach((otherIndex) => {
      if (otherIndex === index) return
      
      const other = birds[otherIndex]
      const distance = bird.position.distanceTo(other.position)
      
      // Separation - undgå kollision
      if (distance > 0 && distance < separationRadius) {
        const diff = new THREE.Vector3().subVectors(bird.position, other.position)
        diff.normalize()
        diff.divideScalar(distance) // Stærkere når tættere
        separation.add(diff)
        separationCount++
      }
      
      // Alignment og Cohesion inden for perception radius
      if (distance > 0 && distance < perceptionRadius) {
        alignment.add(other.velocity)
        cohesion.add(other.position)
        flockmates++
      }
    })
    
    // Beregn steering kræfter
    if (separationCount > 0) {
      separation.divideScalar(separationCount)
      separation.normalize().multiplyScalar(maxSpeed)
      separation.sub(bird.velocity)
      limit(separation, maxForce * 2) // Stærkere separation
    }
    
    if (flockmates > 0) {
      // Alignment: Flyv i samme retning som naboer
      alignment.divideScalar(flockmates)
      alignment.normalize().multiplyScalar(maxSpeed)
      alignment.sub(bird.velocity)
      limit(alignment, maxForce)
      
      // Cohesion: Flyv mod flokkens centrum
      cohesion.divideScalar(flockmates)
      const cohesionSteer = steerTowards(bird, cohesion)
      cohesion.copy(cohesionSteer)
    }
    
    // Wander: Følg det bevægelige mål-punkt
    const wanderSteer = steerTowards(bird, wanderTarget)
    
    // Boundary steering (blød afvisning fra kanter)
    const boundary = new THREE.Vector3()
    const margin = 5 // Mindre margin så fuglene kan bruge mere af planen
    
    if (bird.position.x > bounds.x - margin) {
      boundary.x = -((bird.position.x - (bounds.x - margin)) / margin)
    } else if (bird.position.x < -bounds.x + margin) {
      boundary.x = -(bird.position.x - (-bounds.x + margin)) / margin
    }
    
    if (bird.position.y > bounds.y.max - margin) {
      boundary.y = -((bird.position.y - (bounds.y.max - margin)) / margin)
    } else if (bird.position.y < bounds.y.min + margin * 0.5) {
      boundary.y = -(bird.position.y - (bounds.y.min + margin * 0.5)) / (margin * 0.5)
    }
    
    if (bird.position.z > bounds.z - margin) {
      boundary.z = -((bird.position.z - (bounds.z - margin)) / margin)
    } else if (bird.position.z < -bounds.z + margin) {
      boundary.z = -(bird.position.z - (-bounds.z + margin)) / margin
    }
    
    boundary.multiplyScalar(maxForce * weights.boundary)
    
    // Tilføj alle kræfter
    bird.acceleration.addScaledVector(separation, dynamicSeparation)
    bird.acceleration.addScaledVector(alignment, weights.alignment)
    bird.acceleration.addScaledVector(cohesion, dynamicCohesion)
    bird.acceleration.addScaledVector(wanderSteer, weights.wander)
    bird.acceleration.add(boundary)
    
    // Tilføj form-kraft (skaber interessante former)
    const shapeForce = getShapeForce(bird, index)
    bird.acceleration.addScaledVector(shapeForce, weights.shape)
    
    // STRÆKNINGS-KRAFT: Få flokken til at strække sig i en retning (som ægte stære)
    // Fugle i "front" af strækningen accelererer, fugle i "bag" bremser lidt
    const posAlongStretch = bird.position.dot(stretchDirection)
    const stretchForce = stretchDirection.clone().multiplyScalar(
      Math.sign(posAlongStretch) * stretchAmount * 0.001
    )
    bird.acceleration.add(stretchForce)
    
    // Tilføj individuel variation (noise)
    const noiseX = Math.sin(flockTime * 2 + bird.noiseOffset) * 0.001
    const noiseY = Math.cos(flockTime * 1.5 + bird.noiseOffset * 1.3) * 0.0005
    const noiseZ = Math.sin(flockTime * 1.8 + bird.noiseOffset * 0.7) * 0.001
    bird.acceleration.x += noiseX + bird.turnBias
    bird.acceleration.y += noiseY
    bird.acceleration.z += noiseZ
    
    // Opdater velocity
    bird.velocity.add(bird.acceleration)
    
    // Begræns hastighed (men hold minimum hastighed)
    const speed = bird.velocity.length()
    if (speed > maxSpeed) {
      bird.velocity.multiplyScalar(maxSpeed / speed)
    } else if (speed < minSpeed) {
      bird.velocity.multiplyScalar(minSpeed / speed)
    }
    
    // Opdater position
    bird.position.add(bird.velocity)
    
    // Hård boundary (bare i tilfælde af)
    bird.position.x = Math.max(-bounds.x, Math.min(bounds.x, bird.position.x))
    bird.position.y = Math.max(bounds.y.min, Math.min(bounds.y.max, bird.position.y))
    bird.position.z = Math.max(-bounds.z, Math.min(bounds.z, bird.position.z))
    
    // Opdater sprite
    bird.sprite.position.copy(bird.position)
    
    // Roter sprite mod flyveretning
    if (speed > 0.01) {
      const angleZ = Math.atan2(bird.velocity.x, bird.velocity.z)
      bird.sprite.material.rotation = -angleZ + Math.PI / 2
    }
    
    // Dybde-baseret størrelse (fugle længere væk er mindre)
    // Antager kamera er ved z = 0 eller positiv z
    const depthScale = Math.max(0.5, Math.min(1.5, 1 + bird.position.z * 0.005))
    const finalSize = bird.baseSize * depthScale
    bird.sprite.scale.set(finalSize, finalSize, 1)
  })
}

// Expose update function
defineExpose({
  update: updateBirds
})

onMounted(() => {
  createBirds()
})

onUnmounted(() => {
  // Cleanup birds
  birds.forEach((bird) => {
    if (bird.sprite) {
      props.scene.remove(bird.sprite)
      if (bird.sprite.material) {
        bird.sprite.material.dispose()
      }
    }
  })
  birds = []
  if (birdTexture) {
    birdTexture.dispose()
  }
})
</script>

<template>
  <!-- Flock component - no template needed -->
</template>
