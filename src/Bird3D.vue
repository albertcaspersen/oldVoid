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
// 3D FUGLE - 7 simple fugle omkring camera-pathen
// ============================================

let birds = []

// Delt vinge-geometri og materiale (genbruges af alle fugle)
let sharedWingGeom = null
let sharedWingMat = null

// Fugle-konfigurationer: individuelle baner omkring pathen
// Pathen går ca. fra z=32 til z=-32, x bølger ±8 omkring 0
const birdConfigs = [
  {
    // Fugl 1: Cirkler i den øvre del af pathen (z = 10..25)
    centerX: 3, centerZ: 18, radiusX: 8, radiusZ: 6,
    baseY: 2.5, yAmplitude: 0.8,
    speed: 0.0018, phase: 0,
    size: 0.25, flapOffset: 0
  },
  {
    // Fugl 2: Cirkler i midten af pathen (z = -5..10)
    centerX: -2, centerZ: 3, radiusX: 10, radiusZ: 7,
    baseY: 3.0, yAmplitude: 0.8,
    speed: 0.0015, phase: Math.PI * 0.5,
    size: 0.2, flapOffset: 1.5
  },
  {
    // Fugl 3: Cirkler i den nedre del (z = -20..-5)
    centerX: 4, centerZ: -12, radiusX: 7, radiusZ: 5,
    baseY: 2.8, yAmplitude: 0.8,
    speed: 0.0020, phase: Math.PI,
    size: 0.22, flapOffset: 3.0
  },
  {
    // Fugl 4: Bred bane der krydser hele scenen
    centerX: -1, centerZ: 5, radiusX: 14, radiusZ: 12,
    baseY: 3.5, yAmplitude: 1.0,
    speed: 0.0012, phase: Math.PI * 1.5,
    size: 0.18, flapOffset: 4.5
  },
  {
    // Fugl 5: Cirkler vest for pathen (x < 0)
    centerX: -8, centerZ: 8, radiusX: 5, radiusZ: 6,
    baseY: 2.2, yAmplitude: 0.6,
    speed: 0.0022, phase: Math.PI * 0.25,
    size: 0.19, flapOffset: 5.2
  },
  {
    // Fugl 6: Øst for pathen, højere oppe
    centerX: 9, centerZ: -8, radiusX: 6, radiusZ: 8,
    baseY: 3.8, yAmplitude: 0.7,
    speed: 0.0014, phase: Math.PI * 0.75,
    size: 0.21, flapOffset: 6.0
  },
  {
    // Fugl 7: Langsom bane nær kamera-pathen
    centerX: 0, centerZ: -5, radiusX: 9, radiusZ: 6,
    baseY: 2.6, yAmplitude: 0.9,
    speed: 0.0010, phase: Math.PI * 1.2,
    size: 0.17, flapOffset: 2.2
  }
]

const createSharedResources = () => {
  // Én trekant-geometri deles af alle vinger
  sharedWingGeom = new THREE.BufferGeometry()
  const vertices = new Float32Array([
    0, 0, 0.06,    // Forreste spids (ved kroppen)
    0.3, 0, 0,     // Ydre vingespids
    0, 0, -0.06    // Bageste spids (ved kroppen)
  ])
  sharedWingGeom.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  sharedWingGeom.computeVertexNormals()

  // Ét materiale deles af alle
  sharedWingMat = new THREE.MeshBasicMaterial({
    color: 0x1a1a1a,
    side: THREE.DoubleSide
  })
}

const createBird = (config) => {
  const group = new THREE.Group()
  const body = new THREE.Group()
  group.add(body)

  // Venstre vinge
  const leftWing = new THREE.Group()
  const leftMesh = new THREE.Mesh(sharedWingGeom, sharedWingMat)
  leftMesh.scale.x = -1
  leftWing.add(leftMesh)
  body.add(leftWing)

  // Højre vinge
  const rightWing = new THREE.Group()
  const rightMesh = new THREE.Mesh(sharedWingGeom, sharedWingMat)
  rightWing.add(rightMesh)
  body.add(rightWing)

  // Skaler fuglen
  group.scale.setScalar(config.size)

  props.scene.add(group)

  return {
    group,
    body,
    leftWing,
    rightWing,
    config,
    flightTime: config.phase,  // Start ved individuel fase
    wingFlapTime: config.flapOffset,
    bankAngle: 0,
    isSoaring: false,
    soaringTimer: Math.random() * 5, // Tilfældig start for variation
    soaringDuration: 2.5 + Math.random() * 2,   // 2.5-4.5 sek gliding
    flappingDuration: 4 + Math.random() * 3      // 4-7 sek flappen
  }
}

// Beregn flyveposition for en fugl baseret på dens config
const getFlightPosition = (t, config) => {
  const x = config.centerX + Math.sin(t) * config.radiusX + Math.sin(t * 2.1) * 2
  const z = config.centerZ + Math.cos(t * 0.7) * config.radiusZ + Math.cos(t * 1.4) * 2.5
  const y = config.baseY + Math.sin(t * 1.3) * config.yAmplitude + Math.cos(t * 0.8) * 0.5

  return new THREE.Vector3(x, y, z)
}

// Opdater alle fugle
const updateBirds = () => {
  birds.forEach((bird) => {
    bird.flightTime += bird.config.speed

    const currentT = bird.flightTime
    const nextT = currentT + 0.02
    const prevT = currentT - 0.02

    const currentPos = getFlightPosition(currentT, bird.config)
    const nextPos = getFlightPosition(nextT, bird.config)
    const prevPos = getFlightPosition(prevT, bird.config)

    // Position
    bird.group.position.copy(currentPos)

    // Flyveretning
    const direction = new THREE.Vector3().subVectors(nextPos, currentPos).normalize()

    // Rotation mod flyveretning
    bird.body.rotation.y = Math.atan2(direction.x, direction.z)

    // Pitch
    const pitch = Math.asin(Math.max(-0.5, Math.min(0.5, -direction.y)))
    bird.body.rotation.x = pitch * 0.5

    // Bank i sving
    const prevDir = new THREE.Vector3().subVectors(currentPos, prevPos).normalize()
    const cross = prevDir.x * direction.z - prevDir.z * direction.x
    const targetBank = -cross * 25
    bird.bankAngle += (targetBank - bird.bankAngle) * 0.08
    bird.body.rotation.z = Math.max(-0.6, Math.min(0.6, bird.bankAngle))

    // Vinge-animation: skift mellem flap og glide
    bird.soaringTimer += 0.016
    if (bird.isSoaring && bird.soaringTimer > bird.soaringDuration) {
      bird.isSoaring = false
      bird.soaringTimer = 0
    } else if (!bird.isSoaring && bird.soaringTimer > bird.flappingDuration) {
      bird.isSoaring = true
      bird.soaringTimer = 0
    }

    if (bird.isSoaring) {
      const glideWave = Math.sin(bird.flightTime * 2) * 0.05
      bird.leftWing.rotation.z = 0.1 + glideWave
      bird.rightWing.rotation.z = -0.1 - glideWave
    } else {
      bird.wingFlapTime += 4.5 * 0.016
      const flapAngle = Math.sin(bird.wingFlapTime * Math.PI * 2) * 0.7
      bird.leftWing.rotation.z = flapAngle + 0.1
      bird.rightWing.rotation.z = -flapAngle - 0.1
    }
  })
}

// Expose update function
defineExpose({
  update: updateBirds
})

onMounted(() => {
  createSharedResources()
  birdConfigs.forEach((config) => {
    birds.push(createBird(config))
  })
})

onUnmounted(() => {
  birds.forEach((bird) => {
    bird.group.traverse((child) => {
      if (child.isMesh) {
        // Geometri og materiale disposes separat da de er delt
      }
    })
    props.scene.remove(bird.group)
  })
  birds = []

  if (sharedWingGeom) sharedWingGeom.dispose()
  if (sharedWingMat) sharedWingMat.dispose()
  sharedWingGeom = null
  sharedWingMat = null
})
</script>

<template>
  <!-- Bird3D component - no template needed -->
</template>
