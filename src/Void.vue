<script setup>
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { gsap } from 'gsap'
import Flock from './Flock.vue'
import Bird3D from './Bird3D.vue'
import Nav from './Nav.vue'

const router = useRouter()

const containerRef = ref(null)

// Mobile viewport height fix (Chrome browser UI)
const updateVh = () => {
  const vh = window.innerHeight * 0.01
  document.documentElement.style.setProperty('--vh', `${vh}px`)
}

let scene, camera, renderer, plane, paperTexture, bumpTexture, gridHelper
let animationId = null
let handleResize = null
let handleScroll = null // HMR: Gem reference til scroll handler
let pencilLine = null
let pencilLineGroup = null
let penModel = null
let penWipeProgress = 0 // Wipe progress for pen model
let brushModel = null
let brushWipeProgress = 0 // Wipe progress for brush model
let lastEndT = -1 // Gem sidste endT for at undgå unødvendige opdateringer
let scrollProgress = 0
let previousScrollProgress = 0 // Track previous scroll progress to detect backward scrolling
let previousClampedIndex = -1 // Track previous clamped index to detect when scrolling back past trigger points

// Landing page state
// Landing logo vises nu som HTML element (ikke 3D)
let isInLandingPhase = true // Om vi er i landing-fasen (kigger ned på papiret)
const landingScrollThreshold = 0.03 // Hvor meget scroll der skal til før vi forlader landing (ca. 3% af total scroll)
const pathEndPoint = 0.78 // Path slutpunkt (0.78 = stopper ved 78% af pathen)
const cameraStartThreshold = 0.1 // Hvor meget scroll der skal til før kameraet begynder at bevæge sig
let landingCameraPosition = null // Kamera position når vi kigger ned
let landingCameraLookAt = null // Hvor kameraet kigger hen i landing

// Array til at holde alle billeder med deres planes, shadows og progress
let sceneImages = []

// Billede konfigurationer - position, rotation [x, y, z] og billede-sti for alle billeder
const imageConfigs = [
  
  // landingTræ.png - Landing page tree image
  { path: '/pics/landingTræ.png', position: [-8, 3.5, 16], rotation: [0, 1, 0], size: 5, id: 'landingTræ', info: 'Landing tree.' },
  
  // slutbillede.png - placér ved path end (ignoreres ved landing-calc)
  { path: '/pics/slutbillede.png', position: [8.5, 0.95, -23.5], rotation: [0, 0.0, -0.02], size: 4, id: 'slutbillede', ignoreForLanding: true, maxDistance: 12, info: 'Slutbillede ved path end.' },

  // tidligere entry (sketch1)
  { path: '/pics/image 22.png', position: [-6, 2.45, 10], rotation: [0, 1.3, -0.04], size: 8, id: 'sketch1', maxDistance: 25, info: 'Entrance sketch. Hand-drawn sketch of the property facade.' },
  

  { path: '/pics/Gemini_Generated_Image_phek2ephek2ephek 1.png', position: [-6, 2.45, 9.98], rotation: [0, 1.3, -0.04], size: 8, waitFor: 'sketch1', waitForProgress: 0.6, animationLength: 0.10 },
  
  
  // 4 x HøjTræSketch.png
  { path: '/pics/HøjTræSketch.png', position: [1, 2.25, 17], rotation: [0, 0.5, 0], size: 0.6, opacity: 0.1, info: 'Cypress. Originally from the Mediterranean.' },
  { path: '/pics/HøjTræSketch.png', position: [7, 2.25, 17], rotation: [0, 0.5, 0], size: 0.6, info: 'Cypress. Symbolizes eternal life.' },

  
  // højtTræ2.png
  { path: '/pics/højtTræ2.png', position: [6, 1.9, 14], rotation: [0, 0.0, -0.01], size: 1.5, info: 'Thuja. Often used as hedge in Denmark.' },
  
  // planteKrukke.png
  { path: '/pics/planteKrukke.png', position: [-1, 0.6, 17], rotation: [0, 1.1, 0], size: 0.8, info: 'Terracotta pot. Handmade in Italy.' },
  
  // kruk.png
  { path: '/pics/kruk.png', position: [-12, 0.45, 1], rotation: [0, 1.3, 0], size: 0.8, info: 'Antique pot. Inspired by Greece.' },
  
  // potten.png
  { path: '/pics/potten.png', position: [-4, 0.3, 18], rotation: [0, 0.8, 0], size: 0.5, info: 'Decorative pot.' },
  
  // blomster.png
  { path: '/pics/blomster.png', position: [2, 0.5, 20], rotation: [0, 0.6, 0], size: 0.8, info: 'Lavender. Fragrance of Provence.' },
  
  // 2 x busk.png
  { path: '/pics/busk.png', position: [9, 0.5, 15], rotation: [0, -0.2, 0], size: 2, info: 'Boxwood. Perfect for topiary.' },

  
  // Højtræ3.png
  { path: '/pics/Højtræ3.png', position: [5, 2.7, 7], rotation: [0, 0, 0], size: 2, info: 'Spruce. Nordic forest tree.' },
  
  // højTræFarve.png
  { path: '/pics/højTræFarve.png', position: [-6, 2.9, 1], rotation: [0, 0.2, 0], size: 1.7, info: 'Pine. Grows wild in Scandinavia.' },
  
  // sketchtræ.png
  { path: '/pics/sketchtræ.png', position: [-11, 3, 4], rotation: [0, 1.3, 0], size: 5, info: 'Oak. Can live over 500 years.' },
  
  // træOLD.png
  { path: '/pics/træOLD.png', position: [-4, 2.3, 21], rotation: [0, 1.0, 0], size: 1.5, info: 'Old tree.' },
  
  // træPot.png
  { path: '/pics/træPot.png', position: [-12, 1.30, -6], rotation: [0, 0.9, 0], size: 2, info: 'Olive tree in pot. From Tuscany.' },
  
  // blomstKrukke.png
  { path: '/pics/blomstKrukke.png', position: [0, 0.7, 0], rotation: [0, 0.3, 0], size: 1.3, info: 'Hydrangea. Blooms all summer.' },
  
  // fontaine.png
  { path: '/pics/fontaine.png', position: [0, 1.38, -6], rotation: [0, -1, 0], size: 3, maxDistance: 11, info: 'Fountain. Classic Italian style.' },
  
  // hvideblomster.png (bag fontænen)
  { path: '/pics/hvideblomster.png', position: [0, 0.65, -14], rotation: [0, -0.6, 0], size: 1.5, id: 'hvideblomster', info: 'White flowers.' },
  
  // portSketch.png (bag hvideblomster)
  { path: '/pics/portSketch.png', position: [10, 2.15, -13], rotation: [0, -0.6, 0], size: 9, maxDistance: 20, id: 'portSketch', waitFor: 'hvideblomster', waitForProgress: 0.0, animationLength: 0.10, info: 'Port sketch.' },
  
  // portFarve.png (foran portSketch)
  { path: '/pics/portFarve.png', position: [10, 2.15, -12.99], rotation: [0, -0.6, 0], size: 9, waitForProgress: 0.6, animationLength: 0.10, info: 'Port color.' },

  // træ ved slutningen - placeret ved siden af portSketch
  { path: '/pics/trævedslutningen.png', position: [3.2, 2.8, -21.5], rotation: [0, -0.2, 0], size: 1, id: 'trævedslutningen', info: 'Træ ved slutningen.', ignoreForLanding: true },

  // lillablomst.png
  { path: '/pics/lillablomst.png', position: [-7, 0.35, -9], rotation: [0, 0.2, 0], size: 0.5, info: 'Purple flower.' },

  // New: træ og busk placed next to the purple flower
  { path: '/pics/træogbusk.png', position: [-5.2, 3.2, -15.1], rotation: [0, 0.2, 0], size: 2.5, info: 'Træ og busk.', ignoreForLanding: true },

]
let targetScrollProgress = 0
let totalScroll = 0
let cameraPath = null
let currentCameraPosition = null
let targetCameraPosition = null
let currentLookAt = null
let targetLookAt = null
const keys = { w: false, s: false }
const moveSpeed = 0.1
let handleKeyDown = null
let handleKeyUp = null
let mouseX = 0 // Normaliseret mus position (-1 til 1)
let mouseY = 0 // Normaliseret mus position (-1 til 1)
let targetMouseX = 0 // Target mus position for smooth interpolation
let targetMouseY = 0 // Target mus position for smooth interpolation
let mouseScreenX = 0 // Mus position i screen space (0 til window.innerWidth)
let mouseScreenY = 0 // Mus position i screen space (0 til window.innerHeight)
let handleMouseMove = null
const mouseSensitivity = 0.15 // Hvor meget kameraet bevæger sig med musen (reduceret for mindre bevægelse)
let particles = null
let particleSystem = null
let particleCircleTexture = null // Cirkulær tekstur for partikler
const particleCount = 500

// Object pooling for frustum culling (oprettes én gang, genbruges hver frame)
let frustum = null
let frustumMatrix = null

// Flock component reference
const flockRef = ref(null)

// Bird3D component reference
const bird3DRef = ref(null)

// Toggle for at vise alle billeder eller bruge wipe effekt
const showAllImages = ref(false) // Wipe effect enabled (OFF)

// Midlertidig udvikler-mode (nyt): flag for manuel scrolling
// Som standard deaktiveret så oplevelsen opfører sig som før.
const manualScrollEnabled = ref(false)
const manualScrollAllowed = ref(false) // når false, kan wheel ikke aktivere manual mode

const enableManualScroll = () => {
  manualScrollEnabled.value = true
  isAutoScrolling.value = false
  try {
    document.documentElement.classList.remove('locked')
    document.body.classList.remove('locked')
    document.documentElement.style.overflow = 'auto'
    document.body.style.overflow = 'auto'
  } catch (e) {}
  console.log('Manual scroll enabled — body lock removed')
}

const disableManualScroll = () => {
  manualScrollEnabled.value = false
  try {
    document.documentElement.classList.add('locked')
    document.body.classList.add('locked')
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
  } catch (e) {}
  console.log('Manual scroll disabled — body lock restored')
}

// Toggle fast/manual scroll (developer temporary toggle)
const toggleFastScroll = () => {
  // Flip allowed flag so wheel can enable manual mode immediately
  manualScrollAllowed.value = true
  if (manualScrollEnabled.value) {
    disableManualScroll()
    manualScrollAllowed.value = false
    console.log('Fast scroll: OFF')
  } else {
    enableManualScroll()
    console.log('Fast scroll: ON')
  }
}

// Toggle for atmosphere (nature audio) og Speak (speech audio)
const atmosphereEnabled = ref(true) // Start med atmosphere tændt
const speakEnabled = ref(true) // Start med speak tændt
const SPEECH_PLAYBACK_RATE = 1.1 // Alle Speak-lydklip afspilles en smule hurtigere (1.0 = normal)

// Warm-up / preloading state
const isWarmedUp = ref(false) // Bliver true når alle initielle ressourcer er loadet
const warmUpProgress = ref(0) // 0-100 progress for loading
const warmUpStatus = ref('Initializing...') // Status text shown during loading
const warmUpDistance = 40 // Afstand fra start position hvor billeder preloades (øget for at undgå lag)
let isReturningFromPage = false // Track if we're returning from another page (skip preloader)

// Introduktion tekst med fade effekt
const introOpacity = ref(0) // 0 = ikke synlig, 1 = fuldt synlig
const introVisible = ref(true)
let introAnimationStarted = false
let introAnimationTime = 0
const introAnimationDuration = 1.5 // Sekunder for fade-in animation

// Info knapper til billeder
const activeInfoIndex = ref(null) // Hvilken info popup der vises (null = ingen)
const infoButtonPositions = ref([]) // Screen positions for info buttons [{x, y, visible}]

// Landing page logo visibility
const headerLogoOpacity = ref(0) // Header logo starter usynligt
const landingLogoOpacity = ref(1) // Landing logo starter synligt

// Landing page noise wipe effect
const landingWipeProgress = ref(1) // 1 = fully visible, 0 = fully hidden
const landingWipeCanvasRef = ref(null)
let landingWipeGl = null
let landingWipeProgram = null
let landingWipePositionBuffer = null
let landingWipePositionLocation = null

// Landing page displacement canvas
const landingDisplacementCanvas = ref(null)
let displacementGl = null
let displacementProgram = null
let displacementTexture = null
let displacementAnimationId = null


// Landing page parallax and animation state
const landingParallaxX = ref(0) // Parallax X offset for landing elements
const landingParallaxY = ref(0) // Parallax Y offset for landing elements
let targetLandingParallaxX = 0 // Target X for smooth interpolation
let targetLandingParallaxY = 0 // Target Y for smooth interpolation
const landingAnimationStarted = ref(false) // Track if landing animation has begun
const landingLogoDrawProgress = ref(0) // 0-1 for SVG draw animation

// Auto-scroll (Explore button) state
const isAutoScrolling = ref(false) // Om auto-scroll er aktiv
let autoScrollSpeechPlaying = false // Om en speech audio afspilles lige nu (sænk farten)
const autoScrollSpeed = 0.00018 // Normal hastighed per frame
const autoScrollSpeechSpeed = 0.0001 // Langsommere hastighed mens speak afspilles
const autoScrollLandingSpeed = 0.0002 // Langsommere hastighed gennem landing-fasen (landing page → start path)
const autoScrollTransitionSpeed = 0.0005 // Langsommere hastighed fra landing til første tekst

// Ref for landing top SVG element (our landscape designs)
const landingTopSvgRef = ref(null)

// Scroll text position that follows mouse
const scrollTextX = ref(0) // X position for scroll text
const scrollTextY = ref(0) // Y position for scroll text
let targetScrollTextX = 0 // Target X position for smooth interpolation
let targetScrollTextY = 0 // Target Y position for smooth interpolation
const soundClicked = ref(false) // Track if user has clicked for sound

// Lås speech audio op for mobil (iOS Safari kræver user gesture før play() virker)
let speechAudioUnlocked = false
const unlockSpeechAudioForMobile = () => {
  if (speechAudioUnlocked) return // Kun én gang
  speechAudioUnlocked = true
  const speechAudios = [speechAudio, speech2Audio, speech3Audio, speech4Audio, speech5Audio, speech6Audio, speech7Audio, speech8Audio]
  speechAudios.forEach((audio) => {
    if (audio) {
      audio.muted = true // Muted er pålideligt lydløs på iOS (i modsætning til volume=0)
      // Nulstil til start før unlock
      audio.currentTime = 0
      audio.play().then(() => {
        audio.pause()
        audio.currentTime = 0
        audio.muted = false
      }).catch(() => {
        audio.currentTime = 0
        audio.muted = false
      })
    }
  })
}

// Click handler for sound on landing page
const handleSoundClick = () => {
  if (!soundClicked.value && scrollProgress < landingScrollThreshold) {
    soundClicked.value = true
    // Start audio playback if atmosphere is enabled
    if (natureAudio && atmosphereEnabled.value && natureAudio.paused) {
      natureAudio.play().catch(err => {
        console.warn('Kunne ikke starte audio:', err)
      })
    }
    // Lås speech audio op for mobil (iOS Safari)
    unlockSpeechAudioForMobile()
  }
}

// Auto-scroll: Start automatisk scrolling gennem hele oplevelsen
const startAutoScroll = () => {
  if (isAutoScrolling.value) return
  
  isAutoScrolling.value = true
  autoScrollSpeechPlaying = false
  
  // Aktiver lyd (som om brugeren har klikket)
  soundClicked.value = true
  
  // Start nature audio
  if (natureAudio && atmosphereEnabled.value && natureAudio.paused) {
    natureAudio.play().catch(err => {
      console.warn('Kunne ikke starte audio:', err)
    })
  }
  // Lås speech audio op for mobil (iOS Safari)
  unlockSpeechAudioForMobile()
  
  // Deaktiver manuel scrolling
  if (handleScroll) {
    window.removeEventListener('wheel', handleScroll)
  }
}

// Auto-scroll: Stop automatisk scrolling
const stopAutoScroll = () => {
  if (!isAutoScrolling.value) return
  
  isAutoScrolling.value = false
  autoScrollSpeechPlaying = false
  
  // Genaktiver manuel scrolling
  if (handleScroll) {
    window.addEventListener('wheel', handleScroll, { passive: true })
  }
}

// Tekst der vises under scroll
const currentText = ref('')
const textOpacity = ref(0)
const scrollTexts = [
  'We begin with a dialogue about your dreams, visions, and wishes for a personal garden.',
  'Then we sketch your garden in detail, where every line, angle, plant, and path matters.',
  'We add color to the sketch to bring it to life and show how your garden will look.',
  'We source every plant with care, and every material chosen is handmade with eye for detail.',
  'The on-site craftsmanship begins with precision, shaping the garden with an understanding of both art and craft.',
  'Each element is deliberately placed, creating balance, rhythm, and proportion.',
  'Your dream garden takes shape through the craftsmanship, becoming reality day by day.',
  'The result is a tailor-made garden where nature meets design, and every detail tells a story.'
]
let previousTextIndex = -1
let fadeState = 'in' // 'in', 'out', eller 'pause'
let fadeProgress = 0
const textSectionRatio = 0.55 // Default hvis ikke specificeret i array
// TextSectionRatio for hver tekst (index 0-7) - styr hvor længe hver tekst vises
const textSectionRatioOverrides = {
  0: 0.55, // 'We begin with a dialogue about your dreams...'
  1: 0.60, // 'Then we sketch your garden in detail...'
  2: 0.55, // 'We add color to the sketch...'
  3: 0.75, // 'We source every plant with care...'
  4: 0.82, // 'The on-site craftsmanship begins...'
  5: 0.75, // 'Each element is deliberately placed...'
  6: 0.75, // 'Your dream garden takes shape...'
  7: 0.75  // 'The result is a tailor-made garden...'
}
let isScrollingBackToStart = false

// 3D Navigation at path end
let navMeshes = [] // Array af navigation meshes
let navUnderlines = [] // Array af hover underlines (grønne linjer under tekst)
let navGroup = null // Gruppe der holder alle nav meshes
let raycaster = null // For click detection
let navVisible = false // Om navigation er synlig
let navShowTimeout = null // timeout id for delayed showing of end-nav
let hoveredNavMesh = null // Currently hovered nav mesh
let use3DNav = false // Toggle to use legacy 3D nav meshes (we'll use 2D links instead)
const navLinks = [
  { label: 'About', route: '/about' },
  { label: 'Cases', route: '/cases' },
  { label: 'Products', route: '/products' },
  { label: 'Contact', route: '/contact' }
]
// Delay before starting the end-nav GSAP animation (seconds)
const navAnimationDelay = 0.6
// Delay before the end-nav overlay becomes visible (seconds)
const navShowDelay = 0.6
let handleNavClick = null // Click handler reference

// Audio for nature sound
let natureAudio = null
const audioMaxVolume = 0.5 // Maksimal lydstyrke (0-1)
const audioFadeStart = landingScrollThreshold // Bruges til reference (lyden spiller nu på landing page)
const audioFadeEnd = landingScrollThreshold + 0.1 // Bruges til reference

// Audio for metal gate sound (spilles når man nærmer sig watercolor billedet)
let metalGateAudio = null
const metalGateTriggerDistance = 12 // Afstand hvor lyden skal afspilles
const metalGateImagePosition = new THREE.Vector3(-6, 2.45, 9.98) // Position for Gemini_Generated_Image_phek2ephek2ephek 1.png
let metalGatePlayed = false // Track om lyden allerede er afspillet

// Audio for water sound (spilles når man nærmer sig fontaine billedet)
let waterAudio = null
const waterTriggerDistance = 10 // Afstand hvor lyden skal afspilles
const waterImagePosition = new THREE.Vector3(0, 1.38, -6) // Position for fontaine.png
let waterPlayed = false // Track om lyden allerede er afspillet

// Audio for bask sound (spilles når man nærmer sig sketchtræ billedet)
let baskAudio = null
const baskTriggerDistance = 10 // Afstand hvor lyden skal afspilles
const baskImagePosition = new THREE.Vector3(-11, 3, 4) // Position for sketchtræ.png
let baskPlayed = false // Track om lyden allerede er afspillet

// Audio for speech sound (spilles når første tekst vises)
let speechAudio = null
let speechPlayed = false // Track om lyden allerede er afspillet

// Audio for speech sound 2 (spilles når anden tekst vises)
let speech2Audio = null
let speech2Played = false // Track om lyden allerede er afspillet

// Audio for speech sound 3 (spilles når tredje tekst vises)
let speech3Audio = null
let speech3Played = false // Track om lyden allerede er afspillet

// Audio for speech sound 4 (spilles når fjerde tekst vises)
let speech4Audio = null
let speech4Played = false // Track om lyden allerede er afspillet

// Audio for speech sound 5 (spilles når femte tekst vises)
let speech5Audio = null
let speech5Played = false // Track om lyden allerede er afspillet

// Audio for speech sound 6 (spilles når sjette tekst vises)
let speech6Audio = null
let speech6Played = false // Track om lyden allerede er afspillet

// Audio for speech sound 7 (spilles når syvende tekst vises)
let speech7Audio = null
let speech7Played = false // Track om lyden allerede er afspillet

// Audio for speech sound 8 (spilles når ottende tekst vises)
let speech8Audio = null
let speech8Played = false // Track om lyden allerede er afspillet

// Noise wipe shader for landing page
const noiseWipeVertexShader = `
  attribute vec2 a_position;
  varying vec2 vUv;
  void main() {
    vUv = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

const noiseWipeFragmentShader = `
  precision mediump float;
  uniform float uWipeProgress;
  varying vec2 vUv;
  
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }
  
  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  
  float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    for(int i = 0; i < 3; i++) {
      value += amplitude * noise(st);
      st *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }
  
  void main() {
    vec2 gradientCoord = vUv * vec2(8.0, 6.0);
    float noise1 = fbm(gradientCoord);
    float noise2 = fbm(gradientCoord * 1.5 + vec2(10.0));
    float gradientMask = (noise1 * 0.6 + noise2 * 0.4);
    
    // wipeProgress: 1 = landing visible (no coverage), 0 = landing hidden (full coverage)
    // Expand the coverage from 0 as wipeProgress decreases
    float coverage = 1.0 - uWipeProgress;
    
    // Smooth the transition using smoothstep on the noise
    float reveal = smoothstep(coverage - 0.1, coverage + 0.1, gradientMask);
    
    // Invert: reveal = 1 means covered (draw bg), reveal = 0 means visible (transparent)
    float alpha = 1.0 - reveal;
    
    // Background color (match landing page bg)
    vec3 bgColor = vec3(0.969, 0.965, 0.949);
    
    gl_FragColor = vec4(bgColor, alpha);
  }
`

function initLandingNoiseWipe() {
  if (!landingWipeCanvasRef.value) return
  
  const canvas = landingWipeCanvasRef.value
  landingWipeGl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false })
  
  if (!landingWipeGl) {
    console.warn('WebGL not supported for noise wipe')
    return
  }
  
  const gl = landingWipeGl
  
  // Create shaders
  const vertexShader = gl.createShader(gl.VERTEX_SHADER)
  gl.shaderSource(vertexShader, noiseWipeVertexShader)
  gl.compileShader(vertexShader)
  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.error('Vertex shader error:', gl.getShaderInfoLog(vertexShader))
    return
  }
  
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
  gl.shaderSource(fragmentShader, noiseWipeFragmentShader)
  gl.compileShader(fragmentShader)
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.error('Fragment shader error:', gl.getShaderInfoLog(fragmentShader))
    return
  }
  
  // Create program
  landingWipeProgram = gl.createProgram()
  gl.attachShader(landingWipeProgram, vertexShader)
  gl.attachShader(landingWipeProgram, fragmentShader)
  gl.linkProgram(landingWipeProgram)
  if (!gl.getProgramParameter(landingWipeProgram, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(landingWipeProgram))
    return
  }
  
  // Create quad
  const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
  landingWipePositionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, landingWipePositionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
  
  landingWipePositionLocation = gl.getAttribLocation(landingWipeProgram, 'a_position')
  
  // Enable blending
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  
  updateLandingWipeSize()
}

function updateLandingWipeSize() {
  if (!landingWipeCanvasRef.value || !landingWipeGl) return
  
  const canvas = landingWipeCanvasRef.value
  const dpr = window.devicePixelRatio || 1
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  landingWipeGl.viewport(0, 0, canvas.width, canvas.height)
}

// Watch for canvas ref and initialize noise wipe
// Watch for atmosphere toggle - stop/pause nature audio immediately when toggled off
watch(atmosphereEnabled, (enabled) => {
  if (!enabled && natureAudio) {
    natureAudio.pause()
  }
})

// Function to reset specific speech audio states (used when scrolling backward past trigger points)
const resetSpeechAudioFromIndex = (fromIndex) => {
  // Reset all speech audio clips with index >= fromIndex
  // This is called when scrolling backward past a trigger point
  // fromIndex is the index of the first audio clip to reset (e.g., if fromIndex=2, reset clips 2,3,4,5,6,7)
  const audioClips = [
    { audio: speechAudio, played: () => speechPlayed = false, index: 0 },
    { audio: speech2Audio, played: () => speech2Played = false, index: 1 },
    { audio: speech3Audio, played: () => speech3Played = false, index: 2 },
    { audio: speech4Audio, played: () => speech4Played = false, index: 3 },
    { audio: speech5Audio, played: () => speech5Played = false, index: 4 },
    { audio: speech6Audio, played: () => speech6Played = false, index: 5 },
    { audio: speech7Audio, played: () => speech7Played = false, index: 6 },
    { audio: speech8Audio, played: () => speech8Played = false, index: 7 }
  ]
  
  audioClips.forEach(({ audio, played, index }) => {
    if (audio && index >= fromIndex) {
      audio.pause()
      audio.currentTime = 0
      played()
    }
  })
}

// Watch for speak toggle - stop/pause all speech audio immediately when toggled off
watch(speakEnabled, (enabled) => {
  if (!enabled) {
    const speechAudios = [
      speechAudio,
      speech2Audio,
      speech3Audio,
      speech4Audio,
      speech5Audio,
      speech6Audio,
      speech7Audio,
      speech8Audio
    ]
    speechAudios.forEach(audio => {
      if (audio && !audio.paused) {
        audio.pause()
      }
    })
  }
})

watch(landingWipeCanvasRef, (newVal) => {
  if (newVal) {
    nextTick(() => {
      initLandingNoiseWipe()
      // Initial render with full visibility
      landingWipeProgress.value = 1
      renderLandingNoiseWipe()
    })
  }
}, { immediate: true })

// Watch for preloader completion and animate "our landscape designs" down
watch([isWarmedUp, landingTopSvgRef], ([warmedUp, svgEl]) => {
  if (!warmedUp || !svgEl) return

  nextTick(() => {
    const el = landingTopSvgRef.value
    if (!el) return

    gsap.killTweensOf(el)

    // Set initial state - start completely below viewport
    gsap.set(el, {
      y: '100vh', // Start completely below viewport (from bottom of screen)
      opacity: 0,
      scale: 0.95
    })
    
    // Create a beautiful, cinematic animation with smooth easing
    gsap.to(el, {
      y: 0, // End position (natural position at 2vh from bottom)
      opacity: 1,
      scale: 1,
      duration: 1.8, // Slightly longer for more elegance
      ease: 'expo.out', // Very smooth, professional easing - starts fast, ends very smoothly
      delay: 0 // Start immediately after preloader finishes
    })
  })
}, { immediate: true, flush: 'post' })

function renderLandingNoiseWipe() {
  if (!landingWipeGl || !landingWipeProgram || !landingWipePositionBuffer) return
  
  const gl = landingWipeGl
  
  // Update canvas size if needed
  updateLandingWipeSize()
  
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  
  gl.useProgram(landingWipeProgram)
  
  // Bind position buffer and set up attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, landingWipePositionBuffer)
  gl.enableVertexAttribArray(landingWipePositionLocation)
  gl.vertexAttribPointer(landingWipePositionLocation, 2, gl.FLOAT, false, 0, 0)
  
  // Set wipe progress uniform
  const wipeLocation = gl.getUniformLocation(landingWipeProgram, 'uWipeProgress')
  gl.uniform1f(wipeLocation, landingWipeProgress.value)
  
  gl.drawArrays(gl.TRIANGLES, 0, 6)
}

// Setup displacement canvas for landing page image
const setupDisplacementCanvas = () => {
  const canvas = landingDisplacementCanvas.value
  if (!canvas) return
  
  const gl = canvas.getContext('webgl')
  if (!gl) {
    console.error('WebGL not supported for displacement canvas')
    return
  }
  
  displacementGl = gl
  
  // Load image
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.onload = () => {
    // Set canvas size based on image aspect ratio
    const maxWidth = Math.min(window.innerWidth * 1.0, 2500)
    const aspect = image.width / image.height
    canvas.width = maxWidth
    canvas.height = maxWidth / aspect
    
    gl.viewport(0, 0, canvas.width, canvas.height)
    
    // Vertex shader
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `
    
    // Fragment shader med bulge/pinch effekt
    const fragmentShaderSource = `
      precision mediump float;
      uniform sampler2D u_image;
      uniform vec2 u_mouse;
      uniform float u_time;
      uniform float u_strength;
      varying vec2 v_texCoord;
      
      void main() {
        vec2 uv = v_texCoord;
        
        // Beregn afstand og retning til mus
        vec2 mouseUV = u_mouse;
        vec2 diff = uv - mouseUV;
        float dist = length(diff);
        
        // Maksimal radius hvor effekten påvirker
        float maxRadius = 0.25;
        
        // Beregn bulge styrke baseret på afstand
        // Jo tættere på musen, jo stærkere effekt
        float normalizedDist = dist / maxRadius;
        float bulgeStrength = u_strength * (1.0 - smoothstep(0.0, 1.0, normalizedDist));
        
        // Tilføj subtil pulserende effekt
        float pulse = 1.0 + sin(u_time * 1.5) * 0.1;
        bulgeStrength *= pulse;
        
        // Beregn ny afstand med bulge effekt
        // Bulge skubber pixels væk fra centrum (som en forstørrelsesglas)
        float newDist = dist * (1.0 - bulgeStrength * 0.3);
        
        // Normaliser retning og anvend ny afstand
        vec2 direction = normalize(diff + 0.001); // Tilføj lille værdi for at undgå division med 0
        vec2 bulgedUV = mouseUV + direction * newDist;
        
        // Clamp UV koordinater for at undgå lyse kanter
        bulgedUV = clamp(bulgedUV, 0.0, 1.0);
        
        vec4 color = texture2D(u_image, bulgedUV);
        gl_FragColor = color;
      }
    `
    
    // Compile shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)
    gl.shaderSource(vertexShader, vertexShaderSource)
    gl.compileShader(vertexShader)
    
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(fragmentShader, fragmentShaderSource)
    gl.compileShader(fragmentShader)
    
    // Create program
    displacementProgram = gl.createProgram()
    gl.attachShader(displacementProgram, vertexShader)
    gl.attachShader(displacementProgram, fragmentShader)
    gl.linkProgram(displacementProgram)
    gl.useProgram(displacementProgram)
    
    // Set up buffers
    const positions = new Float32Array([
      -1, -1,  0, 1,
       1, -1,  1, 1,
      -1,  1,  0, 0,
      -1,  1,  0, 0,
       1, -1,  1, 1,
       1,  1,  1, 0
    ])
    
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
    
    const positionLocation = gl.getAttribLocation(displacementProgram, 'a_position')
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0)
    
    const texCoordLocation = gl.getAttribLocation(displacementProgram, 'a_texCoord')
    gl.enableVertexAttribArray(texCoordLocation)
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8)
    
    // Create texture
    displacementTexture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, displacementTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    
    // Enable transparency
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    
    // Animation loop
    const renderDisplacement = () => {
      if (!displacementGl || !displacementProgram) return
      
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(displacementProgram)
      
      // Update uniforms
      const mouseLocation = gl.getUniformLocation(displacementProgram, 'u_mouse')
      const timeLocation = gl.getUniformLocation(displacementProgram, 'u_time')
      const strengthLocation = gl.getUniformLocation(displacementProgram, 'u_strength')
      
      // Convert mouse screen position to UV (0-1)
      const mouseU = mouseScreenX / window.innerWidth
      const mouseV = mouseScreenY / window.innerHeight
      
      gl.uniform2f(mouseLocation, mouseU, mouseV)
      gl.uniform1f(timeLocation, performance.now() * 0.001)
      gl.uniform1f(strengthLocation, 0.5)
      
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      
      displacementAnimationId = requestAnimationFrame(renderDisplacement)
    }
    
    renderDisplacement()
  }
  
  image.src = '/pics/Landing/hjemtegning.png'
}

// Watch for canvas to be mounted
// watch(landingDisplacementCanvas, (canvas) => {
//   if (canvas) {
//     nextTick(() => {
//       setupDisplacementCanvas()
//     })
//   }
// })

onMounted(() => {
  // Lock body overflow for 3D view
  document.documentElement.classList.add('locked')
  document.body.classList.add('locked')
  
  // HMR optimization: Ryd op eksisterende scene hvis den allerede findes
  if (scene) {
    // Reset auto-scroll state
    isAutoScrolling.value = false
    autoScrollSpeechPlaying = false
    
    // Stop animation loop
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
    
    // Fjern event listeners før geninitialisering
    if (handleResize) {
      window.removeEventListener('resize', handleResize)
      handleResize = null
    }
    if (handleScroll) {
      window.removeEventListener('wheel', handleScroll)
      handleScroll = null
    }
    if (handleMouseMove) {
      window.removeEventListener('mousemove', handleMouseMove)
      handleMouseMove = null
    }
    if (handleKeyDown) {
      window.removeEventListener('keydown', handleKeyDown)
      handleKeyDown = null
    }
    if (handleKeyUp) {
      window.removeEventListener('keyup', handleKeyUp)
      handleKeyUp = null
    }
    
    // Stop og cleanup audio før geninitialisering
    if (natureAudio) {
      natureAudio.pause()
      natureAudio = null
    }
    if (metalGateAudio) {
      metalGateAudio.pause()
      metalGateAudio = null
    }
    if (waterAudio) {
      waterAudio.pause()
      waterAudio = null
    }
    if (baskAudio) {
      baskAudio.pause()
      baskAudio = null
    }
    if (speechAudio) {
      speechAudio.pause()
      speechAudio = null
    }
    if (speech2Audio) {
      speech2Audio.pause()
      speech2Audio = null
    }
    if (speech3Audio) {
      speech3Audio.pause()
      speech3Audio = null
    }
    if (speech4Audio) {
      speech4Audio.pause()
      speech4Audio = null
    }
    if (speech5Audio) {
      speech5Audio.pause()
      speech5Audio = null
    }
    if (speech6Audio) {
      speech6Audio.pause()
      speech6Audio = null
    }
    if (speech7Audio) {
      speech7Audio.pause()
      speech7Audio = null
    }
    if (speech8Audio) {
      speech8Audio.pause()
      speech8Audio = null
    }
    
    // Ryd op i eksisterende ressourcer før geninitialisering
    if (pencilLineGroup) {
      pencilLineGroup.children.forEach(child => {
        if (child.geometry) child.geometry.dispose()
        if (child.material) child.material.dispose()
      })
      scene.remove(pencilLineGroup)
      pencilLineGroup = null
    }
    
    if (gridHelper) {
      scene.remove(gridHelper)
      gridHelper = null
    }
    
    // Dispose alle billeder
    sceneImages.forEach((imageData) => {
      disposeSceneImage(imageData)
    })
    sceneImages = []
    
    // Dispose pen model
    if (penModel) {
      penModel.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose()
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose())
            } else {
              child.material.dispose()
            }
          }
        }
      })
      scene.remove(penModel)
      penModel = null
    }
    
    // Dispose brush model
    if (brushModel) {
      brushModel.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose()
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose())
            } else {
              child.material.dispose()
            }
          }
        }
      })
      scene.remove(brushModel)
      brushModel = null
    }
    
    // Dispose renderer og container
    if (renderer) {
      if (containerRef.value && renderer.domElement) {
        containerRef.value.removeChild(renderer.domElement)
      }
      renderer.dispose()
      renderer = null
    }
    
    // Dispose textures
    if (paperTexture) {
      paperTexture.dispose()
      paperTexture = null
    }
    if (bumpTexture) {
      bumpTexture.dispose()
      bumpTexture = null
    }
    
    
    // Check for saved scroll position (returning from another page)
    const savedScrollProgress = localStorage.getItem('gardenScrollProgress')
    const savedTotalScroll = localStorage.getItem('gardenTotalScroll')
    const hasReturnPosition = savedScrollProgress !== null && parseFloat(savedScrollProgress) > 0
    
    // Clear saved position after reading
    localStorage.removeItem('gardenScrollProgress')
    localStorage.removeItem('gardenTotalScroll')
    
    // Skip preloader if returning from another page
    if (hasReturnPosition) {
      isWarmedUp.value = true
      warmUpProgress.value = 100
      isReturningFromPage = true
    } else {
      isReturningFromPage = false
    }
    
    // Reset state variabler or restore from saved
    if (hasReturnPosition) {
      scrollProgress = parseFloat(savedScrollProgress)
      targetScrollProgress = scrollProgress
      totalScroll = parseFloat(savedTotalScroll) || 0
    } else {
      scrollProgress = 0
      targetScrollProgress = 0
      totalScroll = 0
    }
    penWipeProgress = 0
    lastEndT = -1
    mouseX = 0
    mouseY = 0
    targetMouseX = 0
    targetMouseY = 0
    scrollTextX.value = 0
    scrollTextY.value = 0
    targetScrollTextX = 0
    targetScrollTextY = 0
    previousTextIndex = -1
    fadeState = 'in'
    fadeProgress = 0
    isScrollingBackToStart = false
    introAnimationStarted = false
    introAnimationTime = 0
    introOpacity.value = 0
    introVisible.value = true
    currentText.value = ''
    textOpacity.value = 0
    
    // Reset or restore landing state based on saved position
    if (hasReturnPosition && scrollProgress >= landingScrollThreshold) {
      isInLandingPhase = false
      headerLogoOpacity.value = 1
      landingLogoOpacity.value = 0
    } else {
      isInLandingPhase = true
      headerLogoOpacity.value = 0
      landingLogoOpacity.value = 1
    }
    landingCameraPosition = null
    landingCameraLookAt = null
    
    // Reset audio state
    metalGatePlayed = false
    waterPlayed = false
    baskPlayed = false
    speechPlayed = false
    speech2Played = false
    speech3Played = false
    speech4Played = false
    speech5Played = false
    speech6Played = false
    speech7Played = false
    speech8Played = false
  }
  
  // Opret scene
  scene = new THREE.Scene()
  //scene.background = new THREE.Color(0x32a852) // Hvid baggrund
  scene.background = new THREE.Color(0xF0EEE9) // Background matcher fog farve #F0EEE9
  scene.fog = new THREE.FogExp2(0xF0EEE9, 0.13) // Fog med farve #F0EEE9 (højere værdi = tættere fog)
  
  // Funktion til at opdatere FOV baseret på skærmstørrelse
  const updateCameraFOV = () => {
    const isMobile = window.innerWidth <= 768
    const fov = isMobile ? 120 : 75 // Meget højere FOV på mobil for at se meget mere
    if (camera) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    return fov
  }
  
  // Opret kamera
  const initialFOV = window.innerWidth <= 768 ? 120 : 75
  camera = new THREE.PerspectiveCamera(
    initialFOV,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  
  // Opret bølget kamera path (som en sti)
  // PATH KONFIGURATION - Juster disse værdier for at ændre pathen:
  const planeSize = 75 // Planens størrelse (75x75)
  const pathMargin = 5 // Margin fra kanten af planen
  const pathStartX = 0 // Start X position (0 = midten)
  const pathStartZ = planeSize / 2 - pathMargin // Start Z position (nær toppen af planen)
  const pathEndX = 0 // Slut X position (0 = midten)
  const pathEndZ = -planeSize / 2 + pathMargin // Slut Z position (nær bunden af planen)
  const pathWidth = 8 // Bredde af bølgerne (side til side bevægelse)
  const pathHeight = 0.8 // Højde af kameraet over planen
  const pathWaveFrequency = 3 // Antal bølger langs pathen (højere = flere bølger)
  const pathVerticalVariation = 0.0 // Op/ned variation (0 = ingen, højere = mere variation)
  
  const pathPoints = []
  const numPoints = 30 // Antal kontrolpunkter (flere = glattere kurve)
  
  // Opret bølget path med flere kontrolpunkter
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints // 0 til 1
    
    // Lineær interpolation fra start til slut position
    const baseX = pathStartX + (pathEndX - pathStartX) * t
    const baseZ = pathStartZ + (pathEndZ - pathStartZ) * t
    
    // Hovedbølge side til side
    const waveX = Math.sin(t * Math.PI * pathWaveFrequency) * pathWidth
    
    // Tilføj subtil sekundær bølge for mere variation
    const secondaryWaveX = Math.sin(t * Math.PI * pathWaveFrequency * 2.3) * pathWidth * 0.15
    const tertiaryWaveX = Math.cos(t * Math.PI * pathWaveFrequency * 1.7) * pathWidth * 0.1
    
    // Tilføj lidt subtil variation i Z-retningen
    const waveZ = Math.sin(t * Math.PI * pathWaveFrequency * 1.5) * 0.8
    
    // Tilføj lidt op og ned bevægelse
    const waveY = pathHeight + Math.sin(t * Math.PI * 2) * pathVerticalVariation
    
    // Kombiner alle bølger
    const finalX = baseX + waveX + secondaryWaveX + tertiaryWaveX
    const finalZ = baseZ + waveZ
    
    // Sikr at vi ikke går udenfor planen
    const x = Math.max(-planeSize/2 + pathMargin, Math.min(planeSize/2 - pathMargin, finalX))
    const z = Math.max(-planeSize/2 + pathMargin, Math.min(planeSize/2 - pathMargin, finalZ))
    
    pathPoints.push(new THREE.Vector3(x, waveY, z))
  }
  
  cameraPath = new THREE.CatmullRomCurve3(pathPoints)
  
  // LANDING PAGE: Start kameraet med at kigge mod alle billederne i scenen
  // Beregn centrum af alle billederne
  let imagesCenter = new THREE.Vector3(0, 0, 0)
  let imagesCount = 0
  imageConfigs.forEach(config => {
    // Ignorer billeder markeret som `ignoreForLanding` så et enkelt billede langt ude
    // i Z ikke skubber landing-kameraets position
    if (config.ignoreForLanding) return
    imagesCenter.add(new THREE.Vector3(config.position[0], config.position[1], config.position[2]))
    imagesCount++
  })
  if (imagesCount > 0) {
    imagesCenter.divideScalar(imagesCount)
  }
  
  // Landing kamera position - justeret position for bedre view
  const pathStartPoint = cameraPath.getPoint(0) // Hent path start position
  // Placér kameraet i en anden position for varieret view
  const cameraOffsetX = 5 // Til højre for at se fra den side
  const cameraOffsetZ = 20 // Bagved billederne
  const cameraHeight = 3 // Højere op for bedre overblik
  landingCameraPosition = new THREE.Vector3(
    imagesCenter.x + cameraOffsetX, // Brug imagesCenter som reference
    cameraHeight, 
    imagesCenter.z + cameraOffsetZ
  )
  
  // Kig mod centrum af billederne med lidt offset
  landingCameraLookAt = new THREE.Vector3(
    imagesCenter.x - 2, // Lidt til venstre
    imagesCenter.y + 1, // Lidt højere
    imagesCenter.z
  )
  
  // Path look ahead position (for kamera retning)
  const pathLookAheadPoint = cameraPath.getPoint(0.1)
  
  // Start kameraet i landing position (kigger ned)
  camera.position.copy(landingCameraPosition)
  camera.lookAt(landingCameraLookAt)
  
  // Initialiser smooth interpolation variabler med landing position
  currentCameraPosition = landingCameraPosition.clone()
  targetCameraPosition = landingCameraPosition.clone()
  currentLookAt = landingCameraLookAt.clone()
  targetLookAt = landingCameraLookAt.clone()
  
  // Opret blyant-streg (bruger samme path som kameraet)
  const createPencilLine = () => {
    if (!cameraPath) return
    
    // Opret en gruppe til at holde alle linjesegmenter
    pencilLineGroup = new THREE.Group()
    scene.add(pencilLineGroup)
    
    // Opret hovedlinjen (bruges til at opdatere geometri)
    const geometry = new THREE.BufferGeometry()
    const material = new THREE.LineBasicMaterial({
      color: 0x222222, // Mørkegrå
      linewidth: 5, // Tykkere linje
      transparent: true,
      opacity: 0.85
    })
    
    pencilLine = new THREE.Line(geometry, material)
    pencilLineGroup.add(pencilLine)
  }
  
  createPencilLine()
  
  // Opret 3D navigation ved path enden
  const create3DNavigation = () => {
    if (!cameraPath) return
    
    // Initialiser raycaster
    raycaster = new THREE.Raycaster()
    
    // Opret gruppe til navigation
    navGroup = new THREE.Group()
    scene.add(navGroup)
    
    // Hent position og retning ved path enden
    const endPosition = cameraPath.getPoint(pathEndPoint)
    const tangent = cameraPath.getTangent(pathEndPoint - 0.1)
    
    // Beregn position foran kameraet
    const navDistance = 3 // Afstand foran kameraet
    const navBasePosition = endPosition.clone().add(tangent.clone().multiplyScalar(navDistance))
    navBasePosition.y = endPosition.y // Hold samme højde som kameraet
    
    // Opret tekst-baseret mesh for hver nav link
    const createNavMesh = (link, index, total) => {
      // Opret canvas til tekst rendering med høj opløsning
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      
      // Brug devicePixelRatio for højere opløsning (2x eller 3x for skarpere tekst)
      const dpr = window.devicePixelRatio || 1
      const scaleFactor = 3 // Øg dette for endnu højere opløsning
      
      // Sæt canvas størrelse
      const padding = 50
      const fontSize = 56
      
      // Funktion til at tegne teksten når fonten er loaded
      const drawText = () => {
        // Brug Boska font med lighter weight (300 = Light)
        context.font = `300 ${fontSize}px 'Boska', Georgia, serif`
        const textMetrics = context.measureText(link.label)
        const textWidth = textMetrics.width
        const textHeight = fontSize * 1.2
        
        // Sæt canvas størrelse med høj opløsning
        canvas.width = (textWidth + padding * 2) * scaleFactor
        canvas.height = (textHeight + padding * 2) * scaleFactor
        
        // Skaler context så alt tegnes i høj opløsning
        context.scale(scaleFactor, scaleFactor)
        
        // Clear canvas med transparent baggrund
        context.clearRect(0, 0, canvas.width / scaleFactor, canvas.height / scaleFactor)
        
        // Tegn tekst i høj opløsning med lighter weight
        context.font = `300 ${fontSize}px 'Boska', Georgia, serif`
        context.fillStyle = '#1a1a1a'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(
          link.label, 
          (canvas.width / scaleFactor) / 2, 
          (canvas.height / scaleFactor) / 2
        )
        
        return { textWidth, textHeight }
      }
      
      // Tegn teksten (vent på font hvis nødvendigt)
      const ensureFontLoaded = async () => {
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready
          // Check om Boska font er loaded (med weight 300), hvis ikke vent lidt mere
          if (!document.fonts.check(`300 56px Boska`)) {
            await new Promise(resolve => setTimeout(resolve, 200))
          }
        }
      }
      
      // Tegn med det samme (fonten burde være loaded)
      drawText()
      
      // Opret tekstur fra canvas med bedre filtering
      const texture = new THREE.CanvasTexture(canvas)
      texture.needsUpdate = true
      
      // Vent på font og tegn igen (opdaterer canvas og tekstur)
      ensureFontLoaded().then(() => {
        drawText()
        texture.needsUpdate = true
      })
      // Brug LineFiltering for skarpere tekst (ikke blur)
      texture.magFilter = THREE.LinearFilter
      texture.minFilter = THREE.LinearFilter
      texture.generateMipmaps = false // Deaktiver mipmaps for skarpere tekst
      
      // Opret materiale med tekst tekstur
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false
      })
      
      // Beregn aspect ratio baseret på faktisk tekst størrelse (ikke scaled canvas)
      const actualWidth = canvas.width / scaleFactor
      const actualHeight = canvas.height / scaleFactor
      const aspect = actualWidth / actualHeight
      const textWidth3D = 1.5
      const textHeight3D = textWidth3D / aspect
      const geometry = new THREE.PlaneGeometry(textWidth3D, textHeight3D)
      const mesh = new THREE.Mesh(geometry, material)
      
      // Beregn position i en række
      const spacing = 2.0 // Afstand mellem knapper
      const totalWidth = (total - 1) * spacing
      const xOffset = -totalWidth / 2 + index * spacing
      
      // Beregn højre vektor (vinkelret på tangent)
      const up = new THREE.Vector3(0, 1, 0)
      const right = new THREE.Vector3().crossVectors(tangent, up).normalize()
      
      // Placer mesh
      mesh.position.copy(navBasePosition)
      mesh.position.add(right.multiplyScalar(xOffset))
      
      // Roter mesh til at kigge mod kameraet
      mesh.lookAt(endPosition)
      
      // Opdater matrixWorld så lokale koordinater er korrekte
      mesh.updateMatrixWorld(true)
      
      // Gem route info på mesh
      mesh.userData = { route: link.route, label: link.label }
      
      // Opret grøn underline under teksten (hover indikator)
      const underlineWidth = textWidth3D * 0.9 // 90% af tekst bredde
      const underlineHeight = 0.03 // Tykkelse på linjen
      const underlineGeometry = new THREE.PlaneGeometry(underlineWidth, underlineHeight)
      const underlineMaterial = new THREE.MeshBasicMaterial({
        color: 0x4a6741, // Grøn farve
        transparent: true,
        opacity: 0, // Start skjult
        side: THREE.DoubleSide
      })
      const underline = new THREE.Mesh(underlineGeometry, underlineMaterial)
      
      // Placer underline under teksten ved at bruge mesh's lokale koordinater
      underline.position.copy(mesh.position)
      
      // Efter mesh.lookAt(), mesh's lokale Y-akse peger nedad
      // Brug mesh's lokale koordinatsystem til at beregne nedad retning
      const localDown = new THREE.Vector3(0, -1, 0) // Lokal nedad retning i mesh's koordinatsystem
      const worldDown = new THREE.Vector3()
      worldDown.copy(localDown)
      worldDown.applyQuaternion(mesh.quaternion) // Transform til world space
      
      // Flyt underline nedad under teksten (tættere på teksten)
      const offsetDistance = textHeight3D / 2 + 0.01 // Meget tæt på teksten
      underline.position.add(worldDown.multiplyScalar(offsetDistance))
      
      // Roter underline til at kigge mod kameraet (samme som tekst)
      underline.lookAt(endPosition)
      
      // Start med scaleX = 0 for width animation (ligesom burger menu)
      underline.scale.x = 0
      underline.userData.targetScaleX = 0 // For animation
      underline.userData.parentMesh = mesh
      
      navGroup.add(mesh)
      navGroup.add(underline)
      navMeshes.push(mesh)
      navUnderlines.push(underline)
      
      return mesh
    }
    
    // Opret alle nav meshes
    navLinks.forEach((link, index) => {
      createNavMesh(link, index, navLinks.length)
    })
    
    // Start usynlig
    navGroup.visible = false
  }
  
  create3DNavigation()
  
  // PERFORMANCE: Tjek skærmstørrelse for adaptive optimering
  const screenWidth = window.innerWidth
  const screenHeight = window.innerHeight
  const isLargeScreen = screenWidth >= 2560 || screenHeight >= 1440 // 27" skærm eller større
  const isMediumScreen = screenWidth >= 1920 || screenHeight >= 1080
  
  // PERFORMANCE: Begræns pixel ratio på store skærme for at reducere rendering load
  // På 27" Retina skærme kan devicePixelRatio være 2.0, som renderer 4x så mange pixels
  let maxPixelRatio = window.devicePixelRatio
  if (isLargeScreen) {
    maxPixelRatio = Math.min(window.devicePixelRatio, 1.0) // Store skærme: cap ved 1.0
  } else if (isMediumScreen) {
    maxPixelRatio = Math.min(window.devicePixelRatio, 1.5) // Medium skærme: cap ved 1.5
  }
  
  // PERFORMANCE: Disable antialiasing på store skærme (pixels er små nok til at det ikke ses)
  const useAntialiasing = !isLargeScreen
  
  // Opret renderer med adaptive settings
  renderer = new THREE.WebGLRenderer({ antialias: useAntialiasing })
  renderer.setSize(screenWidth, screenHeight)
  renderer.setPixelRatio(maxPixelRatio)
  renderer.shadowMap.enabled = true // Aktivér skygger
  // PERFORMANCE: Brug hurtigere shadow map type på store skærme
  renderer.shadowMap.type = isLargeScreen ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap
  containerRef.value.appendChild(renderer.domElement)
  
  console.log(`[PERFORMANCE] Screen: ${screenWidth}x${screenHeight}, PixelRatio: ${maxPixelRatio.toFixed(2)}, Antialiasing: ${useAntialiasing}, LargeScreen: ${isLargeScreen}`)
  
  // Texture loader (bruges til alle teksturer)
  const textureLoader = new THREE.TextureLoader()
  
  // ===== WARM-UP SYSTEM =====
  // Preloader alle nødvendige ressourcer før scenen vises
  let warmUpTotalItems = 0
  let warmUpLoadedItems = 0
  
  const updateWarmUpProgress = (statusText) => {
    warmUpLoadedItems++
    const progress = warmUpTotalItems > 0 ? Math.round((warmUpLoadedItems / warmUpTotalItems) * 100) : 0
    warmUpProgress.value = progress
    if (statusText) warmUpStatus.value = statusText
  }
  
  // Promise-baseret tekstur loading
  const loadTextureAsync = (path) => {
    return new Promise((resolve, reject) => {
      textureLoader.load(
        path,
        (texture) => resolve(texture),
        undefined,
        (error) => reject(error)
      )
    })
  }
  
  // Audio filer der skal preloades
  const audioFiles = [
    { path: '/sound/Field with Wind, Swallows, & Windchimes - Happy Summer moments 4K NO LOOP.mp3', name: 'nature' },
    { path: '/sound/metalGate.mp3', name: 'metalGate' },
    { path: '/sound/water.mp3', name: 'water' },
    { path: '/sound/bee.wav', name: 'bask' },
    { path: '/Speak/lydklip1.mp3', name: 'speech' },
    { path: '/Speak/lydklip2.mp3', name: 'speech2' },
    { path: '/Speak/lydklip3.mp3', name: 'speech3' },
    { path: '/Speak/lydklip4.mp3', name: 'speech4' },
    { path: '/Speak/lydklip5.mp3', name: 'speech5' },
    { path: '/Speak/lydklip6.mp3', name: 'speech6' },
    { path: '/Speak/lydklip7.mp3', name: 'speech7' },
    { path: '/Speak/lydklip8.mp3', name: 'speech8' }
  ]
  
  // Preload audio og vent på at den er loadet
  const preloadAudio = (audioFile) => {
    return new Promise((resolve) => {
      const audio = new Audio(audioFile.path)
      audio.preload = 'auto'
      
      const onCanPlayThrough = () => {
        audio.removeEventListener('canplaythrough', onCanPlayThrough)
        audio.removeEventListener('error', onError)
        resolve({ audio, name: audioFile.name, success: true })
      }
      
      const onError = () => {
        audio.removeEventListener('canplaythrough', onCanPlayThrough)
        audio.removeEventListener('error', onError)
        resolve({ audio: null, name: audioFile.name, success: false })
      }
      
      audio.addEventListener('canplaythrough', onCanPlayThrough)
      audio.addEventListener('error', onError)
      audio.load()
      
      // Timeout efter 10 sekunder
      setTimeout(() => {
        audio.removeEventListener('canplaythrough', onCanPlayThrough)
        audio.removeEventListener('error', onError)
        resolve({ audio, name: audioFile.name, success: true }) // Resolve anyway
      }, 10000)
    })
  }
  
  // Warm-up funktion der preloader alle initielle ressourcer
  const performWarmUp = async () => {
    // Preload ALLE billeder for at undgå lag under scrolling
    const imagesToPreload = imageConfigs
    
    // Case billeder der skal preloades
    const caseImages = [
      '/pics/casesPics/acoastalgarden-min.jpg',
      '/pics/casesPics/acottagegarden-min.jpg',
      '/pics/casesPics/AModernGarden-min.png',
      '/pics/casesPics/aruralgarden-min.jpg',
      '/pics/casesPics/beachhouse-min.jpg',
      '/pics/casesPics/brightongarden-min.jpg',
      '/pics/casesPics/cobham-min.jpg',
      '/pics/casesPics/copenhagengarden-min.jpg',
      '/pics/casesPics/courtyardgarden-min.png',
      '/pics/casesPics/cphgarden-min.jpg',
      '/pics/casesPics/entertainmentgarden-min.jpg',
      '/pics/casesPics/londongarden-min.jpg',
      '/pics/casesPics/Our-Landscape-Designs-Oxshott-Garden-Plan-Ourlandscapedesigns.com_-min-min.png',
      '/pics/casesPics/Our-Landscape-Designs-garden-design-designer-Ourlandscapedesigns.com-copy-min-min.jpg',
      '/pics/casesPics/stgeorgeshill-min.png',
      '/pics/casesPics/summerhouse-min.jpg',
      '/pics/casesPics/tudorhouse.jpg'
    ]
    
    // Total items: paper texture + brush model + scene billeder + case billeder + audio filer (pen model ikke på landing)
    warmUpTotalItems = 2 + imagesToPreload.length + caseImages.length + audioFiles.length
    warmUpLoadedItems = 0
    warmUpProgress.value = 0
    warmUpStatus.value = 'Initializing...'
    
    // Force Vue reactivity update
    await new Promise(resolve => setTimeout(resolve, 10))
    
    try {
      // 1-2. Load papir tekstur + brush model parallelt (pen model blyant.glb ikke på landing page)
      warmUpStatus.value = 'Loading textures & models...'
      const [loadedPaperTexture] = await Promise.all([
        loadTextureAsync('/texture/paper.png'),
        loadBrushModelAsync().then(() => updateWarmUpProgress('Brush model loaded'))
      ])
      
      // Setup papir tekstur
      paperTexture = loadedPaperTexture
      paperTexture.wrapS = THREE.RepeatWrapping
      paperTexture.wrapT = THREE.RepeatWrapping
      paperTexture.repeat.set(8, 8)
      paperTexture.magFilter = THREE.LinearFilter
      paperTexture.minFilter = THREE.LinearMipmapLinearFilter
      paperTexture.generateMipmaps = true
      paperTexture.anisotropy = renderer.capabilities.getMaxAnisotropy() || 16
      if (plane && plane.material) {
        plane.material.map = paperTexture
        plane.material.needsUpdate = true
      }
      renderer.initTexture(paperTexture)
      updateWarmUpProgress('Paper texture loaded')
      
      // 4. Preload ALLE scene billeder parallelt (concurrency: 5)
      warmUpStatus.value = `Preloading ${imagesToPreload.length} scene images...`
      
      {
        let sceneLoaded = 0
        const sceneLoadTasks = imagesToPreload.map((config) => {
          const imageData = sceneImages.find(img => img.config.path === config.path && 
            img.config.position[0] === config.position[0] &&
            img.config.position[1] === config.position[1] &&
            img.config.position[2] === config.position[2])
          return { config, imageData }
        })
        
        let taskIndex = 0
        const runWorker = async () => {
          while (taskIndex < sceneLoadTasks.length) {
            const idx = taskIndex++
            const { imageData } = sceneLoadTasks[idx]
            if (imageData && !imageData.textureLoaded && !imageData.textureLoading) {
              await loadImageTextureAsync(imageData)
              if (imageData.texture) {
                renderer.initTexture(imageData.texture)
              }
            }
            sceneLoaded++
            warmUpStatus.value = `Preloading scene image ${sceneLoaded}/${imagesToPreload.length}...`
            updateWarmUpProgress(`Scene image ${sceneLoaded}/${imagesToPreload.length} loaded`)
          }
        }
        await Promise.all(Array.from({ length: Math.min(5, sceneLoadTasks.length) }, runWorker))
      }
      
      // 5. Preload case billeder parallelt (concurrency: 5)
      warmUpStatus.value = `Preloading ${caseImages.length} case images...`
      
      {
        let caseLoaded = 0
        let caseTaskIndex = 0
        const runCaseWorker = async () => {
          while (caseTaskIndex < caseImages.length) {
            const idx = caseTaskIndex++
            const imagePath = caseImages[idx]
            try {
              const texture = await loadTextureAsync(imagePath)
              renderer.initTexture(texture)
            } catch (error) {
              console.warn(`Failed to preload case image: ${imagePath}`, error)
            }
            caseLoaded++
            warmUpStatus.value = `Preloading case image ${caseLoaded}/${caseImages.length}...`
            updateWarmUpProgress(`Case image ${caseLoaded}/${caseImages.length} loaded`)
          }
        }
        await Promise.all(Array.from({ length: Math.min(5, caseImages.length) }, runCaseWorker))
      }
      
      // 6. Preload alle audio filer parallelt (ingen delays)
      warmUpStatus.value = `Preloading ${audioFiles.length} audio files...`
      
      const audioResults = await Promise.all(audioFiles.map(async (audioFile) => {
        const result = await preloadAudio(audioFile)
        updateWarmUpProgress(`Audio ${result.name} loaded`)
        return result
      }))
      
      // Gem audio references
      for (const result of audioResults) {
        if (result.success && result.audio) {
          switch (result.name) {
            case 'nature':
              natureAudio = result.audio
              natureAudio.loop = true
              natureAudio.volume = audioMaxVolume
              break
            case 'metalGate':
              metalGateAudio = result.audio
              metalGateAudio.loop = false
              metalGateAudio.volume = 0.7
              break
            case 'water':
              waterAudio = result.audio
              waterAudio.loop = false
              waterAudio.volume = 0.3
              break
            case 'bask':
              baskAudio = result.audio
              baskAudio.loop = false
              baskAudio.volume = 0.6
              break
            case 'speech':
              speechAudio = result.audio
              speechAudio.loop = false
              speechAudio.volume = 1.0
              speechAudio.playbackRate = SPEECH_PLAYBACK_RATE
              break
            case 'speech2':
              speech2Audio = result.audio
              speech2Audio.loop = false
              speech2Audio.volume = 1.0
              speech2Audio.playbackRate = SPEECH_PLAYBACK_RATE
              break
            case 'speech3':
              speech3Audio = result.audio
              speech3Audio.loop = false
              speech3Audio.volume = 1.0
              speech3Audio.playbackRate = SPEECH_PLAYBACK_RATE
              break
            case 'speech4':
              speech4Audio = result.audio
              speech4Audio.loop = false
              speech4Audio.volume = 1.0
              speech4Audio.playbackRate = SPEECH_PLAYBACK_RATE
              break
            case 'speech5':
              speech5Audio = result.audio
              speech5Audio.loop = false
              speech5Audio.volume = 1.0
              speech5Audio.playbackRate = SPEECH_PLAYBACK_RATE
              break
            case 'speech6':
              speech6Audio = result.audio
              speech6Audio.loop = false
              speech6Audio.volume = 1.0
              speech6Audio.playbackRate = SPEECH_PLAYBACK_RATE
              break
            case 'speech7':
              speech7Audio = result.audio
              speech7Audio.loop = false
              speech7Audio.volume = 1.0
              speech7Audio.playbackRate = SPEECH_PLAYBACK_RATE
              break
            case 'speech8':
              speech8Audio = result.audio
              speech8Audio.loop = false
              speech8Audio.volume = 1.0
              speech8Audio.playbackRate = SPEECH_PLAYBACK_RATE
              break
          }
        }
      }
      warmUpStatus.value = 'Audio preloaded'
      
      // 7. GPU warm-up: render et par frames for at kompilere shaders (reduceret, ingen delays)
      warmUpStatus.value = 'Warming up GPU...'
      
      const originalCameraPos = camera.position.clone()
      const originalCameraRot = camera.rotation.clone()
      
      // 4 frames er nok til at kompilere shaders og uploade teksturer
      const gpuWarmUpFrames = 4
      for (let i = 0; i <= gpuWarmUpFrames; i++) {
        const t = i / gpuWarmUpFrames
        const pathPoint = cameraPath.getPoint(t)
        camera.position.copy(pathPoint)
        
        sceneImages.forEach(img => {
          if (img.imagePlane) img.imagePlane.visible = true
          if (img.shadowPlane) img.shadowPlane.visible = true
        })
        
        renderer.render(scene, camera)
        
        const gpuProgress = 95 + Math.round((i / gpuWarmUpFrames) * 5)
        warmUpProgress.value = Math.min(100, gpuProgress)
        warmUpStatus.value = `Warming up GPU... ${gpuProgress}%`
      }
      
      // Finalizing
      warmUpStatus.value = 'Finalizing...'
      warmUpProgress.value = 100
      renderer.render(scene, camera)
      
      // Hvis vi vender tilbage fra en anden side, behold den gemte position
      if (!isReturningFromPage) {
        // Gendan kamera position til LANDING position (ikke bare original)
        camera.position.copy(landingCameraPosition)
        camera.lookAt(landingCameraLookAt)
        
        // Reset smooth interpolation variabler til landing
        currentCameraPosition = landingCameraPosition.clone()
        targetCameraPosition = landingCameraPosition.clone()
        currentLookAt = landingCameraLookAt.clone()
        targetLookAt = landingCameraLookAt.clone()
        
        // Reset scroll state
        scrollProgress = 0
        targetScrollProgress = 0
        totalScroll = 0
        
        // Under landing fase skal billeder og skygger være synlige
        // Sikr at alle billeder er klar og synlige på landing page
        sceneImages.forEach(img => {
          // Billederne skal være synlige på landing page
          if (img.imagePlane) {
            img.imagePlane.visible = true
            // Sikr at billedet har tekstur hvis den er loadet
            if (img.textureLoaded && img.texture && img.imagePlane.material) {
              if (img.imagePlane.material.uniforms && img.imagePlane.material.uniforms.uTexture) {
                img.imagePlane.material.uniforms.uTexture.value = img.texture
              }
              // Sikr at wipe progress er sat til 1 så billedet er fuldt synligt
              if (img.imagePlane.material.uniforms && img.imagePlane.material.uniforms.uWipeProgress) {
                img.imagePlane.material.uniforms.uWipeProgress.value = 1.0
              }
              img.imagePlane.material.opacity = 1.0
              img.imagePlane.material.transparent = true
              img.imagePlane.material.needsUpdate = true
            }
            // Opdater wipe progress tracking
            img.wipeProgress = 1.0
          }
          
          // Shadow planes skal være klar og kaste skygger under landing fase
          if (img.shadowPlane) {
            img.shadowPlane.visible = true
            img.shadowPlane.castShadow = true // Aktiver skygge-kastning
            // Sikr at shadow plane har tekstur hvis billedet har tekstur
            if (img.textureLoaded && img.texture && img.shadowPlane.material) {
              img.shadowPlane.material.map = img.texture
              img.shadowPlane.material.opacity = 1.0
              img.shadowPlane.material.transparent = true
              img.shadowPlane.material.needsUpdate = true
            }
            img.lastShadowProgress = 1.0 // Fuld skygge på landing page
          }
        })
        
        // Sikr at scenens baggrund er sat korrekt så horisonten er synlig
        if (scene.background === null) {
          scene.background = new THREE.Color(0xF0EEE9)
        }
        
        // Sikr at fog er aktiv
        if (!scene.fog) {
          scene.fog = new THREE.FogExp2(0xF0EEE9, 0.13)
        }
        
        // Verificer at alle teksturer faktisk er loadet
        const allTexturesLoaded = sceneImages.every(img => img.textureLoaded || !img.config)
        if (!allTexturesLoaded) {
          console.warn('⚠️ Not all textures loaded, waiting...')
          warmUpStatus.value = 'Waiting for remaining textures...'
          // Vent ekstra hvis ikke alle teksturer er loadet
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        // Progress er nu 100%, vis "Ready!" og forsvind hurtigt
        warmUpStatus.value = 'Ready!'
        
        // Meget kort ventetid så brugeren kan se "Ready!" beskeden
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Marker at hele 3D oplevelsen er loadet og klar
        isWarmedUp.value = true
        
        // Mobil: Lås speech audio op ved første touch (iOS Safari kræver user gesture)
        const handleFirstTouch = () => {
          if (!soundClicked.value) {
            soundClicked.value = true
            if (natureAudio && atmosphereEnabled.value && natureAudio.paused) {
              natureAudio.play().catch(() => {})
            }
            unlockSpeechAudioForMobile()
          }
        }
        window.addEventListener('touchstart', handleFirstTouch, { passive: true, once: true })
        
        // Start landing page animation - hele 3D oplevelsen er nu loadet
        if (!isReturningFromPage) {
          // Sikr at landing logo er synligt når warm-up er færdig
          landingLogoOpacity.value = 1
          landingAnimationStarted.value = true
        }
      } else {
        // Returning from another page - set camera to saved position
        if (cameraPath && scrollProgress >= landingScrollThreshold) {
          // Calculate camera position based on saved scroll progress
          let t
          if (scrollProgress < cameraStartThreshold) {
            t = 0
          } else {
            t = Math.min(pathEndPoint, (scrollProgress - cameraStartThreshold) / (1 - cameraStartThreshold) * pathEndPoint)
          }
          
          // Sikr at t aldrig overstiger pathEndPoint
          t = Math.min(pathEndPoint, t)
          
          const cameraPos = cameraPath.getPoint(t)
          
          // Kig mod et punkt lidt fremme på pathen
          // Når vi nærmer os pathEndPoint, smooth overgang til tangent-baseret lookAt
          let lookAtPos
          if (t < pathEndPoint - 0.1) {
            // Normal: kig mod et punkt lidt fremme på pathen
            const lookAheadT = t + 0.1
            lookAtPos = cameraPath.getPoint(lookAheadT)
          } else {
            // Overgangszone: smooth interpolation fra normal til tangent-baseret
            const transitionProgress = (t - (pathEndPoint - 0.1)) / 0.1
            const normalLookAt = cameraPath.getPoint(pathEndPoint)
            const tangent = cameraPath.getTangent(pathEndPoint - 0.1)
            const tangentLookAt = cameraPos.clone().add(tangent.multiplyScalar(1))
            lookAtPos = new THREE.Vector3().lerpVectors(normalLookAt, tangentLookAt, transitionProgress)
          }
          
          // Hold lookAt i niveau med kameraet så vi ikke kigger opad
          lookAtPos.y = cameraPos.y
          
          camera.position.copy(cameraPos)
          camera.lookAt(lookAtPos)
          
          currentCameraPosition = cameraPos.clone()
          targetCameraPosition = cameraPos.clone()
          currentLookAt = lookAtPos.clone()
          targetLookAt = lookAtPos.clone()
        }
        
        // Mobil: Lås speech audio op ved første touch (iOS Safari)
        const handleFirstTouchReturn = () => {
          if (!soundClicked.value) {
            soundClicked.value = true
            if (natureAudio && atmosphereEnabled.value && natureAudio.paused) {
              natureAudio.play().catch(() => {})
            }
            unlockSpeechAudioForMobile()
          }
        }
        window.addEventListener('touchstart', handleFirstTouchReturn, { passive: true, once: true })
        
        // isWarmedUp is already set to true earlier
      }
      
    } catch (error) {
      console.error('Warm-up fejl:', error)
      // Opdater progress selv ved fejl
      warmUpStatus.value = 'Error during loading, continuing...'
      warmUpProgress.value = 100
      // Fortsæt alligevel selvom warm-up fejler
      await new Promise(resolve => setTimeout(resolve, 300))
      isWarmedUp.value = true
    }
  }
  
  // Async version af loadImageTexture for warm-up
  const loadImageTextureAsync = (imageData) => {
    return new Promise((resolve) => {
      if (imageData.textureLoaded || imageData.textureLoading) {
        resolve()
        return
      }
      
      imageData.textureLoading = true
      const config = imageData.config
      
      textureLoader.load(config.path, (loadedTexture) => {
        const aspect = loadedTexture.image.width / loadedTexture.image.height
        const imageWidth = config.size
        const imageHeight = config.size / aspect
        
        if (imageData.imagePlane) {
          imageData.imagePlane.geometry.dispose()
          imageData.imagePlane.geometry = new THREE.PlaneGeometry(imageWidth, imageHeight)
        }
        
        if (imageData.shadowPlane) {
          imageData.shadowPlane.geometry.dispose()
          imageData.shadowPlane.geometry = new THREE.PlaneGeometry(imageWidth, imageHeight)
          if (imageData.shadowPlane.material) {
            imageData.shadowPlane.material.map = loadedTexture
            imageData.shadowPlane.material.needsUpdate = true
          }
        }
        
        if (imageData.imagePlane && imageData.imagePlane.material && imageData.imagePlane.material.uniforms) {
          imageData.imagePlane.material.uniforms.uTexture.value = loadedTexture
        }
        
        imageData.texture = loadedTexture
        imageData.textureLoaded = true
        imageData.textureLoading = false
        resolve()
      }, undefined, () => {
        // Ved fejl, marker som loaded alligevel for at undgå infinite loading
        imageData.textureLoading = false
        resolve()
      })
    })
  }
  
  // Async version af pen model loading for warm-up
  const loadPenModelAsync = () => {
    return new Promise((resolve, reject) => {
      const gltfLoader = new GLTFLoader()
      gltfLoader.load('/obj/blyant.glb', (gltf) => {
        penModel = gltf.scene
        penModel.position.set(-3, 0.08, 16)
        penModel.rotation.set(0, 0.0, 0)
        penModel.scale.set(2, 2, 2)
        
        // Erstat materialer med wipe shader material
        penModel.traverse((child) => {
          if (child.isMesh) {
            const originalMaterial = child.material
            let baseColor = new THREE.Color(0x888888)
            let texture = null
            let hasTexture = false
            
            if (originalMaterial) {
              const material = Array.isArray(originalMaterial) ? originalMaterial[0] : originalMaterial
              
              if (material.color) {
                baseColor = material.color.clone()
              }
              
              if (material.map) {
                texture = material.map
                hasTexture = true
              } else if (material.emissiveMap) {
                texture = material.emissiveMap
                hasTexture = true
              } else if (material.normalMap) {
                texture = material.normalMap
                hasTexture = true
              }
            }
            
            const brightBaseColor = baseColor.clone()
            brightBaseColor.r = Math.min(1.0, brightBaseColor.r * 1.2)
            brightBaseColor.g = Math.min(1.0, brightBaseColor.g * 1.2)
            brightBaseColor.b = Math.min(1.0, brightBaseColor.b * 1.2)
            brightBaseColor.r = Math.max(0.4, brightBaseColor.r)
            brightBaseColor.g = Math.max(0.4, brightBaseColor.g)
            brightBaseColor.b = Math.max(0.4, brightBaseColor.b)
            
            const wipeMaterial = new THREE.ShaderMaterial({
              uniforms: {
                uTexture: { value: texture },
                uWipeProgress: { value: 0.0 },
                uColor: { value: new THREE.Color(0xffffff) },
                uBaseColor: { value: brightBaseColor },
                uHasTexture: { value: hasTexture }
              },
              vertexShader: modelWipeVertexShader,
              fragmentShader: modelWipeFragmentShader,
              transparent: true,
              side: THREE.DoubleSide
            })
            
            child.material = wipeMaterial
            child.castShadow = true
            child.receiveShadow = false
          }
        })
        
        scene.add(penModel)
        resolve()
      }, undefined, (error) => {
        console.error('Error loading pen model:', error)
        resolve() // Resolve alligevel så warm-up kan fortsætte
      })
    })
  }
  
  // Async version af brush model loading for warm-up
  const loadBrushModelAsync = () => {
    return new Promise((resolve, reject) => {
      const gltfLoader = new GLTFLoader()
      gltfLoader.load('/obj/brushing1.glb', (gltf) => {
        brushModel = gltf.scene
        brushModel.position.set(-7, 0.08, -13)
        brushModel.rotation.set(0.0, -3, 0.0)
        brushModel.scale.set(2, 2, 2)
        
        // Bevar originale materialer og tilføj transparency for wipe-effekt
        brushModel.traverse((child) => {
          if (child.isMesh) {
            // Håndter både enkelt material og material arrays
            const materials = Array.isArray(child.material) ? child.material : [child.material]
            
            materials.forEach((material) => {
              if (material) {
                // Gør materialet transparent så vi kan animere opacity
                material.transparent = true
                material.opacity = 0 // Start usynlig
                material.side = THREE.DoubleSide

                // Mørkner farven lidt for at undgå udvasket look
                if (material.color && material.color.isColor) {
                  material.color.multiplyScalar(0.75)
                }
                if (material.emissive && material.emissive.isColor) {
                  material.emissive.multiplyScalar(0.9)
                }

                material.needsUpdate = true
              }
            })

            // Undgå at Three.js culler (skjuler) mesh'en ved forkert bounding-sphere
            // især relevant for skinned/animable meshes der kan have forkert bounds
            child.frustumCulled = false

            child.castShadow = true
            child.receiveShadow = false
          }
        })
        
        scene.add(brushModel)
        resolve()
      }, undefined, (error) => {
        console.error('Error loading brush model:', error)
        resolve() // Resolve alligevel så warm-up kan fortsætte
      })
    })
  }
  
  // Load papir tekstur synkront til start (opdateres af warm-up)
  paperTexture = null // Sættes af warm-up
  
  // Opret bump map for papir struktur
  const createBumpTexture = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 2048 // Øget opløsning for mere detaljer
    canvas.height = 2048
    const ctx = canvas.getContext('2d')
    
    const noise = (x, y) => {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
      return (n - Math.floor(n))
    }
    
    const smoothNoise = (x, y) => {
      const intX = Math.floor(x)
      const intY = Math.floor(y)
      const fracX = x - intX
      const fracY = y - intY
      
      const v1 = noise(intX, intY)
      const v2 = noise(intX + 1, intY)
      const v3 = noise(intX, intY + 1)
      const v4 = noise(intX + 1, intY + 1)
      
      const i1 = v1 * (1 - fracX) + v2 * fracX
      const i2 = v3 * (1 - fracX) + v4 * fracX
      return i1 * (1 - fracY) + i2 * fracY
    }
    
    const fractalNoise = (x, y) => {
      let value = 0
      let amplitude = 1
      let frequency = 0.02
      
      for (let i = 0; i < 4; i++) { // Øget fra 3 til 4 lag for mere detaljer
        value += smoothNoise(x * frequency, y * frequency) * amplitude
        amplitude *= 0.5
        frequency *= 2
      }
      return value
    }
    
    const imageData = ctx.createImageData(canvas.width, canvas.height)
    const data = imageData.data
    
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const index = (y * canvas.width + x) * 4
        
        const n = fractalNoise(x, y)
        const bump = Math.floor(n * 128 + 127) // Grayscale for bump
        
        data[index] = bump     // R
        data[index + 1] = bump // G
        data[index + 2] = bump // B
        data[index + 3] = 255  // Alpha
      }
    }
    
    ctx.putImageData(imageData, 0, 0)
    
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(4, 4) // Øget repeat for mere detaljeret bump mapping
    texture.magFilter = THREE.LinearFilter
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.generateMipmaps = true
    return texture
  }
  
  bumpTexture = createBumpTexture()
  
  // Opret et stort plan (paper texture tilføjes af warm-up)
  const planeGeometry = new THREE.PlaneGeometry(75, 75, 50, 50) // Øget segments for mere detaljeret geometri
  const planeMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffffff, // Hvidt papir
    map: null, // Sættes af warm-up
    bumpMap: bumpTexture,
    bumpScale: 0.25, // Øget for mere synlig bump mapping
    emissive: 0xffffff, // Hvid emissive
    emissiveIntensity: 0.1, // Lav emissive for at teksturen stadig er synlig
    side: THREE.DoubleSide
  })
  plane = new THREE.Mesh(planeGeometry, planeMaterial)
  plane.rotation.x = -Math.PI / 2 // Roter planen så den ligger fladt
  plane.receiveShadow = true // Modtag skygger på planen
  scene.add(plane)
  
  // Tilføj gitter grid til planen
  gridHelper = new THREE.GridHelper(50, 50, 0x888888, 0xaaaaaa)
  gridHelper.position.y = -0.10 // Lidt over planen for at undgå z-fighting
  scene.add(gridHelper)
  
  
  // Custom shader for gradient wipe effekt (deles af alle billeder)
  const gradientWipeVertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `
  
  const gradientWipeFragmentShader = `
    uniform sampler2D uTexture;
    uniform float uWipeProgress;
    uniform vec3 uColor;
    varying vec2 vUv;
    
    // Noise funktioner for gradient mask
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
    
    float noise(vec2 st) {
      vec2 i = floor(st);
      vec2 f = fract(st);
      float a = random(i);
      float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0));
      float d = random(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    
    float fbm(vec2 st) {
      float value = 0.0;
      float amplitude = 0.5;
      for(int i = 0; i < 3; i++) {
        value += amplitude * noise(st);
        st *= 2.0;
        amplitude *= 0.5;
      }
      return value;
    }
    
    void main() {
      vec4 texColor = texture2D(uTexture, vUv);
      
      // Skab gradient mask baseret kun på noise - ingen lineær gradient
      vec2 gradientCoord = vUv * vec2(6.0, 5.0);
      
      // Optimeret: reduceret fra 3 til 2 noise lag for bedre performance (~33% hurtigere)
      float noise1 = fbm(gradientCoord);
      float noise2 = fbm(gradientCoord * 1.5 + vec2(10.0));
      
      // Kombiner noise lag for organisk pattern (bevarer visuel kvalitet)
      float gradientMask = (noise1 * 0.6 + noise2 * 0.4);
      
      // After Effects gradient wipe: sammenlign gradient mask med progress
      float reveal = step(gradientMask, uWipeProgress);
      
      // Anvend reveal til alpha
      float alpha = texColor.a * reveal;
      
      // Anvend farve til teksturen
      vec3 finalColor = texColor.rgb * uColor;
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `
  
  // Custom shader for 3D model wipe effekt (samme som billeder, men uden texture)
  const modelWipeVertexShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    void main() {
      vUv = uv;
      vPosition = position;
      vNormal = normal;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `
  
  const modelWipeFragmentShader = `
    uniform sampler2D uTexture;
    uniform float uWipeProgress;
    uniform vec3 uColor;
    uniform vec3 uBaseColor;
    uniform bool uHasTexture;
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    
    // Noise funktioner for gradient mask (samme som billeder)
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
    
    float noise(vec2 st) {
      vec2 i = floor(st);
      vec2 f = fract(st);
      float a = random(i);
      float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0));
      float d = random(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    
    float fbm(vec2 st) {
      float value = 0.0;
      float amplitude = 0.5;
      for(int i = 0; i < 3; i++) {
        value += amplitude * noise(st);
        st *= 2.0;
        amplitude *= 0.5;
      }
      return value;
    }
    
    void main() {
      // Brug UV koordinater eller position for gradient mask
      vec2 gradientCoord = vUv * vec2(6.0, 5.0);
      
      float noise1 = fbm(gradientCoord);
      float noise2 = fbm(gradientCoord * 1.5 + vec2(10.0));
      
      float gradientMask = (noise1 * 0.6 + noise2 * 0.4);
      
      // After Effects gradient wipe: sammenlign gradient mask med progress
      float reveal = step(gradientMask, uWipeProgress);
      
      // Hent farve fra tekstur hvis den findes, ellers brug baseColor
      vec3 finalColor;
      if (uHasTexture) {
        vec4 texColor = texture2D(uTexture, vUv);
        // Lidt mørkere - multiplicer tekstur farve med moderat værdi
        vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
        float lightIntensity = max(dot(normalize(vNormal), lightDir), 0.6);
        float ambient = 0.7; // Modereret ambient
        finalColor = texColor.rgb * (lightIntensity + ambient) * 1.0;
      } else {
        // Beregn farve med simpel lighting - moderat brightness
        vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
        float lightIntensity = max(dot(normalize(vNormal), lightDir), 0.6);
        // Modereret ambient lighting
        float ambient = 0.8;
        // Multiplicer med moderat værdi
        finalColor = uBaseColor * (lightIntensity + ambient) * 1.2;
      }
      
      // Anvend reveal til alpha
      float alpha = reveal;
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `
  
  // Custom shader for brush model wipe effekt (bevarer originale farver)
  const brushWipeVertexShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec3 vWorldNormal;
    void main() {
      vUv = uv;
      vPosition = position;
      vNormal = normal;
      
      // Beregn world position og normal for refleksioner
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `
  
  const brushWipeFragmentShader = `
    uniform sampler2D uTexture;
    uniform float uWipeProgress;
    uniform vec3 uColor;
    uniform vec3 uBaseColor;
    uniform bool uHasTexture;
    uniform float uRoughness;
    uniform float uMetalness;
    uniform vec3 cameraPosition;
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec3 vWorldNormal;
    
    // Noise funktioner for gradient mask (samme som billeder)
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
    
    float noise(vec2 st) {
      vec2 i = floor(st);
      vec2 f = fract(st);
      float a = random(i);
      float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0));
      float d = random(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    
    float fbm(vec2 st) {
      float value = 0.0;
      float amplitude = 0.5;
      for(int i = 0; i < 3; i++) {
        value += amplitude * noise(st);
        st *= 2.0;
        amplitude *= 0.5;
      }
      return value;
    }
    
    void main() {
      // Brug UV koordinater eller position for gradient mask
      vec2 gradientCoord = vUv * vec2(6.0, 5.0);
      
      float noise1 = fbm(gradientCoord);
      float noise2 = fbm(gradientCoord * 1.5 + vec2(10.0));
      
      float gradientMask = (noise1 * 0.6 + noise2 * 0.4);
      
      // After Effects gradient wipe: sammenlign gradient mask med progress
      float reveal = step(gradientMask, uWipeProgress);
      
      // Beregn view direction for refleksioner
      // Sikr at cameraPosition er gyldig (ikke nul)
      vec3 safeCameraPos = length(cameraPosition) > 0.0 ? cameraPosition : vec3(0.0, 0.0, 5.0);
      vec3 viewDir = normalize(safeCameraPos - vWorldPosition);
      vec3 normal = normalize(vWorldNormal);
      
      // Hent farve fra tekstur hvis den findes, ellers brug baseColor
      vec3 albedo;
      if (uHasTexture) {
        vec4 texColor = texture2D(uTexture, vUv);
        albedo = texColor.rgb;
      } else {
        albedo = uBaseColor;
      }
      
      // Beregn lighting
      vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
      float lightIntensity = max(dot(normal, lightDir), 0.6);
      float ambient = 0.7;
      
      // Beregn specular highlight (refleksioner)
      vec3 halfDir = normalize(lightDir + viewDir);
      float specularAngle = max(dot(normal, halfDir), 0.0);
      // Glossiness er omvendt af roughness
      float glossiness = 1.0 - uRoughness;
      float specularPower = mix(32.0, 256.0, glossiness);
      float specular = pow(specularAngle, specularPower) * glossiness;
      
      // Beregn refleksion (environment mapping approximation)
      float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.0);
      float reflectionIntensity = mix(0.0, 0.4, glossiness) * fresnel;
      
      // Kombiner diffuse, specular og refleksion
      vec3 diffuse = albedo * (lightIntensity + ambient);
      vec3 specularColor = vec3(1.0) * specular * 0.5;
      vec3 reflectionColor = vec3(0.95, 0.97, 1.0) * reflectionIntensity;
      
      // Start med diffuse som base
      vec3 finalColor = diffuse;
      
      // Tilføj specular highlight
      finalColor += specularColor;
      
      // Tilføj refleksion (subtil)
      finalColor += reflectionColor;
      
      // Sikr at farven er synlig
      finalColor = max(finalColor, albedo * 0.3);
      
      // Anvend reveal til alpha
      float alpha = reveal;
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `
  
  // Custom shader for shadow plane med animeret opacity
  const shadowVertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `
  
  const shadowFragmentShader = `
    uniform sampler2D uTexture;
    uniform float uShadowOpacity;
    varying vec2 vUv;
    
    void main() {
      vec4 texColor = texture2D(uTexture, vUv);
      
      // Brug teksturens alpha og moduler med shadow opacity
      float alpha = texColor.a * uShadowOpacity;
      
      // Sort skygge farve
      vec3 shadowColor = vec3(0.0, 0.0, 0.0);
      
      gl_FragColor = vec4(shadowColor, alpha);
    }
  `
  
  // Lazy loading distance - billeder loader først når kameraet er inden for denne afstand
  const lazyLoadDistance = 40 // Afstand hvor billeder begynder at loade (øget for at undgå lag)
  
  // Funktion til at loade tekstur for et billede (lazy loading)
  const loadImageTexture = (imageData) => {
    if (imageData.textureLoaded || imageData.textureLoading) return
    
    imageData.textureLoading = true
    const config = imageData.config
    
    const loadStart = performance.now()
    
    // Load tekstur
    const texture = textureLoader.load(config.path, (loadedTexture) => {
      const loadTime = performance.now() - loadStart
      const updateStart = performance.now()
      
      // Når teksturen er loaded, beregn aspect ratio og opdater størrelse
      const aspect = loadedTexture.image.width / loadedTexture.image.height
      const imageWidth = config.size
      const imageHeight = config.size / aspect
      
      // Opdater geometri med korrekt aspect ratio
      if (imageData.imagePlane) {
        imageData.imagePlane.geometry.dispose()
        imageData.imagePlane.geometry = new THREE.PlaneGeometry(imageWidth, imageHeight)
      }
      
      // Opdater shadow mesh størrelse
      if (imageData.shadowPlane) {
        imageData.shadowPlane.geometry.dispose()
        imageData.shadowPlane.geometry = new THREE.PlaneGeometry(imageWidth, imageHeight)
        // Opdater tekstur i shadow material
        if (imageData.shadowPlane.material) {
          imageData.shadowPlane.material.map = loadedTexture
          imageData.shadowPlane.material.needsUpdate = true
        }
      }
      
      // Opdater tekstur i shader material
      if (imageData.imagePlane && imageData.imagePlane.material && imageData.imagePlane.material.uniforms) {
        imageData.imagePlane.material.uniforms.uTexture.value = loadedTexture
      }
      
      imageData.texture = loadedTexture
      imageData.textureLoaded = true
      imageData.textureLoading = false
    })
  }
  
  // Funktion til at oprette et billede med shader og shadow
  const createSceneImage = (config, index) => {
    const imageData = {
      config: config,
      disposed: false, // Track om billedet er disposed
      imagePlane: null,
      shadowPlane: null,
      texture: null,
      textureLoaded: false, // Lazy loading: tekstur er ikke loaded endnu
      textureLoading: false, // Lazy loading: tekstur er ved at blive loaded
      wipeProgress: 0,
      lastShadowProgress: 0,
      waitForComplete: false, // Bliver true når det billede vi venter på er færdigt
      startScrollProgress: null, // Scroll progress hvor animationen startede (når waitFor er færdig)
      hasBeenFullyVisible: false, // Bliver true når billedet har nået fuld synlighed én gang
      lastImagePosition: null, // Gem sidste position for at undgå unødvendige opdateringer
      lastImageRotation: null // Gem sidste rotation for at undgå unødvendige opdateringer
    }
    
    // LAZY LOADING: Tekstur loades ikke her - den loades først når kameraet kommer tæt nok på
    // Se animation loop hvor loadImageTexture() kaldes baseret på afstand
    
    // Opret shader material for dette billede (starter uden tekstur - lazy loaded)
    const imageMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: null }, // Tekstur sættes senere via lazy loading
        uWipeProgress: { value: 0.0 },
        uColor: { value: new THREE.Color(0xffffff) }
      },
      vertexShader: gradientWipeVertexShader,
      fragmentShader: gradientWipeFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: true // Skriv til depth buffer for korrekt rendering
    })
    
    // Opret plane for billedet
    const imageGeometry = new THREE.PlaneGeometry(config.size, config.size)
    const imagePlane = new THREE.Mesh(imageGeometry, imageMaterial)
    imagePlane.position.set(config.position[0], config.position[1], config.position[2])
    imagePlane.rotation.set(config.rotation[0], config.rotation[1], config.rotation[2])
    imagePlane.renderOrder = 0 // Render efter shadow plane
    scene.add(imagePlane)
    imageData.imagePlane = imagePlane
    
    // Initialiser lastImagePosition og lastImageRotation
    imageData.lastImagePosition = imagePlane.position.clone()
    imageData.lastImageRotation = imagePlane.rotation.clone()
    
    // Opret shadow-only mesh der kaster skygger ned på planen
    // Shadow plane er USYNLIG (colorWrite: false) men kaster stadig skygger
    let shadowPlane = null
    const shadowGeometry = new THREE.PlaneGeometry(config.size, config.size)
    const shadowMaterial = new THREE.MeshStandardMaterial({
      map: null, // Tekstur sættes senere via lazy loading
      transparent: true,
      opacity: 1, // Fuld opacity for skygge-kastning
      alphaTest: 0.01, // Lavere alpha test for bedre skygge-kastning (lavere = mere følsom)
      side: THREE.DoubleSide,
      colorWrite: false, // USYNLIG - kaster kun skygger!
      depthWrite: false
    })
    shadowPlane = new THREE.Mesh(shadowGeometry, shadowMaterial)
    shadowPlane.position.copy(imagePlane.position)
    shadowPlane.rotation.copy(imagePlane.rotation)
    // Flyt shadow plane lidt ned for at undgå z-fighting
    shadowPlane.position.y -= 0.01
    
    shadowPlane.visible = false // Start usynlig (aktiveres når billedet fader ind)
    shadowPlane.castShadow = true // Kast skygger ned på planen
    shadowPlane.receiveShadow = false
    shadowPlane.renderOrder = -1 // Render før image plane
    scene.add(shadowPlane)
    imageData.shadowPlane = shadowPlane
    
    return imageData
  }
  
  // Funktion til at dispose et billede og frigive GPU-ressourcer
  const disposeSceneImage = (imageData) => {
    if (imageData.disposed) return
    
    // Dispose image plane
    if (imageData.imagePlane) {
      scene.remove(imageData.imagePlane)
      if (imageData.imagePlane.geometry) imageData.imagePlane.geometry.dispose()
      if (imageData.imagePlane.material) {
        if (imageData.imagePlane.material.uniforms && imageData.imagePlane.material.uniforms.uTexture) {
          // Dispose texture uniform hvis den findes
          if (imageData.imagePlane.material.uniforms.uTexture.value) {
            imageData.imagePlane.material.uniforms.uTexture.value.dispose()
          }
        }
        imageData.imagePlane.material.dispose()
      }
      imageData.imagePlane = null
    }
    
    // Dispose shadow plane
    if (imageData.shadowPlane) {
      scene.remove(imageData.shadowPlane)
      if (imageData.shadowPlane.geometry) imageData.shadowPlane.geometry.dispose()
      if (imageData.shadowPlane.material) {
        if (imageData.shadowPlane.material.map) {
          imageData.shadowPlane.material.map.dispose()
        }
        imageData.shadowPlane.material.dispose()
      }
      imageData.shadowPlane = null
    }
    
    // Dispose texture
    if (imageData.texture) {
      imageData.texture.dispose()
      imageData.texture = null
    }
    
    // Reset progress tracking
    imageData.wipeProgress = 0
    imageData.lastShadowProgress = 0
    imageData.waitForComplete = false
    imageData.startScrollProgress = null
    // BEHOLD hasBeenFullyVisible - nulstilles IKKE ved dispose/recreate
    imageData.lastImagePosition = null
    imageData.lastImageRotation = null
    
    // Reset lazy loading flags
    imageData.textureLoaded = false
    imageData.textureLoading = false
    
    imageData.disposed = true
  }
  
  // Funktion til at genskabe et disposed billede
  const recreateSceneImage = (imageData) => {
    if (!imageData.disposed) return
    
    const config = imageData.config
    
    // LAZY LOADING: Tekstur loades ikke her - den loades først når kameraet kommer tæt nok på
    // Se animation loop hvor loadImageTexture() kaldes baseret på afstand
    imageData.texture = null
    imageData.textureLoaded = false
    imageData.textureLoading = false
    
    // Opret shader material for dette billede (starter uden tekstur - lazy loaded)
    const imageMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: null }, // Tekstur sættes senere via lazy loading
        uWipeProgress: { value: 0.0 },
        uColor: { value: new THREE.Color(0xffffff) }
      },
      vertexShader: gradientWipeVertexShader,
      fragmentShader: gradientWipeFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: true // Skriv til depth buffer for korrekt rendering
    })
    
    // Opret plane for billedet
    const imageGeometry = new THREE.PlaneGeometry(config.size, config.size)
    const imagePlane = new THREE.Mesh(imageGeometry, imageMaterial)
    imagePlane.position.set(config.position[0], config.position[1], config.position[2])
    imagePlane.rotation.set(config.rotation[0], config.rotation[1], config.rotation[2])
    imagePlane.renderOrder = 0 // Render efter shadow plane
    scene.add(imagePlane)
    imageData.imagePlane = imagePlane
    
    // Initialiser lastImagePosition og lastImageRotation
    imageData.lastImagePosition = imagePlane.position.clone()
    imageData.lastImageRotation = imagePlane.rotation.clone()
    
    // Opret shadow-only mesh der kaster skygger ned på planen
    // Shadow plane er USYNLIG (colorWrite: false) men kaster stadig skygger
    let shadowPlane = null
    const shadowGeometry = new THREE.PlaneGeometry(config.size, config.size)
    const shadowMaterial = new THREE.MeshStandardMaterial({
      map: null, // Tekstur sættes senere via lazy loading
      transparent: true,
      opacity: 1, // Fuld opacity for skygge-kastning
      alphaTest: 0.01, // Lavere alpha test for bedre skygge-kastning (lavere = mere følsom)
      side: THREE.DoubleSide,
      colorWrite: false, // USYNLIG - kaster kun skygger!
      depthWrite: false
    })
    shadowPlane = new THREE.Mesh(shadowGeometry, shadowMaterial)
    shadowPlane.position.copy(imagePlane.position)
    shadowPlane.rotation.copy(imagePlane.rotation)
    // Flyt shadow plane lidt ned for at undgå z-fighting
    shadowPlane.position.y -= 0.01
    
    shadowPlane.visible = false // Start usynlig (aktiveres når billedet fader ind)
    shadowPlane.castShadow = true // Kast skygger ned på planen
    shadowPlane.receiveShadow = false
    shadowPlane.renderOrder = -1 // Render før image plane
    scene.add(shadowPlane)
    imageData.shadowPlane = shadowPlane
    
    // Reset progress tracking
    imageData.wipeProgress = 0
    imageData.lastShadowProgress = 0
    imageData.waitForComplete = false
    imageData.startScrollProgress = null
    // BEHOLD hasBeenFullyVisible - nulstilles IKKE ved dispose/recreate
    
    imageData.disposed = false
  }
  
  // Opret alle billeder fra konfigurationen
  imageConfigs.forEach((config, index) => {
    const imageData = createSceneImage(config, index)
    sceneImages.push(imageData)
  })
  
  // Opret flyvende specs/partikler
  const createParticles = () => {
    if (!cameraPath) {
      console.warn('cameraPath ikke oprettet endnu - venter på path')
      return
    }
    
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const velocities = []
    
    // Bredde omkring pathen hvor partikler kan være (i meter)
    const pathWidth = 12 // Bredere område omkring pathen
    
    // Initialiser partikler langs pathen med jævn fordeling
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3
      
      // Jævn fordeling langs pathen (t går fra 0 til 1)
      const t = i / (particleCount - 1) // 0 til 1
      
      // Få punkt på pathen
      const pathPoint = cameraPath.getPoint(t)
      
      // Beregn tangent (retning) på pathen for at finde vinkelret retning
      const tangentT = Math.min(pathEndPoint, t + 0.01) // Lidt fremme på pathen
      const tangentPoint = cameraPath.getPoint(tangentT)
      const tangent = new THREE.Vector3().subVectors(tangentPoint, pathPoint).normalize()
      
      // Beregn vinkelret retning (til højre for pathen)
      const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize()
      
      // Tilfældig offset vinkelret på pathen (både til højre og venstre)
      const perpendicularOffset = (Math.random() - 0.5) * pathWidth
      
      // Tilfældig offset langs pathen (lidt frem/tilbage)
      const alongPathOffset = (Math.random() - 0.5) * 0.5
      
      // Beregn position: path point + vinkelret offset + langs pathen offset
      const position = pathPoint.clone()
      position.addScaledVector(right, perpendicularOffset)
      position.addScaledVector(tangent, alongPathOffset)
      
      positions[i3] = position.x // X position
      positions[i3 + 1] = Math.random() * 2.5 + 0.5 // Y (tæt på kamera højde 0.5-3)
      positions[i3 + 2] = position.z // Z position
      
      // Tilfældig hastighed (meget langsom og stille)
      velocities.push({
        x: (Math.random() - 0.5) * 0.008,
        y: (Math.random() - 0.5) * 0.004,
        z: (Math.random() - 0.5) * 0.008
      })
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    
    // Opret simpel cirkulær tekstur for partiklerne
    const createCircleTexture = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 32 // Mindre størrelse for bedre performance
      canvas.height = 32
      const ctx = canvas.getContext('2d')
      
      // Simpel solid cirkel
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      const radius = 14
      
      ctx.fillStyle = '#ffffff' // Hvid (farve sættes i material)
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      ctx.fill()
      
      const texture = new THREE.CanvasTexture(canvas)
      return texture
    }
    
    particleCircleTexture = createCircleTexture()
    
    // Material for partiklerne med cirkulær tekstur
    const material = new THREE.PointsMaterial({
      map: particleCircleTexture, // Brug cirkulær tekstur
      color: 0x444444, // Mørkere grå så de kan ses mod hvid baggrund
      size: 0.01, // Meget små specs
      transparent: true,
      opacity: 0.6, // Synlige men subtile
      sizeAttenuation: true, // Størrelse ændres med afstand
      depthWrite: false,
      alphaTest: 0.01 // Fjern transparente pixels
    })
    
    particleSystem = new THREE.Points(geometry, material)
    scene.add(particleSystem)
    
    // Gem velocities så vi kan opdatere dem
    particles = {
      geometry,
      velocities,
      positions
    }
  }
  
  createParticles() // Genaktiveret partikler
  
  // NOTE: Pen model loades nu af warm-up systemet (loadPenModelAsync)
  
  // Tilføj lys (meget stærkt hvidt lys)
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5) // Øget intensitet
  scene.add(ambientLight)
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5) // Øget intensitet
  directionalLight.position.set(10, 10, 5)
  directionalLight.castShadow = true // Kast skygger
  // PERFORMANCE: Reducer shadow map størrelse på store skærme (1024 vs 2048 = 4x færre pixels)
  const shadowMapSize = isLargeScreen ? 1024 : (isMediumScreen ? 1536 : 2048)
  directionalLight.shadow.mapSize.width = shadowMapSize
  directionalLight.shadow.mapSize.height = shadowMapSize
  directionalLight.shadow.camera.near = 0.5
  directionalLight.shadow.camera.far = 50
  directionalLight.shadow.camera.left = -25
  directionalLight.shadow.camera.right = 25
  directionalLight.shadow.camera.top = 25
  directionalLight.shadow.camera.bottom = -25
  directionalLight.shadow.bias = -0.0001 // Reducer shadow acne
  directionalLight.shadow.radius = 2 // Skarpere skygger for bedre synlighed (lavere værdi = skarpere)
  directionalLight.shadow.normalBias = 0.02 // Reducer shadow acne yderligere
  scene.add(directionalLight)
  
  // Reference til ambient light og directional light for at kunne justere dem på landing page
  let ambientLightRef = ambientLight
  let directionalLightRef = directionalLight
  
  // Initialiser frustum objekter for object pooling (genbruges i animation loop)
  frustum = new THREE.Frustum()
  frustumMatrix = new THREE.Matrix4()
  
  // Opdater streg baseret på scroll - følger kameraets path
  const updatePencilLine = () => {
    if (!pencilLine || !cameraPath) return
    
    // Linjen starter bag kameraet og vokser fremad
    // Når linjen når foran kameraet (0), begynder kameraet at følge med
    const lineStartOffset = -0.05 // Start bag kameraet (negativ værdi = bag kameraet, tættere på 0 = hurtigere synlig)
    
    // Beregn hvor langt linjen er kommet baseret på scrollProgress
    // Vi bruger cameraStartThreshold som reference for hvornår linjen skal nå foran kameraet
    const lineProgress = Math.min(1, Math.max(0, scrollProgress / cameraStartThreshold))
    
    let startT, endT
    
    if (lineProgress < 1) {
      // Før kameraet begynder at bevæge sig: linjen vokser fra lineStartOffset mod pathens start
      // Ved lineProgress 0: endT = lineStartOffset (bag kameraet)
      // Ved lineProgress 1: endT = 0.06 (matcher starten af næste fase for smooth overgang)
      endT = lineStartOffset + (lineProgress * (0.06 - lineStartOffset))
      startT = lineStartOffset
    } else {
      // Efter kameraet begynder at bevæge sig: linjen følger med
      const cameraT = Math.min(pathEndPoint, ((scrollProgress - cameraStartThreshold) / (1 - cameraStartThreshold)) * pathEndPoint)
      // Start ved 0 når cameraT er 0 for at matche slutningen af forrige fase
      startT = cameraT === 0 ? 0 : Math.max(0, cameraT - 0.06)
      endT = Math.min(pathEndPoint, cameraT + 0.06)
    }
    
    // Sikr at startT < endT for at undgå fejl
    if (startT >= endT) {
      endT = startT + 0.001
    }
    
    // Opret punkter langs pathen
    // VIGTIGT: Vis kun linjen når endT > 0 (foran kameraet/pathens start)
    const points = []
    
    if (endT <= 0) {
      // Hele linjen er bag kameraet - skjul linjen helt
      if (pencilLineGroup) pencilLineGroup.visible = false
    } else {
      // Linjen er (delvist) foran kameraet - vis den
      if (pencilLineGroup) pencilLineGroup.visible = true
      
      // Vis kun den del der er foran kameraet (fra 0 til endT)
      const visibleStartT = Math.max(0, startT)
      const visibleEndT = endT
      
      if (visibleEndT > visibleStartT) {
        const numPoints = Math.max(20, Math.floor(Math.abs(visibleEndT - visibleStartT) * 600))
        for (let i = 0; i <= numPoints; i++) {
          const pathT = visibleStartT + (i / numPoints) * (visibleEndT - visibleStartT)
          const pathPoint = cameraPath.getPoint(pathT)
          points.push(new THREE.Vector3(pathPoint.x, 0.01, pathPoint.z))
        }
      }
    }
    
    // Opret ny geometri med de synlige punkter (tom hvis endT <= 0)
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    
    // Opdater hovedlinjen
    pencilLine.geometry.dispose()
    pencilLine.geometry = geometry
    
    // Kun opdater overlays hvis stregen faktisk er vokset (endT er ændret betydeligt)
    // Dette forhindrer vibration når stregen ikke ændrer sig
    const endTChanged = Math.abs(endT - lastEndT) > 0.001
    
    if (endTChanged && points.length > 0) {
      // Fjern gamle overlays (behold kun hovedlinjen)
      while (pencilLineGroup.children.length > 1) {
        const child = pencilLineGroup.children[1]
        if (child.geometry) child.geometry.dispose()
        if (child.material) child.material.dispose()
        pencilLineGroup.remove(child)
      }
      
      // Tilføj teksturerede overlays for blyant-effekt
      // Opret mange små linjesegmenter med varierende opacitet for tykkere, tekstureret linje
      // Brug deterministisk noise baseret på position så det ikke vibrerer
      const hash = (x, y, z) => {
        return Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
      }
      
      const seededRandom = (x, y, z, seed) => {
        const n = hash(x, y, z + seed)
        return (n - Math.floor(n))
      }
      
      for (let i = 0; i < points.length - 1; i++) {
        // Tilføj flere overlays per segment for tykkere linje
        for (let layer = 0; layer < 4; layer++) {
          // Brug deterministisk noise baseret på punktets position og layer
          // Lidt større variation for tykkere linje
          const noiseScale = 0.03
          const noise1 = (seededRandom(points[i].x, points[i].y, points[i].z, layer * 0.1) - 0.5) * noiseScale
          const noise2 = (seededRandom(points[i].x, points[i].y, points[i].z, layer * 0.1 + 1) - 0.5) * noiseScale
          const noise3 = (seededRandom(points[i + 1].x, points[i + 1].y, points[i + 1].z, layer * 0.1) - 0.5) * noiseScale
          const noise4 = (seededRandom(points[i + 1].x, points[i + 1].y, points[i + 1].z, layer * 0.1 + 1) - 0.5) * noiseScale
          
          const p1 = new THREE.Vector3(
            points[i].x + noise1,
            points[i].y,
            points[i].z + noise2
          )
          const p2 = new THREE.Vector3(
            points[i + 1].x + noise3,
            points[i + 1].y,
            points[i + 1].z + noise4
          )
          
          // Deterministisk opacity baseret på position
          const opacitySeed = seededRandom(points[i].x, points[i].z, layer, 100)
          const opacity = opacitySeed * 0.6 + 0.3 // Varierende opacitet 0.3-0.9
          
          const segmentGeometry = new THREE.BufferGeometry().setFromPoints([p1, p2])
          const segmentMaterial = new THREE.LineBasicMaterial({
            color: 0x333333, // Mørkegrå
            linewidth: 13, // Tykkere streger
            transparent: true,
            opacity: opacity
          })
          
          const segmentLine = new THREE.Line(segmentGeometry, segmentMaterial)
          pencilLineGroup.add(segmentLine)
        }
      }
      
      // Opdater lastEndT
      lastEndT = endT
    }
  }
  
  // Opdater kamera position baseret på scroll
  const updateCameraPosition = () => {
    if (!cameraPath) return
    
    // LANDING PAGE: Håndter overgang fra landing til path
    // Fase 1: Landing (scrollProgress 0 til landingScrollThreshold) - animer fra top-down til path start
    // Fase 2: Path (scrollProgress > landingScrollThreshold) - følg pathen som normalt
    
    const pathStartPoint = cameraPath.getPoint(0)
    const pathLookAheadPoint = cameraPath.getPoint(0.1)
    
    if (scrollProgress < landingScrollThreshold) {
      // LANDING FASE: Animer fra landing position (kigger mod billederne) til path start
      isInLandingPhase = true
      
      // Behold scene baggrund synlig under landing fase så horisonten er synlig
      // Sikr altid at baggrunden er sat til den korrekte farve
      scene.background = new THREE.Color(0xF0EEE9)
      
      // Beregn landing transition progress (0 = fuld landing, 1 = ved path start)
      const landingProgress = scrollProgress / landingScrollThreshold
      
      // Smooth easing funktion der er kontinuerlig og forhindrer oscillation
      // Bruger smoothstep (hermite interpolation) for glidende overgang
      // Dette sikrer en kontinuerlig og stabil kamerabevægelse uden skarpe drejninger
      const easedProgress = landingProgress * landingProgress * (3 - 2 * landingProgress)
      
      // Interpoler mellem landing position (kigger mod billederne) og path start
      targetCameraPosition = new THREE.Vector3().lerpVectors(
        landingCameraPosition,
        pathStartPoint,
        easedProgress
      )
      
      // Interpoler lookAt fra billederne til path fremad
      targetLookAt = new THREE.Vector3().lerpVectors(
        landingCameraLookAt,
        pathLookAheadPoint,
        easedProgress
      )
      
      // Fade billederne ud når man scroller ned mod start position
      // Billederne skal være fuldt synlige ved landingProgress = 0
      // Og fade ud når landingProgress nærmer sig 1
      const imagesOpacity = 1 - easedProgress
      
      // Opdater logo opacities
      landingLogoOpacity.value = 1 - easedProgress // Landing logo fader ud
      
      // Header logo: Hurtig fade-out når man scroller tilbage, smooth fade-in når man scroller væk
      let headerEasedProgress
      if (landingProgress < 0.5) {
        // Hurtig fade-out når man scroller tilbage - kvadratisk for hurtigere respons
        headerEasedProgress = landingProgress * landingProgress * 2
        if (headerEasedProgress > 1) headerEasedProgress = 1
      } else {
        // Smooth fade-in når man scroller væk - bruger easedProgress
        headerEasedProgress = easedProgress
      }
      headerLogoOpacity.value = headerEasedProgress
      
      // Render noise wipe
      renderLandingNoiseWipe()
      
    } else {
      // PATH FASE: Normal path-følgning
      isInLandingPhase = false
      
      // Gendan scene baggrund når vi forlader landing fase
      if (scene.background === null) {
        scene.background = new THREE.Color(0xF0EEE9)
      }
      
      // Skjul alle billeder når vi starter path fase - de bliver vist igen baseret på afstand
      // Reset opacity tilbage til normal
      sceneImages.forEach(img => {
        if (img.imagePlane) {
          img.imagePlane.visible = false
          // Reset opacity tilbage til normal (1.0) når vi forlader landing fase
          if (img.imagePlane.material) {
            img.imagePlane.material.opacity = 1.0
          }
        }
        if (img.shadowPlane) img.shadowPlane.visible = false
      })
      
      // Sørg for at landing logo er skjult og header logo er synligt
      landingLogoOpacity.value = 0
      headerLogoOpacity.value = 1
      
      let t
      if (scrollProgress < cameraStartThreshold) {
        // Kameraet står stille ved starten (t = 0) mens linjen vokser bagved
        t = 0
      } else {
        // Kameraet følger med efter linjen har nået foran kameraet
        // Map scrollProgress fra [cameraStartThreshold, 1] til [0, pathEndPoint] for kamera position
        t = Math.min(pathEndPoint, (scrollProgress - cameraStartThreshold) / (1 - cameraStartThreshold) * pathEndPoint)
      }
      
      // Sikr at t aldrig overstiger pathEndPoint
      t = Math.min(pathEndPoint, t)
      
      targetCameraPosition = cameraPath.getPoint(t)
      
      // Kig mod et punkt lidt fremme på pathen
      // Når vi nærmer os pathEndPoint, smooth overgang til tangent-baseret lookAt
      if (t < pathEndPoint - 0.1) {
        // Normal: kig mod et punkt lidt fremme på pathen
        const lookAheadT = t + 0.1
        targetLookAt = cameraPath.getPoint(lookAheadT)
      } else {
        // Overgangszone: smooth interpolation fra normal til tangent-baseret
        const transitionProgress = (t - (pathEndPoint - 0.1)) / 0.1 // 0 til 1
        
        // Normal lookAt (fra path punkt)
        const normalLookAt = cameraPath.getPoint(pathEndPoint)
        
        // Tangent-baseret lookAt (bevarer retningen)
        const tangent = cameraPath.getTangent(pathEndPoint - 0.1)
        const tangentLookAt = targetCameraPosition.clone().add(tangent.multiplyScalar(1))
        
        // Interpoler smooth mellem normal og tangent-baseret
        targetLookAt = new THREE.Vector3().lerpVectors(normalLookAt, tangentLookAt, transitionProgress)
      }
      
      // Hold lookAt i niveau med kameraet så vi ikke kigger opad
      targetLookAt.y = targetCameraPosition.y
    }
    
    // Smooth interpolation af kamera position (lavere værdi = mere smooth)
    // Fortsæt med smooth interpolation hele vejen, også ved slutningen af pathen
    // Dette sikrer en glidende overgang uden "klik" effekt
    currentCameraPosition.lerp(targetCameraPosition, 0.08)
    currentLookAt.lerp(targetLookAt, 0.06)
    
    // Anvend rotation til lookAt punktet
    // Beregn retning fra kamera til lookAt punkt
    const direction = new THREE.Vector3().subVectors(currentLookAt, currentCameraPosition).normalize()
    // Beregn højre vektor (vinkelret på retning og op)
    const right = new THREE.Vector3().crossVectors(direction, camera.up).normalize()
    // Beregn op vektor (vinkelret på retning og højre)
    const up = new THREE.Vector3().crossVectors(right, direction).normalize()
    
    // Smooth interpolation af mus position (lavere værdi = mere smooth og langsommere)
    // Øg mus-effekt på landing page, reducer til normal når vi scroller til path start
    const mouseFactor = isInLandingPhase ? 1.0 : 1.0
    mouseX = lerp(mouseX, targetMouseX * mouseFactor, 0.02)
    mouseY = lerp(mouseY, targetMouseY * mouseFactor, 0.02)
    
    // Anvend mus offset til kamera position relativt til kamerets retning
    // Inverteret så når man bevæger musen til højre, bevæger det man kigger på til højre (naturligt)
    const mouseOffset = new THREE.Vector3()
    mouseOffset.addScaledVector(right, -mouseX)
    mouseOffset.addScaledVector(up, -mouseY)
    
    camera.position.copy(currentCameraPosition).add(mouseOffset)
    camera.lookAt(currentLookAt)
  }
  
  // Scroll/wheel event handler
  handleScroll = (event) => {
    if (event) {
      // LANDING PAGE: Ingen scroll på landing – kun "Explore"-knappen må føre videre
      const isAtLanding = targetScrollProgress < landingScrollThreshold
      // Tillad manuel scrolling hvis udvikler-mode er slået til
      if (isAtLanding && !manualScrollEnabled.value) {
        return
      }
      
      // event.deltaY > 0 = scroll nedad (fremad), event.deltaY < 0 = scroll opad (bagud)
      // Use higher sensitivity when manual scroll is enabled so user can
      // quickly traverse the entire experience with fewer wheel events.
      const wheelSensitivity = manualScrollEnabled.value ? 0.0015 : 0.000008
      const newTotalScroll = totalScroll + (event.deltaY * wheelSensitivity)
      
      // Tjek om vi prøver at scrolle fremad når vi er ved enden af pathen
      const isScrollingForward = event.deltaY > 0
      const isAtEnd = targetScrollProgress >= 0.999 // Meget tæt på 1 (enden af pathen)
      if (isScrollingForward && isAtEnd) {
        // Forhindre fremad-scrolling ved enden af pathen - returner tidligt uden at opdatere
        return
      }
      
      // Akkumuler scroll med lavere sensitivity for smooth bevægelse
      totalScroll = newTotalScroll
      
      // Sikr at totalScroll ikke går under 0 (forhindre bagud-scrolling fra landing)
      if (totalScroll < 0) {
        totalScroll = 0
      }
      
      // Sikr at totalScroll ikke går over 1 (forhindre fremad-scrolling ved enden)
      if (totalScroll > 1) {
        totalScroll = 1
      }
      
      // Begræns target scroll progress til 0-1
      targetScrollProgress = Math.min(1, Math.max(0, totalScroll))
    }
    
    // Opdater ikke direkte - lad animation loop håndtere det smooth
    // Kamera opdateres nu i animation loop med smooth interpolation
  }
  
  // Tilføj wheel listener (mouse scroll)
  window.addEventListener('wheel', handleScroll, { passive: true })
  handleScroll() // Initial opdatering

  // Hvis brugeren forsøger at scrolle med musen, aktiver manual scroll automatisk.
  // Brug capture så denne handler kører FØR `handleScroll` og kan fjerne landing-blokken.
  const onFirstUserWheel = (e) => {
    // Hvis manual scroll ikke er tilladt eller allerede aktiveret, gør ingenting
    if (manualScrollEnabled.value || !manualScrollAllowed.value) return
    manualScrollEnabled.value = true
    isAutoScrolling.value = false
    try {
      document.documentElement.classList.remove('locked')
      document.body.classList.remove('locked')
      document.documentElement.style.overflow = 'auto'
      document.body.style.overflow = 'auto'
    } catch (err) {}
    console.log('Manual scroll enabled by user wheel')
    // Fjern denne one-time listener
    window.removeEventListener('wheel', onFirstUserWheel, { capture: true })
  }
  window.addEventListener('wheel', onFirstUserWheel, { passive: true, capture: true })
  
  // Mouse move handler for kamera bevægelse
  handleMouseMove = (event) => {
    // Gem screen position for displacement effekt
    mouseScreenX = event.clientX
    mouseScreenY = event.clientY
    
    // Øg mus følsomhed på landing page, reducer til normal når vi scroller til path start
    const isOnLandingPage = scrollProgress < landingScrollThreshold
    const dynamicMouseSensitivity = isOnLandingPage ? mouseSensitivity * 1.8 : mouseSensitivity
    
    // Normaliser mus position til -1 til 1 (centrum = 0)
    targetMouseX = ((event.clientX / window.innerWidth) * 2 - 1) * dynamicMouseSensitivity
    targetMouseY = -((event.clientY / window.innerHeight) * 2 - 1) * dynamicMouseSensitivity // Negativ for at invertere Y-aksen
    
    // Opdater target scroll text position til at følge musen (kun hvis vi er på landing page)
    if (scrollProgress < landingScrollThreshold) {
      targetScrollTextX = event.clientX
      targetScrollTextY = event.clientY - 15 // Flyt tekst op så musen ikke dækker den
    } else {
      // Reset target position når vi forlader landing page
      targetScrollTextX = 0
      targetScrollTextY = 0
    }
    
    // Check hover over 3D navigation
    if (navVisible && use3DNav && raycaster && camera && navMeshes.length > 0) {
      const mouse = new THREE.Vector2()
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
      
      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(navMeshes)
      
      if (intersects.length > 0) {
        const newHovered = intersects[0].object
        if (hoveredNavMesh !== newHovered) {
          // Skjul forrige hover underline (animér width til 0)
          if (hoveredNavMesh) {
            const prevUnderlineIndex = navMeshes.indexOf(hoveredNavMesh)
            if (prevUnderlineIndex !== -1 && navUnderlines[prevUnderlineIndex]) {
              navUnderlines[prevUnderlineIndex].userData.targetScaleX = 0
            }
          }
          
          // Set new hover
          hoveredNavMesh = newHovered
          document.body.style.cursor = 'pointer'
          
          // Vis hover underline for ny hover (animér width til 1)
          const underlineIndex = navMeshes.indexOf(newHovered)
          if (underlineIndex !== -1 && navUnderlines[underlineIndex]) {
            navUnderlines[underlineIndex].userData.targetScaleX = 1
          }
        }
      } else {
        // No intersection
        if (hoveredNavMesh) {
          // Skjul hover underline (animér width til 0)
          const underlineIndex = navMeshes.indexOf(hoveredNavMesh)
          if (underlineIndex !== -1 && navUnderlines[underlineIndex]) {
            navUnderlines[underlineIndex].userData.targetScaleX = 0
          }
          hoveredNavMesh = null
          document.body.style.cursor = 'default'
        }
      }
    } else if (hoveredNavMesh) {
      // Nav not visible anymore, reset
      const underlineIndex = navMeshes.indexOf(hoveredNavMesh)
      if (underlineIndex !== -1 && navUnderlines[underlineIndex]) {
        navUnderlines[underlineIndex].userData.targetScaleX = 0
      }
      hoveredNavMesh = null
      document.body.style.cursor = 'default'
    }
  }
  window.addEventListener('mousemove', handleMouseMove, { passive: true })
  
  // WS keyboard controls (W/S for path movement)
  handleKeyDown = (event) => {
    const key = event.key.toLowerCase()
    if (key === 'w') keys.w = true
    if (key === 's') keys.s = true
  }
  
  handleKeyUp = (event) => {
    const key = event.key.toLowerCase()
    if (key === 'w') keys.w = false
    if (key === 's') keys.s = false
  }
  
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  
  // Click handler for 3D navigation
  handleNavClick = (event) => {
    if (!navVisible || !use3DNav || !raycaster || !camera || navMeshes.length === 0) return
    
    // Beregn normaliseret mus position
    const mouse = new THREE.Vector2()
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    
    // Opdater raycaster
    raycaster.setFromCamera(mouse, camera)
    
    // Check for intersection med nav meshes
    const intersects = raycaster.intersectObjects(navMeshes)
    
    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object
      const route = clickedMesh.userData.route
      
      if (route) {
        // Reset cursor og hover state før navigation
        if (hoveredNavMesh) {
          // Skjul hover underline (animér width til 0)
          const underlineIndex = navMeshes.indexOf(hoveredNavMesh)
          if (underlineIndex !== -1 && navUnderlines[underlineIndex]) {
            navUnderlines[underlineIndex].userData.targetScaleX = 0
          }
          hoveredNavMesh = null
        }
        document.body.style.cursor = 'default'
        
        // Gem scroll progress før navigation
        localStorage.setItem('gardenScrollProgress', scrollProgress.toString())
        localStorage.setItem('gardenTotalScroll', totalScroll.toString())
        router.push(route)
      }
    }
  }
  window.addEventListener('click', handleNavClick)
  // Fjern console-exposure af udvikler-funktioner for at undgå utilsigtet aktivering
  try { window.enableManualScroll = undefined; window.disableManualScroll = undefined } catch(e) {}
  
  // Smooth interpolation funktion
  const lerp = (start, end, factor) => {
    return start + (end - start) * factor
  }
  
  // Konverter 3D world position til 2D screen position
  const worldToScreen = (worldPos) => {
    const vector = worldPos.clone()
    vector.project(camera)
    
    // Tjek om punktet er bag kameraet
    const camDirection = new THREE.Vector3()
    camera.getWorldDirection(camDirection)
    const toPoint = new THREE.Vector3().subVectors(worldPos, camera.position)
    const isBehind = toPoint.dot(camDirection) < 0
    
    return {
      x: (vector.x * 0.5 + 0.5) * window.innerWidth,
      y: (-vector.y * 0.5 + 0.5) * window.innerHeight,
      isBehind: isBehind
    }
  }
  
  // Opdater info button positioner
  const updateInfoButtons = () => {
    const newPositions = []
    
    sceneImages.forEach((imageData, index) => {
      if (!imageData.imagePlane || imageData.disposed || !imageData.config.info) {
        newPositions.push({ x: 0, y: 0, visible: false })
        return
      }
      
      // Beregn afstand til kamera
      const imagePos = imageData.imagePlane.position
      const distance = camera.position.distanceTo(imagePos)
      
      // Skjul hvis for langt væk eller billedet ikke er synligt
      // Sketch1 (Entrance sketch) skal have højere wipeProgress tærskel
      const wipeThreshold = imageData.config.id === 'sketch1' ? 0.4 : 0.15
      const isVisible = imageData.imagePlane.visible && 
            imageData.wipeProgress > wipeThreshold && 
            distance < 10 &&
            !isInLandingPhase &&
            // Exclude the final image (slutbillede) from showing an info button
            imageData.config.id !== 'slutbillede'
      
      if (!isVisible) {
        newPositions.push({ x: 0, y: 0, visible: false })
        return
      }
      
      // Beregn screen position (lidt til højre for billedets center)
      // Specifik offset for sketch billedet (flyt knappen ned)
      const yOffset = imageData.config.id === 'sketch1' 
        ? imageData.config.size * 0.1  // Mindre offset (flytter nedad på skærmen)
        : imageData.config.size * 0.3   // Normal offset
      
      const offsetPos = new THREE.Vector3(
        imagePos.x + imageData.config.size * 0.6,
        imagePos.y + yOffset,
        imagePos.z
      )
      
      const screenPos = worldToScreen(offsetPos)
      
      // Skjul hvis bag kameraet eller udenfor skærmen
      const isOnScreen = !screenPos.isBehind && 
                         screenPos.x > 0 && screenPos.x < window.innerWidth &&
                         screenPos.y > 0 && screenPos.y < window.innerHeight
      
      newPositions.push({
        x: screenPos.x,
        y: screenPos.y,
        visible: isOnScreen
      })
    })
    
    infoButtonPositions.value = newPositions
  }
  
  // Opdater introduktion fade effekt baseret på scroll
  const updateIntroFade = (deltaTime) => {
    // LANDING PAGE: Intro tekst vises først EFTER landing fase
    // Først: auto-animate fade-in når vi forlader landing
    // Derefter: fade-out baseret på scroll
    const fadeInStart = landingScrollThreshold  // Start fade-in når vi forlader landing
    const fadeOutStart = 0.12  // Delay før teksten begynder at forsvinde (justeret for landing)
    const fadeOutEnd = 0.20    // Hvornår teksten er helt væk
    
    // Hvis vi er i landing fase, skjul intro tekst
    if (scrollProgress < fadeInStart) {
      introOpacity.value = 0
      introVisible.value = false
      introAnimationStarted = false
      introAnimationTime = 0
      return
    }
    
    // Auto fade-in animation når vi forlader landing
    if (!introAnimationStarted || introAnimationTime < introAnimationDuration) {
      introAnimationStarted = true
      introAnimationTime += deltaTime
      
      // Easing funktion for smooth animation
      const t = Math.min(1, introAnimationTime / introAnimationDuration)
      const easeOut = 1 - Math.pow(1 - t, 3) // Cubic ease out
      
      // Hvis brugeren har scrollet forbi fadeOutStart, brug scroll-baseret animation i stedet
      if (scrollProgress > fadeOutStart) {
        // Switch til scroll-baseret fade-out
        const scrollOutProgress = (scrollProgress - fadeOutStart) / (fadeOutEnd - fadeOutStart)
        introOpacity.value = Math.max(0, 1 - scrollOutProgress)
        introVisible.value = introOpacity.value > 0
      } else {
        // Fortsæt auto fade-in
        introOpacity.value = easeOut
        introVisible.value = true
      }
    } else {
      // Auto animation er færdig - brug scroll til at fade ud
      if (scrollProgress <= fadeOutStart) {
        // Fuldt synlig
        introOpacity.value = 1
        introVisible.value = true
      } else if (scrollProgress < fadeOutEnd) {
        // Fade ud animation
        const progress = (scrollProgress - fadeOutStart) / (fadeOutEnd - fadeOutStart)
        introOpacity.value = 1 - progress
        introVisible.value = true
      } else {
        // Helt væk
        introOpacity.value = 0
        introVisible.value = false
      }
    }
  }
  
  // Opdater tekst baseret på scroll progress med fade effekt (bruger CSS transition)
  let fadeOutTimeout = null
  let fadeInTimeout = null
  const fadeDuration = 500 // ms - matcher CSS transition
  
  const updateScrollText = () => {
    if (scrollTexts.length === 0) {
      currentText.value = ''
      textOpacity.value = 0
      return
    }
    
    // Map scrollProgress (0-1) til tekst index
    // Vis kun tekst når scrollProgress er over 0.1 (når kameraet begynder at bevæge sig)
    if (scrollProgress < 0.1) {
      // Fade ud tekst når vi scroller tilbage til start
      if (textOpacity.value > 0 && fadeState !== 'out') {
        fadeState = 'out'
        textOpacity.value = 0 // CSS transition håndterer fade
        // Vent på CSS transition før vi fjerner teksten
        clearTimeout(fadeOutTimeout)
        clearTimeout(fadeInTimeout)
        fadeOutTimeout = setTimeout(() => {
          if (fadeState === 'out') {
            currentText.value = ''
            previousTextIndex = -1
            fadeState = 'pause'
          }
        }, fadeDuration)
      }
      return
    }
    
    // Del scroll range op i sektioner: tekst-pause-tekst-pause-...
    // Struktur: [tekst1][pause][tekst2][pause][tekst3]...
    const scrollRange = 1 - 0.1 // 0.9 total range
    const normalizedProgress = (scrollProgress - 0.1) / scrollRange // 0 til 1
    
    // Hver tekst får sin egen sektion med pause efter
    // Struktur: tekst (35%) + pause (65%)
    // Tekst 1 får ekstra plads (1.5x størrelse) så tekst 2 kommer senere
    const totalSections = scrollTexts.length // Antal tekst-sektioner
    const baseSectionSize = 1 / totalSections // Basis størrelse af hver sektion
    const firstSectionSize = baseSectionSize * 1.5 // Tekst 1 får 1.5x størrelse
    const remainingSectionsSize = 1 - firstSectionSize // Resten af pladsen
    const otherSectionSize = remainingSectionsSize / (totalSections - 1) // Størrelse for resten
    // Anden tekst/speech starter lidt tidligere for at mindske mellemrummet efter første tekst
    const section1EarlyStart = 0.025
    // "Each element is deliberately placed..." (index 5) starter lidt senere
    const section5LateStart = 0.02
    
    // Find hvilken sektion vi er i
    let currentSection = 0
    let positionInSection = 0
    let clampedIndex = 0
    
    if (normalizedProgress < firstSectionSize - section1EarlyStart) {
      // Vi er i første sektion (tekst 1)
      currentSection = 0
      positionInSection = normalizedProgress / (firstSectionSize - section1EarlyStart)
      clampedIndex = 0
    } else if (normalizedProgress < firstSectionSize) {
      // Overlap: vis anden tekst/speech lidt tidligere (mindre mellemrum)
      currentSection = 1
      clampedIndex = 1
      positionInSection = 0
    } else {
      // Vi er i en af de andre sektioner
      const progressAfterFirst = normalizedProgress - firstSectionSize
      currentSection = Math.floor(progressAfterFirst / otherSectionSize) + 1
      clampedIndex = Math.min(currentSection, scrollTexts.length - 1)
      positionInSection = (progressAfterFirst / otherSectionSize) % 1
      
      // Sektion 5 (index 5) starter lidt senere – hold i sektion 4 indtil vi har scrollet nok
      if (currentSection === 5 && progressAfterFirst < 4 * otherSectionSize + section5LateStart) {
        currentSection = 4
        clampedIndex = 4
        positionInSection = Math.min(1, (progressAfterFirst - 3 * otherSectionSize) / otherSectionSize)
      }
      
      // Håndter edge case for sidste tekst
      if (clampedIndex === scrollTexts.length - 1 && positionInSection === 0 && normalizedProgress > 0.99) {
        positionInSection = 1
      }
    }
    
    // I hver sektion: først tekst, så pause
    // textSectionRatio bestemmer hvor meget af sektionen teksten optager
    const effectiveTextRatio = textSectionRatioOverrides[clampedIndex] ?? textSectionRatio
    const isInTextPart = positionInSection < effectiveTextRatio
    
    if (isInTextPart && clampedIndex < scrollTexts.length) {
      // Vi er i tekst-delen af sektionen
      const targetText = scrollTexts[clampedIndex]
      
      // Annuller eventuel fade out timeout
      clearTimeout(fadeOutTimeout)
      
      // Hvis ny tekst, fade in
      if (currentText.value !== targetText || fadeState === 'pause' || fadeState === 'out') {
        // Sæt teksten med opacity 0 først
        textOpacity.value = 0
        currentText.value = targetText
        previousTextIndex = clampedIndex
        fadeState = 'in'
        
        // Afspil speech audio og paus auto-scroll mens det afspilles
        const speechAudiosMap = [
          { audio: speechAudio, played: () => speechPlayed, setPlayed: (v) => speechPlayed = v, index: 0 },
          { audio: speech2Audio, played: () => speech2Played, setPlayed: (v) => speech2Played = v, index: 1 },
          { audio: speech3Audio, played: () => speech3Played, setPlayed: (v) => speech3Played = v, index: 2 },
          { audio: speech4Audio, played: () => speech4Played, setPlayed: (v) => speech4Played = v, index: 3 },
          { audio: speech5Audio, played: () => speech5Played, setPlayed: (v) => speech5Played = v, index: 4 },
          { audio: speech6Audio, played: () => speech6Played, setPlayed: (v) => speech6Played = v, index: 5 },
          { audio: speech7Audio, played: () => speech7Played, setPlayed: (v) => speech7Played = v, index: 6 },
          { audio: speech8Audio, played: () => speech8Played, setPlayed: (v) => speech8Played = v, index: 7 }
        ]
        
        const speechEntry = speechAudiosMap.find(s => s.index === clampedIndex)
        if (speechEntry && speechEntry.audio && !speechEntry.played() && speakEnabled.value) {
          speechEntry.setPlayed(true)
          speechEntry.audio.volume = 1.0
          // Sørg for at starte fra begyndelsen (fix for mobil hvor audio kan være delvist afspillet fra unlock)
          speechEntry.audio.currentTime = 0
          
          // Sænk auto-scroll fart mens speech afspilles
          if (isAutoScrolling.value) {
            autoScrollSpeechPlaying = true
            // Tilføj ended listener for at gå tilbage til normal fart
            const onEnded = () => {
              if (isAutoScrolling.value) {
                autoScrollSpeechPlaying = false
              }
              speechEntry.audio.removeEventListener('ended', onEnded)
            }
            speechEntry.audio.addEventListener('ended', onEnded)
          }
          
          speechEntry.audio.play().catch(err => {
            console.warn(`Kunne ikke afspille speech${clampedIndex > 0 ? clampedIndex + 1 : ''} audio:`, err)
            speechEntry.setPlayed(false)
            if (isAutoScrolling.value) {
              autoScrollSpeechPlaying = false
            }
          })
        }
        
        // Vent en frame, så browseren kan rendere med opacity 0, derefter fade in
        clearTimeout(fadeInTimeout)
        fadeInTimeout = setTimeout(() => {
          if (fadeState === 'in') {
            textOpacity.value = 1
            fadeState = 'visible'
          }
        }, 20) // Kort delay for at sikre DOM er opdateret
      }
    } else {
      // Vi er i pause-delen af sektionen
      // Start fade out hvis vi har tekst og ikke allerede er i fade out
      if (fadeState === 'visible' && currentText.value !== '') {
        fadeState = 'out'
        textOpacity.value = 0 // CSS transition håndterer fade
        // Vent på CSS transition før vi fjerner teksten
        clearTimeout(fadeOutTimeout)
        clearTimeout(fadeInTimeout)
        fadeOutTimeout = setTimeout(() => {
          if (fadeState === 'out') {
            currentText.value = ''
            fadeState = 'pause'
          }
        }, fadeDuration)
      }
    }
  }
  
  // Animation loop
  let lastTime = performance.now()
  let frameCount = 0
  const animate = () => {
    const frameStart = performance.now()
    animationId = requestAnimationFrame(animate)
    
    // Beregn deltaTime
    const currentTime = performance.now()
    const deltaTime = (currentTime - lastTime) / 1000 // Konverter til sekunder
    lastTime = currentTime
    
    // Auto-scroll: Opdater targetScrollProgress automatisk
    if (isAutoScrolling.value) {
      let speed = autoScrollSpeed
      
      // Hurtigere gennem landing-fasen (0 til 0.03)
      if (targetScrollProgress < landingScrollThreshold) {
        speed = autoScrollLandingSpeed
      }
      // Medium hastighed fra landing til første tekst (0.03 til 0.1)
      else if (targetScrollProgress < cameraStartThreshold) {
        speed = autoScrollTransitionSpeed
      }
      // Langsommere mens speak afspilles
      else if (autoScrollSpeechPlaying) {
        speed = autoScrollSpeechSpeed
      }
      
      targetScrollProgress = Math.min(1, targetScrollProgress + speed)
      totalScroll = targetScrollProgress
      
      // Stop auto-scroll når vi når enden
      if (targetScrollProgress >= 1) {
        stopAutoScroll()
      }
    }
    
    // Smooth interpolation af scroll progress (lavere værdi = mere smooth)
    scrollProgress = lerp(scrollProgress, targetScrollProgress, 0.04)
    
    previousScrollProgress = scrollProgress
    
    // Smooth interpolation af scroll text position (følger blødt efter musen)
    if (scrollProgress < landingScrollThreshold) {
      scrollTextX.value = lerp(scrollTextX.value, targetScrollTextX, 0.05)
      scrollTextY.value = lerp(scrollTextY.value, targetScrollTextY, 0.05)
    } else {
      // Reset position når vi forlader landing page
      scrollTextX.value = lerp(scrollTextX.value, 0, 0.05)
      scrollTextY.value = lerp(scrollTextY.value, 0, 0.05)
    }
    
    // Opdater fog density - konstant 0.13 på landing page og i 3D oplevelsen
    if (scene.fog) {
      // Sæt fog density direkte til 0.13 - ingen interpolation nødvendig da både landing og scroll er 0.13
      scene.fog.density = 0.13
    }
    
    // Opdater nature audio volume baseret på scroll progress og atmosphere toggle
    if (natureAudio) {
      let targetVolume = 0
      
      // Hvis atmosphere er slukket, sæt volume til 0
      if (!atmosphereEnabled.value) {
        targetVolume = 0
      } else {
        if (scrollProgress < audioFadeStart) {
          // På landing page - fuld lyd kun hvis brugeren har klikket
          targetVolume = soundClicked.value ? audioMaxVolume : 0
        } else if (scrollProgress >= audioFadeEnd) {
          // Fuld lyd efter fade-in
          targetVolume = audioMaxVolume
        } else {
          // Fade-in mellem audioFadeStart og audioFadeEnd (behold fuld lyd)
          targetVolume = audioMaxVolume
        }
      }
      
      // Smooth interpolation af volume
      natureAudio.volume = lerp(natureAudio.volume, targetVolume, 0.05)
      
      // Start afspilning hvis volume > 0 og audio ikke spiller (kan kræve user interaction)
      // På landing page skal brugeren klikke først
      if (targetVolume > 0 && natureAudio.paused) {
        if (scrollProgress < audioFadeStart) {
          // På landing page - kun start hvis brugeren har klikket
          if (soundClicked.value) {
            natureAudio.play().catch(err => {
              console.warn('Kunne ikke starte audio:', err)
            })
          }
        } else {
          // Udenfor landing page - start automatisk
          natureAudio.play().catch(err => {
            console.warn('Kunne ikke starte audio:', err)
          })
        }
      }
      
      // Stop afspilning hvis volume er 0
      if (targetVolume === 0 && !natureAudio.paused) {
        natureAudio.pause()
      }
    }
    
    // Opdater speech audio volume med fade-out når man nærmer sig næste lydklip
    if (scrollProgress >= 0.1 && scrollTexts.length > 0) {
      // Beregn samme struktur som i updateScrollText
      const scrollRange = 1 - 0.1 // 0.9 total range
      const normalizedProgress = (scrollProgress - 0.1) / scrollRange // 0 til 1
      
      const totalSections = scrollTexts.length
      const baseSectionSize = 1 / totalSections
      const firstSectionSize = baseSectionSize * 1.5
      const remainingSectionsSize = 1 - firstSectionSize
      const otherSectionSize = remainingSectionsSize / (totalSections - 1)
      const section1EarlyStart = 0.025
      const section5LateStart = 0.02
      
      let currentSection = 0
      let positionInSection = 0
      let clampedIndex = 0
      
      if (normalizedProgress < firstSectionSize - section1EarlyStart) {
        currentSection = 0
        positionInSection = normalizedProgress / (firstSectionSize - section1EarlyStart)
        clampedIndex = 0
      } else if (normalizedProgress < firstSectionSize) {
        currentSection = 1
        clampedIndex = 1
        positionInSection = 0
      } else {
        const progressAfterFirst = normalizedProgress - firstSectionSize
        currentSection = Math.floor(progressAfterFirst / otherSectionSize) + 1
        clampedIndex = Math.min(currentSection, scrollTexts.length - 1)
        positionInSection = (progressAfterFirst / otherSectionSize) % 1
        
        if (currentSection === 5 && progressAfterFirst < 4 * otherSectionSize + section5LateStart) {
          currentSection = 4
          clampedIndex = 4
          positionInSection = Math.min(1, (progressAfterFirst - 3 * otherSectionSize) / otherSectionSize)
        }
        
        if (clampedIndex === scrollTexts.length - 1 && positionInSection === 0 && normalizedProgress > 0.99) {
          positionInSection = 1
        }
      }
      
      const effectiveTextRatioAudio = textSectionRatioOverrides[clampedIndex] ?? textSectionRatio
      const isInTextPart = positionInSection < effectiveTextRatioAudio
      
      // Detekter baglæns scrolling og reset speak-lydklip når vi scroller tilbage til deres trigger point
      if (previousClampedIndex !== -1 && clampedIndex < previousClampedIndex) {
        // Vi scroller bagud - reset alle lydklip med indeks højere end det nuværende clampedIndex
        // Dette sikrer at lydklip kun reset'es når vi scroller tilbage til deres trigger point
        resetSpeechAudioFromIndex(clampedIndex + 1)
      }
      previousClampedIndex = clampedIndex
      
      // Fade-out start når vi nærmer os slutningen af tekst-delen (f.eks. når positionInSection > 0.52)
      const fadeOutStartRatio = 0.82 // Start fade-out når vi er 52% gennem tekst-delen (meget tæt på slutningen)
      const fadeOutRange = textSectionRatio - fadeOutStartRatio // Range for fade-out (0.55 - 0.52 = 0.03)
      
      // Opdater volume for hvert speech audio klip
      const speechAudios = [
        { audio: speechAudio, index: 0 },
        { audio: speech2Audio, index: 1 },
        { audio: speech3Audio, index: 2 },
        { audio: speech4Audio, index: 3 },
        { audio: speech5Audio, index: 4 },
        { audio: speech6Audio, index: 5 },
        { audio: speech7Audio, index: 6 },
        { audio: speech8Audio, index: 7 }
      ]
      
      speechAudios.forEach(({ audio, index }) => {
        if (!audio) return
        
        let targetVolume = 1.0
        
        // Hvis speak er slukket, sæt volume til 0
        if (!speakEnabled.value) {
          targetVolume = 0
        } else {
          if (clampedIndex === index) {
            // Vi er i denne tekst's sektion (enten tekst-delen eller pause-delen)
            if (isInTextPart) {
              // Vi er i tekst-delen - fuld lyd
              targetVolume = 1.0
            } else {
              // Vi er i pause-delen efter denne tekst - begynd at fade ud når vi nærmer os næste tekst
              // positionInSection går fra textSectionRatio til 1.0 i pause-delen
              // Start fade-out når vi er 80% gennem pause-delen (nærmer os næste tekst)
              const audioTextRatio = textSectionRatioOverrides[index] ?? textSectionRatio
              const pauseStart = audioTextRatio
              const pauseRange = 1.0 - pauseStart
              const fadeOutStartInPause = pauseStart + (pauseRange * 0.8) // Start fade-out ved 80% gennem pause
              
              if (positionInSection > fadeOutStartInPause) {
                // Beregn fade-out progress (0 til 1) fra fadeOutStartInPause til 1.0
                const fadeProgress = (positionInSection - fadeOutStartInPause) / (1.0 - fadeOutStartInPause)
                targetVolume = Math.max(0, 1 - fadeProgress)
              } else {
                // Fuld lyd i starten af pause-delen
                targetVolume = 1.0
              }
            }
          } else if (clampedIndex > index) {
            // Vi er kommet til den næste tekst-sektion eller længere - fade helt ud
            targetVolume = 0
          } else {
            // Vi er ikke i denne tekst's sektion endnu - ingen lyd
            targetVolume = 0
          }
        }
        
        // Smooth interpolation af volume
        audio.volume = lerp(audio.volume, targetVolume, 0.1)
        
        // Stop afspilning hvis volume er meget lav
        if (audio.volume < 0.01 && !audio.paused) {
          audio.pause()
          audio.currentTime = 0 // Reset til start
        }
      })
    }
    
    // Tjek afstand til metal gate billedet og afspil lyd hvis nær nok
    if (metalGateAudio && !metalGatePlayed && !isInLandingPhase) {
      const cameraPos = camera.position
      const distanceToMetalGate = cameraPos.distanceTo(metalGateImagePosition)
      
      // Afspil lyd når vi nærmer os billedet
      if (distanceToMetalGate <= metalGateTriggerDistance) {
        metalGatePlayed = true
        metalGateAudio.play().catch(err => {
          console.warn('Kunne ikke afspille metal gate audio:', err)
          // Reset så vi kan prøve igen hvis der var en fejl
          metalGatePlayed = false
        })
      }
    }
    
    // Tjek afstand til fontaine billedet og afspil water lyd hvis nær nok
    if (waterAudio && !waterPlayed && !isInLandingPhase) {
      const cameraPos = camera.position
      const distanceToWater = cameraPos.distanceTo(waterImagePosition)
      
      // Afspil lyd når vi nærmer os billedet
      if (distanceToWater <= waterTriggerDistance) {
        waterPlayed = true
        waterAudio.play().catch(err => {
          console.warn('Kunne ikke afspille water audio:', err)
          // Reset så vi kan prøve igen hvis der var en fejl
          waterPlayed = false
        })
      }
    }
    
    // Tjek afstand til sketchtræ billedet og afspil bask lyd hvis nær nok
    if (baskAudio && !baskPlayed && !isInLandingPhase) {
      const cameraPos = camera.position
      const distanceToBask = cameraPos.distanceTo(baskImagePosition)
      
      // Afspil lyd når vi nærmer os billedet
      if (distanceToBask <= baskTriggerDistance) {
        baskPlayed = true
        baskAudio.play().catch(err => {
          console.warn('Kunne ikke afspille bask audio:', err)
          // Reset så vi kan prøve igen hvis der var en fejl
          baskPlayed = false
        })
      }
    }
    
    frameCount++
    
    // Opdater kamera og blyant linje baseret på scroll
    updateCameraPosition()
    updatePencilLine()
    updateScrollText()
    updateIntroFade(deltaTime)
    // BEMÆRK: updateInfoButtons() flyttes til efter sceneImages.forEach loop'et
    // så imagePlane.visible er opdateret korrekt
    
    // LANDING PAGE: Skjul grid under landing fase for renere look
    if (gridHelper) {
      // Vis gridHelper under landing fase så brugeren kan se scenen er klar
      gridHelper.visible = true
    }
    
    // LANDING PAGE: Fog density - sikr fog er aktiv under landing fase
    // Fog density opdateres nu dynamisk i animation loop baseret på scroll progress
    if (!scene.fog) {
      // Opret fog hvis den ikke findes (sikkerhedscheck) - starter med 0.13
      scene.fog = new THREE.FogExp2(0xF0EEE9, 0.13)
    }
    
    // Belysning - konstant gennem hele oplevelsen
    if (ambientLightRef) {
      // Konstant ambient light intensity gennem hele oplevelsen
      ambientLightRef.intensity = 1.5
    }
    
    // Shadow settings - konstant gennem hele oplevelsen
    if (directionalLightRef) {
      // Konstant shadow radius gennem hele oplevelsen
      directionalLightRef.shadow.radius = 2
      
      // Konstant shadow camera område gennem hele oplevelsen
      directionalLightRef.shadow.camera.left = -30
      directionalLightRef.shadow.camera.right = 30
      directionalLightRef.shadow.camera.top = 30
      directionalLightRef.shadow.camera.bottom = -30
      directionalLightRef.shadow.camera.updateProjectionMatrix()
      
      // Konstant shadow bias gennem hele oplevelsen
      directionalLightRef.shadow.bias = -0.0001
    }
    
    // Emissive intensity - konstant gennem hele oplevelsen
    if (plane && plane.material) {
      // Konstant emissive intensity gennem hele oplevelsen
      plane.material.emissiveIntensity = 0.1
      plane.material.needsUpdate = true
    }
    
    // PERFORMANCE OPTIMIZATIONS APPLIED:
    // 1. Shadow map opløsning reduceret fra 2048x2048 til 1024x1024 (4x mindre memory)
    // 2. Shader optimeret: reduceret fra 3 til 2 noise lag (~33% hurtigere)
    // 3. Frustum culling: Billeder udenfor synsfeltet renderes ikke
    // 4. Distance-based shadow casting: Kun nære billeder kaster skygger
    // 5. Conditional updates: Kun opdaterer når værdier faktisk ændrer sig
    
    // Opdater gradient wipe progress for alle billeder baseret på afstand
    const cameraPos = camera.position
    const maxDistance = 15 // Maksimal afstand hvor billedet starter at fade ind
    const minDistance = 5  // Minimal afstand hvor billedet er fuldt synligt
    const shadowFadeStart = 0.0 // Start fade sammen med billedet
    const shadowFadeEnd = 1.0   // Fuld skygge når billedet er 100% synligt
    const cullDistance = 25 // Afstand hvor billeder skjules helt (frustum culling)
    // Øg shadowDistance på landing page så flere billeder kaster skygger
    const shadowDistance = 30 // Konstant shadow distance gennem hele oplevelsen
    
    // Frustum culling: Genbrug frustum objekter (object pooling for bedre performance)
    frustumMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    frustum.setFromProjectionMatrix(frustumMatrix)
    
    // Margin bag kameraet før billede disposes (i Z-koordinater)
    const behindCameraMargin = 8
    
    sceneImages.forEach((imageData, index) => {
      // LANDING PAGE: Under landing fase skal billederne være synlige og fade ud når man scroller ned
      if (isInLandingPhase) {
        const imagePos = imageData.imagePlane?.position
        // Vis billederne under landing fase uanset om tekstur er loadet eller ej
        // (teksturer er allerede loadet i warm-up, men vi sikrer at billederne vises)
        if (imagePos && imageData.imagePlane) {
          // Beregn landing progress for fade-out effekt
          const landingProgress = scrollProgress / landingScrollThreshold
          let imagesOpacity = 1
          
          // Fade billederne ud lige så snart man begynder at scrolle
          imagesOpacity = 1 - landingProgress
          
          // Skjul specifikke billeder på landing page
          const hiddenOnLandingPage = [
            '/pics/portFarve.png',
            '/pics/portSketch.png',
            '/pics/blomstKrukke.png',
            '/pics/fontaine.png',
            '/pics/Gemini_Generated_Image_phek2ephek2ephek 1.png',
            '/pics/hvideblomster.png',
            '/pics/højTræFarve.png',
            '/pics/image 22.png',
            '/pics/kruk.png',
            '/pics/lillablomst.png',
            '/pics/sketchtræ.png',
            '/pics/træPot.png'
          ]
          const isHiddenOnLanding = hiddenOnLandingPage.includes(imageData.config.path) ||
                                     imageData.config.id === 'portSketch' ||
                                     imageData.config.id === 'hvideblomster' ||
                                     imageData.config.id === 'sketch1' ||
                                     imageData.config.ignoreForLanding === true
          
          // Vis alle billeder under landing fase - sikr at de er synlige
          // Men skjul specifikke billeder på landing page
          imageData.imagePlane.visible = imagesOpacity > 0.01 && !isHiddenOnLanding
          
          // Sikr at billedet har tekstur hvis den er loadet
          if (imageData.textureLoaded && imageData.texture && imageData.imagePlane.material) {
            if (imageData.imagePlane.material.uniforms && imageData.imagePlane.material.uniforms.uTexture) {
              imageData.imagePlane.material.uniforms.uTexture.value = imageData.texture
            }
            imageData.imagePlane.material.needsUpdate = true
          }
          
          // Sikr at shadow planes er synlige og kaster skygger under landing fase
          // Men skjul shadow planes for specifikke billeder på landing page
          if (imageData.shadowPlane) {
            imageData.shadowPlane.visible = imagesOpacity > 0.01 && !isHiddenOnLanding
            // Beregn afstand til billedet for at bestemme om det skal kaste skygge
            const distanceToImage = imagePos ? cameraPos.distanceTo(imagePos) : Infinity
            // På landing page skal alle synlige billeder kaste skygger (op til shadowDistance)
            imageData.shadowPlane.castShadow = distanceToImage < shadowDistance && imagesOpacity > 0.01 && !isHiddenOnLanding
            // Sikr at shadow plane har tekstur loadet så skyggerne kan kastes korrekt
            if (imageData.textureLoaded && imageData.texture && imageData.shadowPlane.material) {
              imageData.shadowPlane.material.map = imageData.texture
              imageData.shadowPlane.material.needsUpdate = true
            }
          }
          
          // Opdater material opacity og wipe progress for smooth fade
          // Brug material.opacity direkte for fade-effekt
          if (imageData.imagePlane.material) {
            imageData.imagePlane.material.opacity = imagesOpacity
            imageData.imagePlane.material.transparent = true
            // Sikr at wipe progress er sat til 1 så billedet er fuldt synligt
            if (imageData.imagePlane.material.uniforms && imageData.imagePlane.material.uniforms.uWipeProgress) {
              imageData.imagePlane.material.uniforms.uWipeProgress.value = imagesOpacity
            }
            imageData.imagePlane.material.needsUpdate = true
          }
          
          // Opdater wipe progress tracking
          imageData.wipeProgress = imagesOpacity
          
          // Opdater shadow progress så skyggerne er synlige - gør dem meget mere synlige på landing page
          if (imageData.shadowPlane && imageData.shadowPlane.material) {
            // På landing page skal skyggerne være meget mere synlige
            // Brug højere opacity og sikr at shadow plane faktisk kaster skygger
            const shadowOpacity = imagesOpacity * 1.5 // Gør skyggerne 50% mere synlige på landing page
            imageData.lastShadowProgress = Math.min(1.0, shadowOpacity) // Cap ved 1.0
            // Vigtigt: Shadow material opacity skal være høj for at kaste synlige skygger
            imageData.shadowPlane.material.opacity = Math.min(1.0, shadowOpacity)
            imageData.shadowPlane.material.transparent = true
            imageData.shadowPlane.material.alphaTest = 0.01 // Lavere alpha test for bedre skygge-kastning
            imageData.shadowPlane.material.needsUpdate = true
          }
        } else {
          if (imageData.imagePlane) imageData.imagePlane.visible = false
          if (imageData.shadowPlane) imageData.shadowPlane.visible = false
        }
        // Skip resten af visibility logikken under landing fase
        return
      }
      
      const imageZ = imageData.config.position[2]
      
      // Tjek om kameraet har passeret billedet (kamera bevæger sig fra høj Z til lav Z)
      // Hvis kamera Z < billede Z - margin, er kameraet bagved billedet
      if (cameraPos.z < imageZ - behindCameraMargin) {
        // Kameraet har passeret billedet - dispose hvis ikke allerede disposed
        if (!imageData.disposed) {
          disposeSceneImage(imageData)
        }
        // Skip resten af opdateringerne for disposed billeder
        return
      } else {
        // Kameraet er foran eller nær billedet - genskab hvis disposed
        if (imageData.disposed) {
          recreateSceneImage(imageData)
        }
      }
      
      // Hvis billedet er disposed, skip resten (skal ikke ske efter recreate, men sikkerhedscheck)
      if (!imageData.imagePlane) return
      
      const imagePos = imageData.imagePlane.position
      const distance = cameraPos.distanceTo(imagePos)
      
      // LAZY LOADING: Load tekstur når kameraet kommer inden for lazyLoadDistance
      // Brug config.lazyLoadDistance hvis sat, ellers standard lazyLoadDistance
      const imageLazyLoadDistance = imageData.config.lazyLoadDistance !== undefined 
        ? imageData.config.lazyLoadDistance 
        : lazyLoadDistance
      if (!imageData.textureLoaded && !imageData.textureLoading && distance < imageLazyLoadDistance) {
        loadImageTexture(imageData)
      }
      
      // Frustum culling: Skjul billeder der er for langt væk eller udenfor synsfeltet
      if (distance > cullDistance) {
        imageData.imagePlane.visible = false
        if (imageData.shadowPlane) imageData.shadowPlane.visible = false
        return
      }
      
      // Beregn billedets maxDistance først (bruges både til frustum culling og progress)
      const imageMaxDistance = imageData.config.maxDistance !== undefined ? imageData.config.maxDistance : maxDistance
      
      // Tjek om billedet er inden for frustum (synsfeltet)
      const boundingSphere = new THREE.Sphere(imagePos, imageData.imagePlane.geometry?.parameters?.width || 5)
      const isInFrustum = frustum.intersectsSphere(boundingSphere)
      
      if (!isInFrustum && distance > imageMaxDistance) {
        imageData.imagePlane.visible = false
        if (imageData.shadowPlane) imageData.shadowPlane.visible = false
        return
      }
      
      // Vis billedet hvis det er inden for synsfeltet eller tæt nok på
      imageData.imagePlane.visible = true
      
      // Beregn base progress baseret på afstand (0 = langt væk, 1 = tæt på)
      // Hvis showAllImages er true, vis alle billeder (progress = 1)
      let baseProgress = 0
      if (showAllImages.value) {
        // Vis alle billeder fuldt synlige
        baseProgress = 1
      } else {
        // Brug normal distance-baseret wipe effekt
        if (distance > imageMaxDistance) {
          baseProgress = 0
        } else if (distance < minDistance) {
          baseProgress = 1
        } else {
          // Lineær interpolation mellem imageMaxDistance og minDistance
          baseProgress = 1 - ((distance - minDistance) / (imageMaxDistance - minDistance))
        }
        
        // Hvis dette billede venter på et andet billede, start først animation når det andet har nået en bestemt progress
        if (imageData.config.waitFor) {
          // Marker som fuldt synlig hvis vi har nået 0.99
          if (imageData.wipeProgress >= 0.99) {
            imageData.hasBeenFullyVisible = true
          }
          
          // Når billedet har været fuldt synligt én gang, opfører det sig som alle andre billeder
          if (imageData.hasBeenFullyVisible) {
            // Brug normal distance-baseret progress (samme som alle andre billeder)
            if (distance > imageMaxDistance) {
              baseProgress = 0
            } else if (distance < minDistance) {
              baseProgress = 1
            } else {
              baseProgress = 1 - ((distance - minDistance) / (imageMaxDistance - minDistance))
            }
          } else {
            // Billedet har ikke været fuldt synligt endnu - brug waitFor logik
            const waitForImage = sceneImages.find(img => img.config.id === imageData.config.waitFor)
            const requiredProgress = imageData.config.waitForProgress !== undefined ? imageData.config.waitForProgress : 1.0
            
            if (waitForImage && waitForImage.wipeProgress >= requiredProgress) {
              // Det billede vi venter på har nået den krævede progress - start animation
              if (!imageData.waitForComplete) {
                imageData.waitForComplete = true
                imageData.startScrollProgress = scrollProgress
              }
              
              // Beregn progress baseret på hvor meget vi har scrollet siden start
              const scrollAnimationLength = imageData.config.animationLength !== undefined ? imageData.config.animationLength : 0.05
              if (imageData.startScrollProgress !== null) {
                const scrollSinceStart = scrollProgress - imageData.startScrollProgress
                baseProgress = Math.min(1, Math.max(0, scrollSinceStart / scrollAnimationLength))
              }
            } else {
              // Venter stadig på det andet billede - skjul dette billede
              baseProgress = 0
            }
          }
        }
      }
      
      // Kun opdater hvis progress faktisk har ændret sig
      const previousWipeProgress = imageData.wipeProgress
      imageData.wipeProgress = baseProgress
      
      // Opdater shader uniform kun hvis værdien har ændret sig betydeligt
      if (imageData.imagePlane.material && imageData.imagePlane.material.uniforms) {
        const progressChanged = Math.abs(imageData.wipeProgress - previousWipeProgress) > 0.0001
        if (progressChanged) {
          imageData.imagePlane.material.uniforms.uWipeProgress.value = imageData.wipeProgress
        }
      }
      
      // Opdater shadow mesh - animer skyggen med opacity
      if (imageData.shadowPlane) {
        // Gem tidligere position og rotation for at kun opdatere når de ændrer sig
        const currentImagePos = imageData.imagePlane.position
        const currentImageRot = imageData.imagePlane.rotation
        
        // Initialiser tidligere position/rotation hvis de ikke findes
        if (!imageData.lastImagePosition) {
          imageData.lastImagePosition = currentImagePos.clone()
          imageData.lastImageRotation = currentImageRot.clone()
        }
        
        // Tjek om position eller rotation har ændret sig (brug distance og rotation forskel)
        const positionChanged = currentImagePos.distanceTo(imageData.lastImagePosition) > 0.0001
        const rotationChanged = Math.abs(currentImageRot.x - imageData.lastImageRotation.x) > 0.0001 ||
                                Math.abs(currentImageRot.y - imageData.lastImageRotation.y) > 0.0001 ||
                                Math.abs(currentImageRot.z - imageData.lastImageRotation.z) > 0.0001
        
        if (positionChanged || rotationChanged) {
          imageData.shadowPlane.position.copy(currentImagePos)
          imageData.shadowPlane.position.y -= 0.01 // Afstand for at undgå z-fighting
          imageData.shadowPlane.rotation.copy(currentImageRot)
          imageData.shadowPlane.scale.set(1, 1, 1)
          
          // Opdater gemte værdier
          imageData.lastImagePosition.copy(currentImagePos)
          imageData.lastImageRotation.copy(currentImageRot)
        }
        
        // Beregn target shadow fade progress (0 til 1)
        // Hvis showAllImages er true, vis skygger fuldt
        let targetShadowProgress = 0
        if (showAllImages.value) {
          targetShadowProgress = 1.0
        } else if (imageData.wipeProgress >= shadowFadeStart) {
          targetShadowProgress = Math.min(1.0, (imageData.wipeProgress - shadowFadeStart) / (shadowFadeEnd - shadowFadeStart))
        }
        
        // Smooth interpolation af shadow progress for glidende fade ind
        const previousShadowProgress = imageData.lastShadowProgress
        imageData.lastShadowProgress = lerp(imageData.lastShadowProgress, targetShadowProgress, 0.15)
        
        // Animer shadow opacity fra 0 til 1 for glidende fade-in af skyggen
        // Kun opdater material hvis værdien faktisk har ændret sig
        if (imageData.shadowPlane.material) {
          const opacityChanged = Math.abs(imageData.lastShadowProgress - previousShadowProgress) > 0.001
          if (opacityChanged) {
            imageData.shadowPlane.material.opacity = imageData.lastShadowProgress
            imageData.shadowPlane.material.needsUpdate = true
          }
        }
        
        // Performance optimering: Kun kast skygger for nære billeder (distance < shadowDistance)
        // Dette reducerer shadow map rendering betydeligt
        const shouldCastShadow = distance < shadowDistance && imageData.lastShadowProgress > 0.01
        imageData.shadowPlane.castShadow = shouldCastShadow
        // Skjul shadow plane helt når opacity er meget lav for at undgå blurry effekt
        imageData.shadowPlane.visible = imageData.lastShadowProgress > 0.01
      }
    })
    
    // Opdater info buttons EFTER at billede synlighed er opdateret
    updateInfoButtons()
    
    // Opdater wipe progress for pen model baseret på afstand
    if (penModel) {
      // LANDING PAGE: Vis pen model på landing page
      if (isInLandingPhase) {
        penModel.visible = true
      } else {
        penModel.visible = true
      }
      
      let penProgress = 0
      if (isInLandingPhase) {
        // Fade blyanten ud lige så snart man begynder at scrolle fra landing page
        const landingProgress = scrollProgress / landingScrollThreshold
        penProgress = 1 - landingProgress
      } else if (showAllImages.value) {
        // Vis pen model fuldt synlig
        penProgress = 1
      } else {
        // Brug normal distance-baseret wipe effekt
        const penPos = penModel.position
        const penDistance = cameraPos.distanceTo(penPos)
        const penMaxDistance = 18 // Maksimal afstand hvor modellen starter at fade ind
        const penMinDistance = 10  // Minimal afstand hvor modellen er fuldt synligt
        
        if (penDistance > penMaxDistance) {
          penProgress = 0
        } else if (penDistance < penMinDistance) {
          penProgress = 1
        } else {
          // Lineær interpolation mellem penMaxDistance og penMinDistance
          penProgress = 1 - ((penDistance - penMinDistance) / (penMaxDistance - penMinDistance))
        }
      }
      
      penWipeProgress = lerp(penWipeProgress, penProgress, 0.1)
      
      // Opdater shader uniform på alle meshes i modellen
      penModel.traverse((child) => {
        if (child.isMesh && child.material && child.material.uniforms) {
          child.material.uniforms.uWipeProgress.value = penWipeProgress
        }
      })
    }
    
    // Opdater wipe progress for brush model baseret på afstand
    if (brushModel) {
      // LANDING PAGE: Skjul brush model under landing fase
      if (isInLandingPhase) {
        brushModel.visible = false
      } else {
        brushModel.visible = true
      }
      
      let brushProgress = 0
      if (showAllImages.value) {
        // Vis brush model fuldt synlig
        brushProgress = 1
      } else {
        // Brug normal distance-baseret wipe effekt
        const brushPos = brushModel.position
        const brushDistance = cameraPos.distanceTo(brushPos)
        const brushMaxDistance = 18 // Maksimal afstand hvor modellen starter at fade ind
        const brushMinDistance = 8  // Minimal afstand hvor modellen er fuldt synligt
        
        if (brushDistance > brushMaxDistance) {
          brushProgress = 0
        } else if (brushDistance < brushMinDistance) {
          brushProgress = 1
        } else {
          // Lineær interpolation mellem brushMaxDistance og brushMinDistance
          brushProgress = 1 - ((brushDistance - brushMinDistance) / (brushMaxDistance - brushMinDistance))
        }
      }
      
      brushWipeProgress = lerp(brushWipeProgress, brushProgress, 0.1)
      
      // Opdater opacity på alle meshes i modellen (bevarer originale materialer)
      brushModel.traverse((child) => {
        if (child.isMesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material]
          materials.forEach((material) => {
            if (material) {
              material.opacity = brushWipeProgress
            }
          })
        }
      })
    }
    
    // Opdater flyvende specs
    if (particles && particleSystem && cameraPath) {
      const positions = particles.positions
      const velocities = particles.velocities
      const maxDistanceFromPath = 15 // Maksimal afstand fra pathen før partiklen "trækkes" tilbage
      const attractionStrength = 0.0005 // Styrke af "attraction" til pathen
      
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3
        
        const currentPos = new THREE.Vector3(positions[i3], positions[i3 + 1], positions[i3 + 2])
        
        // Opdater position baseret på hastighed
        positions[i3] += velocities[i].x
        positions[i3 + 1] += velocities[i].y
        positions[i3 + 2] += velocities[i].z
        
        // Find nærmeste punkt på pathen
        // Brug binary search eller sample flere punkter langs pathen
        let closestT = 0
        let closestDistance = Infinity
        const searchSteps = 50 // Antal samples langs pathen
        for (let j = 0; j <= searchSteps; j++) {
          const t = j / searchSteps
          const pathPoint = cameraPath.getPoint(t)
          const distance = currentPos.distanceTo(pathPoint)
          if (distance < closestDistance) {
            closestDistance = distance
            closestT = t
          }
        }
        
        // Hvis partiklen er for langt væk fra pathen, træk den mod pathen
        if (closestDistance > maxDistanceFromPath) {
          const closestPathPoint = cameraPath.getPoint(closestT)
          const directionToPath = new THREE.Vector3().subVectors(closestPathPoint, currentPos).normalize()
          const pullStrength = (closestDistance - maxDistanceFromPath) * attractionStrength
          
          // Tilføj "attraction" til hastigheden
          velocities[i].x += directionToPath.x * pullStrength
          velocities[i].z += directionToPath.z * pullStrength
        }
        
        // Tilføj lidt tilfældig variation for organisk bevægelse
        velocities[i].x += (Math.random() - 0.5) * 0.0002
        velocities[i].y += (Math.random() - 0.5) * 0.0001
        velocities[i].z += (Math.random() - 0.5) * 0.0002
        
        // Begræns hastighed (meget langsom)
        velocities[i].x = Math.max(-0.008, Math.min(0.008, velocities[i].x))
        velocities[i].y = Math.max(-0.004, Math.min(0.004, velocities[i].y))
        velocities[i].z = Math.max(-0.008, Math.min(0.008, velocities[i].z))
        
        // Wrap Y position (højde)
        if (positions[i3 + 1] > 3) positions[i3 + 1] = 0.5
        if (positions[i3 + 1] < 0.5) positions[i3 + 1] = 3
      }
      
      // Opdater geometri
      particles.geometry.attributes.position.needsUpdate = true
    }
    
    // Opdater fugleflok (deaktiveret)
    // if (flockRef.value) {
    //   flockRef.value.update()
    // }
    
    // Opdater 3D fugl
    if (bird3DRef.value) {
      bird3DRef.value.update()
    }
    
    // WASD movement (kun hvis ikke scrollet)
    if (scrollProgress === 0) {
      const direction = new THREE.Vector3()
      const right = new THREE.Vector3()
      camera.getWorldDirection(direction)
      right.crossVectors(direction, camera.up).normalize()
      
      if (keys.w) {
        camera.position.addScaledVector(direction, moveSpeed)
      }
      if (keys.s) {
        camera.position.addScaledVector(direction, -moveSpeed)
      }
      // A og D bruges nu til rotation i stedet for side-bevægelse
    }
    
    // 3D Navigation visibility og fade
    if (navGroup && navMeshes.length > 0) {
      // Beregn t værdi for at tjekke om vi er ved enden
      const t = scrollProgress >= cameraStartThreshold ? 
        Math.min(pathEndPoint, (scrollProgress - cameraStartThreshold) / (1 - cameraStartThreshold) * pathEndPoint) : 0
      
      // Vis navigation når vi er tæt på enden (t >= pathEndPoint - 0.05)
      const navThreshold = pathEndPoint - 0.05
      const shouldShowNav = t >= navThreshold && !isInLandingPhase
      
      if (shouldShowNav && !navVisible) {
        // Show the DOM for end-nav immediately but delay the GSAP entry animation
        if (use3DNav) navGroup.visible = true
        navVisible = true

        // Clear previous animation timeout if any
        if (navShowTimeout) {
          clearTimeout(navShowTimeout)
          navShowTimeout = null
        }

        // Reset links to initial hidden state then animate after delay
        try { gsap.set('.end-nav a', { opacity: 0, y: 60 }) } catch (e) {}
        navShowTimeout = setTimeout(() => {
          nextTick(() => {
            try {
              gsap.fromTo('.end-nav a',
                { opacity: 0, y: 60 },
                { opacity: 1, y: 0, duration: 0.9, stagger: 0.09, ease: 'power3.out', delay: navAnimationDelay }
              )
            } catch (e) {
              console.warn('GSAP nav animation failed', e)
            }
          })
          navShowTimeout = null
        }, navShowDelay * 1000)
      } else if (!shouldShowNav && (navVisible || navShowTimeout)) {
        // Cancel pending animation and hide immediately
        if (navShowTimeout) {
          clearTimeout(navShowTimeout)
          navShowTimeout = null
        }
        if (use3DNav) navGroup.visible = false
        navVisible = false
        try { gsap.set('.end-nav a', { opacity: 0, y: 20 }) } catch (e) {}
      }
      
      // Fade opacity
      if (navVisible) {
        const fadeProgress = Math.min(1, (t - navThreshold) / 0.05) // Fade over de sidste 5%
        if (use3DNav) {
          navMeshes.forEach(mesh => {
            mesh.material.opacity = fadeProgress * 0.95
          })
        }
        // Animér underlines width (scaleX) mod target med smooth interpolation (ligesom burger menu)
        if (use3DNav) {
          navUnderlines.forEach(underline => {
          const currentScaleX = underline.scale.x
          const targetScaleX = underline.userData.targetScaleX * fadeProgress
          // Smooth interpolation (0.2 = hurtigere, 0.1 = langsommere) - ligner burger menu transition
          underline.scale.x = currentScaleX + (targetScaleX - currentScaleX) * 0.2
          
          // Opdater opacity baseret på scale (fuld opacity når scale > 0)
          underline.material.opacity = fadeProgress * (targetScaleX > 0 ? 1 : 0)
          })
        }
      } else {
        navMeshes.forEach(mesh => {
          mesh.material.opacity = 0
        })
        navUnderlines.forEach(underline => {
          underline.scale.x = 0
          underline.material.opacity = 0
          underline.userData.targetScaleX = 0
        })
      }
    }
    
    renderer.render(scene, camera)
    
    // Debug: Advar ved langsomme frames
    const frameTime = performance.now() - frameStart
    if (frameTime > 20) { // Over 20ms = under 50fps
      console.warn(`⚠️ Slow frame: ${frameTime.toFixed(1)}ms at scroll ${scrollProgress.toFixed(3)}, Camera Z: ${camera.position.z.toFixed(2)}`)
    }
  }
  
  // Start warm-up og derefter animation loop
  // Audio initialiseres nu i performWarmUp for at sikre de er loadet før start
  performWarmUp().then(() => {
    // Start animation loop FØR landing page vises - så hele 3D scenen er klar
    animate()
    
    // Nature audio starter nu kun når brugeren klikker på "CLICK FOR SOUND"
    // (fjernet auto-play for at kræve user interaction)
  });
  
  // Håndter window resize
  const handleResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    updateCameraFOV() // Opdater FOV baseret på skærmstørrelse
    renderer.setSize(window.innerWidth, window.innerHeight)
    updateVh() // Opdater --vh for mobil viewport
  };
  window.addEventListener('resize', handleResize);
  
  // Lyt også til visualViewport resize (vigtigt for mobil browser UI)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateVh)
  }
  
  // Initial --vh beregning
  updateVh()
});

// Toggle info popup
const toggleInfo = (index) => {
  if (activeInfoIndex.value === index) {
    activeInfoIndex.value = null
  } else {
    activeInfoIndex.value = index
  }
}

// Luk info popup når der klikkes udenfor
const closeInfo = () => {
  activeInfoIndex.value = null
}

// Save scroll progress before navigating away
const saveScrollProgress = () => {
  localStorage.setItem('gardenScrollProgress', scrollProgress.toString())
  localStorage.setItem('gardenTotalScroll', totalScroll.toString())
}

// Navigate to route from 2D end-links
const goToRoute = (route) => {
  saveScrollProgress()
  router.push(route)
}


onUnmounted(() => {
  // Stop auto-scroll hvis aktiv
  if (isAutoScrolling.value) {
    stopAutoScroll()
  }
  
  // Unlock body overflow when leaving 3D view
  document.documentElement.classList.remove('locked')
  document.body.classList.remove('locked')
  
  // Reset cursor style
  document.body.style.cursor = 'default'
  
  if (handleResize) {
    window.removeEventListener('resize', handleResize)
  }
  // Fjern visualViewport listener
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', updateVh)
  }
  if (handleScroll) {
    window.removeEventListener('wheel', handleScroll)
  }
  if (handleMouseMove) {
    window.removeEventListener('mousemove', handleMouseMove)
  }
  if (handleKeyDown) {
    window.removeEventListener('keydown', handleKeyDown)
  }
  if (handleKeyUp) {
    window.removeEventListener('keyup', handleKeyUp)
  }
  if (handleNavClick) {
    window.removeEventListener('click', handleNavClick)
  }
  // Clear any pending nav show timeout
  if (navShowTimeout) {
    clearTimeout(navShowTimeout)
    navShowTimeout = null
  }
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  // Cleanup 3D navigation
  if (navGroup) {
    navMeshes.forEach(mesh => {
      if (mesh.geometry) mesh.geometry.dispose()
      if (mesh.material) {
        if (mesh.material.map) mesh.material.map.dispose()
        mesh.material.dispose()
      }
    })
    navUnderlines.forEach(underline => {
      if (underline.geometry) underline.geometry.dispose()
      if (underline.material) underline.material.dispose()
    })
    scene.remove(navGroup)
    navMeshes = []
    navUnderlines = []
  }
  // Stop og cleanup audio
  if (natureAudio) {
    natureAudio.pause()
    natureAudio = null
  }
  if (metalGateAudio) {
    metalGateAudio.pause()
    metalGateAudio = null
  }
  if (waterAudio) {
    waterAudio.pause()
    waterAudio = null
  }
  if (baskAudio) {
    baskAudio.pause()
    baskAudio = null
  }
  if (speechAudio) {
    speechAudio.pause()
    speechAudio = null
  }
  if (speech2Audio) {
    speech2Audio.pause()
    speech2Audio = null
  }
  if (speech3Audio) {
    speech3Audio.pause()
    speech3Audio = null
  }
  if (speech4Audio) {
    speech4Audio.pause()
    speech4Audio = null
  }
  if (speech5Audio) {
    speech5Audio.pause()
    speech5Audio = null
  }
  if (speech6Audio) {
    speech6Audio.pause()
    speech6Audio = null
  }
  if (speech7Audio) {
    speech7Audio.pause()
    speech7Audio = null
  }
  if (speech8Audio) {
    speech8Audio.pause()
    speech8Audio = null
  }
  if (pencilLineGroup) {
    // Ryd op i alle linjer i gruppen
    pencilLineGroup.children.forEach(child => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) child.material.dispose()
    })
    scene.remove(pencilLineGroup)
  }
  if (gridHelper) {
    scene.remove(gridHelper)
  }
  if (paperTexture) {
    paperTexture.dispose()
  }
  if (bumpTexture) {
    bumpTexture.dispose()
  }
  // Cleanup displacement canvas
  if (displacementAnimationId) {
    cancelAnimationFrame(displacementAnimationId)
  }
  // Dispose alle billeder i scenen
  sceneImages.forEach((imageData) => {
    if (imageData.imagePlane) {
      if (imageData.imagePlane.geometry) imageData.imagePlane.geometry.dispose()
      if (imageData.imagePlane.material) {
        imageData.imagePlane.material.dispose()
      }
      scene.remove(imageData.imagePlane)
    }
    if (imageData.shadowPlane) {
      if (imageData.shadowPlane.geometry) imageData.shadowPlane.geometry.dispose()
      if (imageData.shadowPlane.material) {
        imageData.shadowPlane.material.dispose()
      }
      scene.remove(imageData.shadowPlane)
    }
    if (imageData.texture) {
      imageData.texture.dispose()
    }
  })
  sceneImages = []
  if (particleSystem) {
    particleSystem.geometry.dispose()
    if (particleSystem.material) {
      if (particleSystem.material.map) {
        particleSystem.material.map.dispose()
      }
      particleSystem.material.dispose()
    }
    scene.remove(particleSystem)
  }
  if (particleCircleTexture) {
    particleCircleTexture.dispose()
    particleCircleTexture = null
  }
  if (penModel) {
    // Traverse model og dispose alle materialer og geometrier
    penModel.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose()
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose())
          } else {
            child.material.dispose()
          }
        }
      }
    })
    scene.remove(penModel)
  }
  if (brushModel) {
    // Traverse model og dispose alle materialer og geometrier
    brushModel.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose()
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose())
          } else {
            child.material.dispose()
          }
        }
      }
    })
    scene.remove(brushModel)
  }
  if (renderer) {
    renderer.dispose()
  }
})
</script>

<template>
  <div ref="containerRef" class="container">
    <!-- Loading screen / warm-up overlay -->
    <Transition name="fade">
      <div v-if="!isWarmedUp" class="loading-overlay">
        <div class="loading-paper-texture"></div>
        <p class="loading-percent">{{ warmUpProgress }}%</p>
      </div>
    </Transition>
    
    <Nav :opacity="headerLogoOpacity" :is-warmed-up="isWarmedUp" :on-navigate="saveScrollProgress" />
    
    <!-- Audio controls - Atmosphere and Speak toggles -->
    <div class="audio-controls" :style="{ opacity: headerLogoOpacity }">
      <button 
        class="audio-toggle" 
        :class="{ 'active': atmosphereEnabled }"
        @click="atmosphereEnabled = !atmosphereEnabled"
        title="Toggle atmosphere audio"
      >
        Atmosphere: <strong>{{ atmosphereEnabled ? 'ON' : 'OFF' }}</strong>
      </button>
      <button 
        class="audio-toggle" 
        :class="{ 'active': speakEnabled }"
        @click="speakEnabled = !speakEnabled"
        title="Toggle speech audio"
      >
        Speak: <strong>{{ speakEnabled ? 'ON' : 'OFF' }}</strong>
      </button>
    </div>
    
    <!-- Fast scroll toggle (developer) -->
    <div class="fast-scroll-toggle-wrapper">
      <button class="fast-scroll-toggle" :class="{ active: manualScrollEnabled }" @click="toggleFastScroll" title="Toggle fast scroll">
        {{ manualScrollEnabled ? 'FAST SCROLL ON' : 'FAST SCROLL OFF' }}
      </button>
    </div>
    
    <!-- Landing page hero section - Cinematic entrance -->
    <!-- Vis kun landing page når hele 3D oplevelsen er loadet -->
    <div v-if="isWarmedUp" class="landing-hero" :class="{ 'animate-entrance': landingAnimationStarted }" :style="{ opacity: landingLogoOpacity, cursor: soundClicked ? 'default' : 'pointer' }" @click="handleSoundClick">
      <!-- Hero baggrund -->
      <div 
        class="landing-hero-bg"
        :class="{ 'animate-in': landingAnimationStarted }"
        :style="{ 
          transform: `translateY(${scrollProgress * 20}px) scale(1.1)` 
        }"
      ></div>
      <!-- Papir tekstur overlay der dækker hele viewport -->
      <div 
        class="landing-paper-overlay"
        :class="{ 'animate-in': landingAnimationStarted }"
      ></div>
      <!-- Radial reveal mask -->
      <div class="landing-reveal-mask" :class="{ 'animate-in': landingAnimationStarted }"></div>
      <!-- Top SVG logo -->
      <img 
        ref="landingTopSvgRef"
        v-if="scrollProgress < landingScrollThreshold"
        src="/logo/OldTyndtLogo.svg"
        alt="Logo"
        class="landing-top-svg"
        :style="{ opacity: landingLogoOpacity }"
      />
      <!-- Hero indhold -->
      <div 
        class="landing-hero-content"
      >
        <!-- Landing image med displacement effekt -->
        <!-- <canvas 
          v-if="scrollProgress < landingScrollThreshold"
          ref="landingDisplacementCanvas"
          class="landing-displacement-canvas"
          :style="{ opacity: landingLogoOpacity }"
        ></canvas> -->
      </div>
    </div>
    
    
    <!-- Explore knap på landing page -->
    <button 
      v-if="isWarmedUp && scrollProgress < landingScrollThreshold"
      class="explore-button"
      :style="{ opacity: landingLogoOpacity }"
      @click="startAutoScroll"
    >
      Explore
    </button>
    
    <!-- Introduktion tekst med fade effekt -->
    <div 
      v-if="introVisible" 
      class="intro-text"
      :style="{ opacity: introOpacity }"
    >Introduction</div>
    
    <div v-if="currentText" class="scroll-text" :style="{ opacity: textOpacity }">{{ currentText }}</div>
    
    <!-- Info knapper til hvert billede -->
    <template v-for="(pos, index) in infoButtonPositions" :key="index">
      <div 
        v-if="pos.visible && imageConfigs[index]?.info"
        class="info-button"
        :style="{ 
          left: pos.x + 'px', 
          top: pos.y + 'px',
          opacity: pos.visible ? 1 : 0
        }"
        @click.stop="toggleInfo(index)"
      >
        <div class="info-circle"></div>
        
        <!-- Info popup -->
        <Transition name="info-fade">
          <div 
            v-if="activeInfoIndex === index" 
            class="info-popup"
            @click.stop
          >
            <p>{{ imageConfigs[index].info }}</p>
          </div>
        </Transition>
      </div>
    </template>
    
    <!-- Usynlig overlay til at lukke info popup -->
    <div 
      v-if="activeInfoIndex !== null" 
      class="info-overlay"
      @click="closeInfo"
    ></div>

    <!-- 2D end navigation links (replaces 3D nav meshes) -->
    <div v-if="navVisible" class="end-nav">
      <ul>
        <li v-for="link in navLinks" :key="link.route">
          <a href="" @click.prevent="goToRoute(link.route)">
            <span class="end-nav-label">{{ link.label }}</span>
            <span class="end-nav-underline" aria-hidden="true"></span>
          </a>
        </li>
      </ul>
    </div>
  </div>
  <!-- <Flock v-if="scene" ref="flockRef" :scene="scene" /> -->
  <Bird3D v-if="scene" ref="bird3DRef" :scene="scene" />
</template>

<style scoped>
/* Alga font skal tilføjes via @font-face eller Adobe Fonts */
@font-face {
  font-family: 'Alga';
  src: url('/font/Alga-Regular.woff2') format('woff2'),
       url('/font/Alga-Regular.woff') format('woff');
  font-weight: normal;
  font-style: normal;
}

.container {
  width: 100vw;
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100); /* Mobil viewport fix */
  margin: 0;
  padding: 0;
  overflow: hidden;
  position: relative;
}

/* Ensure canvas doesn't block pointer events to Nav */
.container canvas {
  pointer-events: auto;
  position: relative;
  z-index: 0;
}


/* ═══════════════════════════════════════════════════════════════════════════
   CINEMATIC LANDING PAGE - AWWWARDS WORTHY ENTRANCE
   ═══════════════════════════════════════════════════════════════════════════ */

/* Top SVG text */
.landing-top-svg {
  position: absolute;
  bottom: 2vh;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 96vw;
  height: auto;
  z-index: 100;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform, opacity, scale; /* Optimize for animation */
  transform-origin: center center; /* Scale from center */
}

.landing-top-svg img {
  width: 100%;
  height: auto;
  max-width: 90vw;
  object-fit: contain;
}

.landing-top-svg svg {
  width: 100%;
  height: auto;
  max-width: 90vw;
}

.landing-hero {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  z-index: 1000;
  transition: opacity 0.1s cubic-bezier(0.4, 0, 0.2, 1);
  perspective: 2000px;
  transform-style: preserve-3d;
}

/* Hero background - hidden */
.landing-hero-bg {
  position: absolute;
  inset: -30%;
  background: transparent;
  z-index: 0;
  display: none; /* Fjernet baggrund */
}

/* Radial reveal mask - disabled, fully transparent */
.landing-reveal-mask {
  position: absolute;
  inset: 0;
  background: transparent;
  z-index: 5;
  pointer-events: none;
}

.landing-hero-content {
  position: relative;
  z-index: 6;
  text-align: center;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.landing-displacement-canvas {
  max-width: 100vw;
  max-height: 100vh;
  width: auto;
  height: auto;
  z-index: 8;
  pointer-events: none;
  mix-blend-mode: multiply;
  margin-top: 10vh;
}

/* 2D end navigation styling - centered, stacked, Boska font */
.end-nav {
  position: absolute;
  inset: 0; /* full viewport overlay */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  pointer-events: auto;
  background: transparent;
  /* Slight right offset to nudge links from center (increased further) */
  transform: translateX(clamp(3rem, 16vw, 10rem));
}
.end-nav ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(1rem, 4vw, 3rem);
  align-items: flex-end; /* Right-align items */
  justify-content: center;
}
.end-nav li {
  margin: 0;
}
.end-nav a {
  font-family: 'Boska-Variable', 'Boska-Regular', serif;
  font-weight: 300;
  font-size: clamp(2.25rem, 9vw, 7rem);
  color: #1a1a1a;
  text-decoration: none;
  text-transform: uppercase;
  letter-spacing: normal; /* Remove extra spacing */
  text-align: right; /* Right-align text */
  display: block;
  padding: 0.1rem 0.25rem;
  line-height: 1;
  pointer-events: auto;
  opacity: 0; /* start hidden for fade-in */
  transform: translateY(20px); /* slide in from below */
}
.end-nav a:hover {
  text-decoration: underline;
}

/* Underline that animates out on hover (scaleX) */
.end-nav-underline {
  display: block;
  width: 100%;
  height: 5px;
  background: #4a6741; /* same green as 3D underline */
  transform-origin: right center; /* expand from right to left */
  transform: scaleX(0);
  transition: transform 0.54s cubic-bezier(0.22, 1, 0.36, 1);
  margin-top: 0.35rem;
}
.end-nav a:hover .end-nav-underline,
.end-nav a:focus .end-nav-underline,
.end-nav a:focus-visible .end-nav-underline {
  transform: scaleX(1);
}

.end-nav-label {
  display: inline-block;
}

@media (max-width: 640px) {
  .end-nav a {
    font-size: clamp(1.6rem, 9vw, 4rem);
    letter-spacing: normal;
  }
}

/* Stagger handled by GSAP; CSS-only delays/keys removed to avoid conflict */

.landing-hjemtegning-image {
  position: relative;
  max-width: 80vw;
  max-height: 80vh;
  width: auto;
  height: auto;
  object-fit: contain;
  z-index: 8;
  pointer-events: none;
  mix-blend-mode: multiply;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MOBILE / PORTRAIT LAYOUT
   ═══════════════════════════════════════════════════════════════════════════ */

/* Paper overlay with grain effect */
.landing-paper-overlay {
  position: fixed;
  top: -5%;
  left: -5%;
  width: 110vw;
  height: 110vh;
  background: url('/texture/paper.png');
  background-size: 500px 500px;
  background-repeat: repeat;
  pointer-events: none;
  z-index: 7;
  mix-blend-mode: multiply;
  opacity: 0.8;
  display: block;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}

.landing-paper-overlay.animate-in {
  /* Allerede synlig - behøver ingen opacity ændring */
  transform: scale(1);
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOGO CONTAINER & GLOW EFFECT
   ═══════════════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════════════════
   SCROLL TO EXPLORE - REFINED ANIMATION
   ═══════════════════════════════════════════════════════════════════════════ */

.scroll-to-explore-text {
  position: fixed;
  pointer-events: none;
  font-size: 0.65rem;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  opacity: 0.9;
  color: rgba(26, 26, 26, 0.95);
  font-family: 'Boska-Regular', serif;
  transform: translate(-50%, -50%);
  z-index: 1001;
  transition: opacity 0.1s cubic-bezier(0.4, 0, 0.2, 1), 
              transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  will-change: transform, opacity;
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXPLORE BUTTON - Landing page auto-scroll
   ═══════════════════════════════════════════════════════════════════════════ */

.explore-button {
  position: fixed;
  top: calc(50% - 50px);
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1002;
  font-family: 'Boska-Regular', serif;
  font-size: clamp(0.85rem, 1.1vw, 1.1rem);
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: #1a1a1a;
  background: transparent;
  border: 1px solid rgba(26, 26, 26, 0.3);
  padding: 0.85rem 2.8rem;
  cursor: pointer;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: auto;
  backdrop-filter: blur(2px);
}

.explore-button:active {
  transform: translate(-50%, -50%) scale(0.97);
}

@keyframes scrollLineGrow {
  0% {
    height: 0;
    opacity: 0;
  }
  100% {
    height: 50px;
    opacity: 1;
  }
}

@keyframes scrollLinePulse {
  0%, 100% {
    transform: translateX(-50%) scaleY(1);
    opacity: 0.6;
  }
  50% {
    transform: translateX(-50%) scaleY(1.15);
    opacity: 0.3;
  }
}

@keyframes scrollDotReveal {
  0% {
    transform: translateX(-50%) scale(0);
    opacity: 0;
  }
  100% {
    transform: translateX(-50%) scale(1);
    opacity: 1;
  }
}

@keyframes scrollDotPulse {
  0%, 100% {
    transform: translateX(-50%) scale(1);
    opacity: 0.6;
    box-shadow: 0 0 10px rgba(74, 103, 65, 0.4);
  }
  50% {
    transform: translateX(-50%) scale(1.5);
    opacity: 0.3;
    box-shadow: 0 0 20px rgba(74, 103, 65, 0.6);
  }
}


@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(8px);
  }
  60% {
    transform: translateY(4px);
  }
}


.intro-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
  font-size: clamp(3rem, 8vw, 7rem);
  font-weight: 400;
  color: #1a1a1a;
  text-align: center;
  pointer-events: none;
  font-family: 'Boska-Regular', serif;
  letter-spacing: 0.15em;
  transition: opacity 0.1s ease-out;
}

@media (max-width: 768px) {
  .intro-text {
    top: 35%;
    transform: translate(-50%, -50%);
  }
}

.scroll-text {
  position: absolute;
  bottom: 4rem;
  left: 4rem;
  z-index: 1000;
  font-size: clamp(0.9rem, 1.2rem + 0.4vw, 1.7rem);
  font-weight: 400;
  color: #000000;
  text-align: left;
  pointer-events: none;
  font-family: 'Boska-Regular', serif;
  letter-spacing: 0.02em;
  transition: opacity 0.5s ease-in-out;
  max-width: 30%;
}

@media (max-width: 768px) {
  .scroll-text {
    font-size: 0.875rem;
    max-width: 70%;
    left: 1.5rem;
    bottom: calc(var(--vh, 1vh) * 8); /* Dynamisk bottom baseret på viewport */
  }
}

/* Audio controls - Atmosphere and Speak toggles */
.audio-controls {
  position: absolute;
  bottom: 2rem;
  right: 3rem;
  z-index: 1001;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-family: 'Boska-Regular', serif;
}

.fast-scroll-toggle-wrapper {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  z-index: 1400;
}
.fast-scroll-toggle {
  font-family: 'Boska-Regular', serif;
  font-size: 0.85rem;
  padding: 0.45rem 0.75rem;
  border-radius: 6px;
  border: 1px solid rgba(26,26,26,0.12);
  background: rgba(255,255,255,0.9);
  color: #1a1a1a;
  cursor: pointer;
}
.fast-scroll-toggle.active {
  background: #1a1a1a;
  color: #fff;
  border-color: rgba(0,0,0,0.2);
}

@media (max-width: 900px) {
  .audio-controls {
    right: 1.5rem;
  }
}

.audio-toggle {
  font-size: 0.875rem;
  font-weight: 400;
  color: #666666;
  background: transparent;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  pointer-events: auto;
  user-select: none;
  font-family: 'Boska-Regular', serif;
  text-align: right;
}

.audio-toggle:hover {
  background: transparent;
  color: #000000;
}

.audio-toggle.active {
  color: #000000;
}

.audio-toggle strong {
  color: #000000;
  font-weight: 600;
}

/* Loading / Warm-up overlay */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #F0EEE9;
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}

.loading-paper-texture {
  position: absolute;
  top: -5%;
  left: -5%;
  width: 110%;
  height: 110%;
  background: url('/texture/paper.png');
  background-size: 500px 500px;
  background-repeat: repeat;
  mix-blend-mode: multiply;
  opacity: 0.8;
  pointer-events: none;
}

.loading-percent {
  font-family: 'Boska-Regular', serif;
  font-size: clamp(4rem, 15vw, 12rem);
  font-weight: 400;
  color: #1a1a1a;
  margin: 0;
  padding: 2rem 0 0 3rem;
  z-index: 1;
  line-height: 1;
}

/* Fade transition for loading overlay */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Info knapper */
.info-button {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  cursor: pointer;
  transition: opacity 0.3s ease;
  pointer-events: auto;
  padding: 12px;
  /* Gør hele området klikbart, ikke kun selve cirklen */
}

.info-circle {
  width: 8px;
  height: 8px;
  background: #1a1a1a;
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.info-button:hover .info-circle {
  transform: scale(1.3);
}

.info-popup {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 0.5rem;
  min-width: 180px;
  max-width: 250px;
  z-index: 2001;
  background: #ffffff;
  padding: 0.75rem 1rem;
  border-radius: 4px;
}

.info-popup p {
  margin: 0;
  font-family: 'Boska-Regular', serif;
  font-size: 0.85rem;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: #1a1a1a;
}

.info-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1999;
  cursor: default;
}

/* Info popup fade transition */
.info-fade-enter-active,
.info-fade-leave-active {
  transition: opacity 0.2s ease;
}

.info-fade-enter-from,
.info-fade-leave-to {
  opacity: 0;
}

</style>

