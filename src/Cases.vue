<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import * as THREE from 'three'
import Nav from './Nav.vue'
import Footer from './components/Footer.vue'

const visibleSections = ref(new Set())
const canvasRef = ref(null)
const gallerySectionRef = ref(null)
const scrollContainer = ref(null)
const stickyWrapper = ref(null)

// --- SMOOTH SCROLL STATE ---
const currentScroll = ref(0)
let targetScroll = 0
let rafId = null
let isRunning = false
const ease = 0.08

// Touch state for mobile
let touchStartY = 0
let isMobile = false

const cases = [
  { id: 1, title: 'A Coastal Garden', location: 'Coastal', category: 'residential', year: '2024', image: '/pics/casesPics/acoastalgarden-min.jpg' },
  { id: 2, title: 'A Cottage Garden', location: 'Countryside', category: 'residential', year: '2024', image: '/pics/casesPics/acottagegarden-min.jpg' },
  { id: 3, title: 'A Modern Garden', location: 'Urban', category: 'urban', year: '2024', image: '/pics/casesPics/AModernGarden-min.png' },
  { id: 4, title: 'A Rural Garden', location: 'Countryside', category: 'residential', year: '2024', image: '/pics/casesPics/aruralgarden-min.jpg' },
  { id: 5, title: 'Beach House', location: 'Coastal', category: 'residential', year: '2023', image: '/pics/casesPics/beachhouse-min.jpg' },
  { id: 6, title: 'Brighton Garden', location: 'Brighton', category: 'residential', year: '2024', image: '/pics/casesPics/brightongarden-min.jpg' },
  { id: 7, title: 'Cobham Garden', location: 'Cobham', category: 'residential', year: '2023', image: '/pics/casesPics/cobham-min.jpg' },
  { id: 8, title: 'Copenhagen Garden', location: 'Copenhagen', category: 'urban', year: '2024', image: '/pics/casesPics/copenhagengarden-min.jpg' },
  { id: 9, title: 'Courtyard Garden', location: 'Urban', category: 'urban', year: '2023', image: '/pics/casesPics/courtyardgarden-min.png' },
  { id: 10, title: 'CPH Garden', location: 'Copenhagen', category: 'urban', year: '2024', image: '/pics/casesPics/cphgarden-min.jpg' },
  { id: 11, title: 'Entertainment Garden', location: 'Estate', category: 'estate', year: '2023', image: '/pics/casesPics/entertainmentgarden-min.jpg' },
  { id: 12, title: 'London Garden', location: 'London', category: 'urban', year: '2024', image: '/pics/casesPics/londongarden-min.jpg' },
  { id: 13, title: 'Oxshott Garden', location: 'Oxshott', category: 'residential', year: '2024', image: '/pics/casesPics/Our-Landscape-Designs-Oxshott-Garden-Plan-Ourlandscapedesigns.com_-min-min.png' },
  { id: 14, title: 'Seaside Garden', location: 'Coastal', category: 'residential', year: '2023', image: '/pics/casesPics/Our-Landscape-Designs-garden-design-designer-Ourlandscapedesigns.com-copy-min-min.jpg' },
  { id: 15, title: 'St. Georges Hill', location: 'Surrey', category: 'estate', year: '2024', image: '/pics/casesPics/stgeorgeshill-min.png' },
  { id: 16, title: 'Summer House', location: 'Countryside', category: 'residential', year: '2023', image: '/pics/casesPics/summerhouse-min.jpg' },
  { id: 17, title: 'Tudor House', location: 'Historic', category: 'residential', year: '2024', image: '/pics/casesPics/tudorhouse.jpg' },
]

const currentCaseIndex = ref(0)
const currentCase = computed(() => cases[currentCaseIndex.value] || cases[0])

// Show titles as sentence-case: first letter uppercase, rest lowercase
const displayTitle = computed(() => {
  const t = currentCase.value && currentCase.value.title ? String(currentCase.value.title) : ''
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : ''
})

let scene, camera, renderer, animationId
let imagePlanes = []
const textureLoader = new THREE.TextureLoader()

const PLANE_WIDTH = 14
const PLANE_HEIGHT = 9
const LERP_FACTOR = 0.08
let threeScrollOffset = 0
let threeTargetOffset = 0

// Idle pivot state for first image
let lastThreeTimestamp = 0
let userStartedGalleryScroll = false
const IDLE_PIVOT_AMP = 0.06 // radians (~3.4°)
const IDLE_PIVOT_SPEED = 1.8 // oscillations per second-ish

// --- THREE.JS LOGIK ---
function initThree() {
  if (!canvasRef.value) return
  scene = new THREE.Scene()
  const aspect = canvasRef.value.clientWidth / canvasRef.value.clientHeight
  // Responsiv FOV: større FOV på mobil for at se mere af stakken
  const isMobile = window.innerWidth <= 900
  const fov = isMobile ? 60 : 35
  camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000)
  camera.position.set(0, 6, 26)
  camera.lookAt(0, -1, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(canvasRef.value.clientWidth, canvasRef.value.clientHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  // Konfigurer renderer for korrekt farvehåndtering (samme som hjemmesiden)
  if (THREE.SRGBColorSpace) {
    renderer.outputColorSpace = THREE.SRGBColorSpace
  }
  canvasRef.value.appendChild(renderer.domElement)

  // Opret alle meshes med placeholder materialer
  cases.forEach((caseItem, i) => {
    const geometry = new THREE.PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT)
    const material = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      color: 0xffffff
    })
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)
    imagePlanes.push({ mesh, index: i, imagePath: caseItem.image })
  })

  // Load alle teksturer parallelt
  loadAllTextures()

  animateThree()
}

// Funktion til at loade alle teksturer parallelt
// Three.js TextureLoader cacher automatisk, så hvis teksturerne allerede er preloadet,
// vil de blive genbrugt uden at lave nye HTTP requests
function loadAllTextures() {
  imagePlanes.forEach(({ mesh, imagePath }, index) => {
    textureLoader.load(
      imagePath,
      (loadedTexture) => {
        // Sæt colorSpace til SRGB for korrekt farvevisning
        if (THREE.SRGBColorSpace) {
          loadedTexture.colorSpace = THREE.SRGBColorSpace
        } else if (loadedTexture.encoding !== undefined) {
          loadedTexture.encoding = THREE.sRGBEncoding
        }
        loadedTexture.needsUpdate = true

        // Cover-mapping: crop billedet i stedet for at maske det (object-fit: cover)
        const img = loadedTexture.image
        if (img && img.width && img.height) {
          const imgAspect = img.width / img.height
          const planeAspect = PLANE_WIDTH / PLANE_HEIGHT
          loadedTexture.wrapS = THREE.ClampToEdge
          loadedTexture.wrapT = THREE.ClampToEdge
          if (imgAspect > planeAspect) {
            loadedTexture.repeat.set(planeAspect / imgAspect, 1)
            loadedTexture.offset.set((1 - planeAspect / imgAspect) / 2, 0)
          } else if (imgAspect < planeAspect) {
            loadedTexture.repeat.set(1, imgAspect / planeAspect)
            loadedTexture.offset.set(0, (1 - imgAspect / planeAspect) / 2)
          }
        }
        
        // Opdater materialet med den loadede tekstur
        mesh.material.map = loadedTexture
        mesh.material.needsUpdate = true
        
        // Force GPU upload af teksturen (hvis ikke allerede gjort i preloader)
        renderer.initTexture(loadedTexture)
      },
      undefined,
      (error) => {
        console.error(`Fejl ved indlæsning af billede ${index}:`, error)
      }
    )
  })
}

function animateThree(time) {
  animationId = requestAnimationFrame(animateThree)
  const t = time || performance.now()
  const tSec = t / 1000
  lastThreeTimestamp = t

  threeScrollOffset = THREE.MathUtils.lerp(threeScrollOffset, threeTargetOffset, LERP_FACTOR)
  
  // Overskrifterne skifter kun når billedet ER lodret (aktivt)
  // Vi finder det billede med rotation.x tættest på 0 (mest lodret)
  let mostUprightIndex = currentCaseIndex.value
  let smallestRotation = Infinity
  
  imagePlanes.forEach(({ mesh, index }) => {
    const rotationFromUpright = Math.abs(mesh.rotation.x)
    // Kun overvej billeder der faktisk er tæt på lodret (rotation < 0.3 radianer)
    if (rotationFromUpright < 0.3 && rotationFromUpright < smallestRotation) {
      smallestRotation = rotationFromUpright
      mostUprightIndex = index
    }
  })
  
  // Hvis brugeren endnu ikke har scrollet i galleriet, lås titlen til det første case
  if (!userStartedGalleryScroll) {
    currentCaseIndex.value = 0
  } else {
    // Opdater kun hvis vi fandt et lodret billede
    if (smallestRotation < 0.3) {
      currentCaseIndex.value = mostUprightIndex
    }
  }
  
  imagePlanes.forEach(({ mesh, index }) => {
    const dist = index - threeScrollOffset

    // Idle pivot for first image: oscillate rotation.x (same axis used when falling)
    let idleAngle = 0
    if (index === 0 && !userStartedGalleryScroll) {
      idleAngle = Math.sin(tSec * IDLE_PIVOT_SPEED) * IDLE_PIVOT_AMP
    }
    
    if (Math.abs(dist) < 0.01) {
      // --- AKTIVT BILLEDE (dist ≈ 0) ---
      // If idle (before user scrolled) use small idleAngle so pivot matches fall pivot
      const targetRotX = (index === 0 && !userStartedGalleryScroll) ? idleAngle : 0 // Lodret or idle
      // Small positional nudge so the pivot feels identical to the fall animation
      const idleY = (index === 0 && !userStartedGalleryScroll) ? Math.sin(idleAngle) * -0.6 : 0
      const idleZ = (index === 0 && !userStartedGalleryScroll) ? Math.abs(Math.sin(idleAngle)) * 0.25 : 0
      const targetY = idleY
      const targetZ = idleZ

      mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, targetRotX, LERP_FACTOR)
      mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, targetY, LERP_FACTOR)
      mesh.position.z = THREE.MathUtils.lerp(mesh.position.z, targetZ, LERP_FACTOR)
      mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, 1, LERP_FACTOR)
      mesh.renderOrder = 100 - index
    }
    else if (dist < 0) {
      // --- DEN BLADREDE STAK (NEDERST/FORAN) ---
      const absDist = Math.abs(dist)
      
      // Vipper forover til liggende position
      const targetRotX = Math.PI / 2.15 
      
      // POSITION: Vi trækker dem op mod midten
      const targetY = -4.5 - (absDist * 0.1)
      const targetZ = 4 - (absDist * 0.3)

      mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, targetRotX, LERP_FACTOR)
      mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, targetY, LERP_FACTOR)
      mesh.position.z = THREE.MathUtils.lerp(mesh.position.z, targetZ, LERP_FACTOR)
      
      // Fade de bagerste i den brugte stak, men sørg for at de kan komme op igen
      // Når absDist er tæt på 0 (dvs. når man scroller tilbage), skal opacity være høj
      const targetOpacity = absDist <= 1 ? 1 : Math.max(0, 1 - (absDist - 1) * 0.5)
      mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, targetOpacity, LERP_FACTOR)
      
      mesh.renderOrder = 100 - index
    } 
    else {
      // --- DEN AFVENTENDE STAK (ØVERST/BAGVED) ---
      const targetRotX = -0.05 // Næsten lodret
      
      // POSITION: Ligger meget tæt på center
      const targetY = dist * 0.12
      const targetZ = -dist * 1.0

      mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, targetRotX, LERP_FACTOR)
      mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, targetY, LERP_FACTOR)
      mesh.position.z = THREE.MathUtils.lerp(mesh.position.z, targetZ, LERP_FACTOR)
      
      // Fade dem der er langt væk, men sørg for at de kan komme ned igen
      const targetOpacity = dist > 4 ? 0 : 1
      mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, targetOpacity, LERP_FACTOR)
      
      mesh.renderOrder = 100 - index
    }
  })
  renderer.render(scene, camera)
}

// --- SMOOTH SCROLL ENGINE ---
const lerp = (start, end, factor) => start + (end - start) * factor

const handleStickyAndThree = () => {
  if (!gallerySectionRef.value || !stickyWrapper.value) return
  
  const galleryRect = gallerySectionRef.value.getBoundingClientRect()
  const galleryHeight = gallerySectionRef.value.offsetHeight
  const viewHeight = window.innerHeight
  
  // On desktop: manually position the sticky wrapper with transform
  // On mobile: CSS sticky handles the positioning, we just update Three.js
  if (!isMobile) {
    const galleryTop = gallerySectionRef.value.offsetTop
    let stickyY = 0
    if (currentScroll.value >= galleryTop) {
      stickyY = Math.min(currentScroll.value - galleryTop, galleryHeight - viewHeight)
    }
    stickyWrapper.value.style.transform = `translate3d(0, ${stickyY}px, 0)`
  }

  // Calculate progress based on how far into the gallery section we've scrolled
  // galleryRect.top is negative when we've scrolled past the top of the gallery
  const scrolledIntoGallery = -galleryRect.top
  const totalScrollableHeight = galleryHeight - viewHeight
  
  // Tilføj en offset så første billede ikke vipper med det samme
  const startOffset = totalScrollableHeight * 0.05
  const endOffset = totalScrollableHeight * 0.05
  const adjustedScrollDistance = Math.max(0, scrolledIntoGallery - startOffset)
  const adjustedTotalHeight = totalScrollableHeight - startOffset - endOffset
  
  let progress = adjustedTotalHeight > 0 
    ? Math.max(0, Math.min(1, adjustedScrollDistance / adjustedTotalHeight))
    : 0
  threeTargetOffset = progress * (cases.length - 1)
  userStartedGalleryScroll = progress > 0
}

const smoothScrollLoop = () => {
  currentScroll.value = lerp(currentScroll.value, targetScroll, ease)
  if (scrollContainer.value) {
    scrollContainer.value.style.transform = `translate3d(0, ${-currentScroll.value}px, 0)`
  }
  handleStickyAndThree()
  checkSectionVisibility()
  if (Math.abs(targetScroll - currentScroll.value) > 0.1) {
    rafId = requestAnimationFrame(smoothScrollLoop)
  } else {
    isRunning = false
  }
}

const startLoop = () => {
  if (!isRunning) {
    isRunning = true
    rafId = requestAnimationFrame(smoothScrollLoop)
  }
}

const checkSectionVisibility = () => {
  document.querySelectorAll('[data-section]').forEach(section => {
    const rect = section.getBoundingClientRect()
    // Da containeren er transformeret, tjekker vi blot om sektionen er i viewporten
    if (rect.top < window.innerHeight * 0.8 && rect.bottom > 20) {
      visibleSections.value.add(section.dataset.section)
    }
  })
}

const handleWheel = (e) => {
  e.preventDefault()
  const maxScroll = scrollContainer.value.scrollHeight - window.innerHeight
  targetScroll = Math.max(0, Math.min(targetScroll + e.deltaY, maxScroll))
  startLoop()
}

// Touch handlers for mobile
const handleTouchStart = (e) => {
  touchStartY = e.touches[0].clientY
}

const handleTouchMove = (e) => {
  e.preventDefault()
  const touchY = e.touches[0].clientY
  const delta = (touchStartY - touchY) * 6
  touchStartY = touchY
  
  const maxScroll = scrollContainer.value.scrollHeight - window.innerHeight
  targetScroll = Math.max(0, Math.min(targetScroll + delta, maxScroll))
  startLoop()
}

// Mobile scroll handler for native scrolling
let handleMobileScroll = null

onMounted(() => {
  // Decide whether to use custom smooth scrolling or native mobile scrolling
  isMobile = window.innerWidth <= 900

  nextTick(() => {
    initThree()

    if (!isMobile) {
      document.documentElement.classList.add('smooth-scroll-active')
      document.body.style.height = `${scrollContainer.value.scrollHeight}px`
      window.addEventListener('wheel', handleWheel, { passive: false })
      window.addEventListener('touchstart', handleTouchStart, { passive: true })
      window.addEventListener('touchmove', handleTouchMove, { passive: false })
    } else {
      // Mobile: use native scroll but still update Three.js gallery
      handleMobileScroll = () => {
        currentScroll.value = window.scrollY
        handleStickyAndThree()
      }
      window.addEventListener('scroll', handleMobileScroll, { passive: true })
    }

    // Resize handler (always update three renderer)
    window.addEventListener('resize', () => {
      if (!isMobile) {
        document.body.style.height = `${scrollContainer.value.scrollHeight}px`
      }
      const aspect = canvasRef.value.clientWidth / canvasRef.value.clientHeight
      const mobileFov = window.innerWidth <= 900 ? 60 : 35
      camera.aspect = aspect
      camera.fov = mobileFov
      camera.updateProjectionMatrix()
      renderer.setSize(canvasRef.value.clientWidth, canvasRef.value.clientHeight)
    })

    visibleSections.value.add('hero')
  })
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  cancelAnimationFrame(rafId)
  if (!isMobile) {
    window.removeEventListener('wheel', handleWheel)
    window.removeEventListener('touchstart', handleTouchStart)
    window.removeEventListener('touchmove', handleTouchMove)
    document.documentElement.classList.remove('smooth-scroll-active')
  } else if (handleMobileScroll) {
    window.removeEventListener('scroll', handleMobileScroll)
  }
})
</script>

<template>
  <div class="cases-page">
    <div class="paper-overlay"></div>
    <Nav />

    <!-- SVG Filters (Identisk med About-side for blyant-effekt) -->
    <svg width="0" height="0" style="position: absolute; pointer-events: none;">
      <defs>
        <filter id="pencil-stroke" x="-50%" y="-50%" width="200%" height="200%">
          <feTurbulence type="fractalNoise" baseFrequency="20 0.5" numOctaves="3" result="paperGrain" seed="13"/>
          <feTurbulence type="fractalNoise" baseFrequency="0.3 0.005" numOctaves="6" result="wave" seed="7"/>
          <feDisplacementMap in="SourceGraphic" in2="wave" scale="10" xChannelSelector="R" yChannelSelector="G" result="wavy"/>
          <feTurbulence type="fractalNoise" baseFrequency="15 0.4" numOctaves="5" result="fine" seed="11"/>
          <feDisplacementMap in="wavy" in2="fine" scale="3" xChannelSelector="R" yChannelSelector="G" result="textured"/>
          <feComposite in="textured" in2="paperGrain" operator="multiply" result="grainy"/>
          <feGaussianBlur in="grainy" stdDeviation="0.7" result="blurred"/>
          <feComponentTransfer in="blurred" result="enhanced">
            <feFuncA type="gamma" exponent="0.85"/>
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>

    <div class="scroll-container" ref="scrollContainer">
      
      <!-- HERO SECTION (Identisk med About Us) -->
      <section class="hero">
        <!-- Vandret blyantslinje -->
        <svg class="center-line-svg" viewBox="0 0 1000 10" preserveAspectRatio="none">
          <defs>
            <linearGradient id="pencilGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#1a1a1a;stop-opacity:0.3" />
              <stop offset="5%" style="stop-color:#1a1a1a;stop-opacity:0.6" />
              <stop offset="15%" style="stop-color:#1a1a1a;stop-opacity:0.9" />
              <stop offset="50%" style="stop-color:#1a1a1a;stop-opacity:0.95" />
              <stop offset="85%" style="stop-color:#1a1a1a;stop-opacity:0.85" />
              <stop offset="100%" style="stop-color:#1a1a1a;stop-opacity:0.3" />
            </linearGradient>
          </defs>
          <path 
            class="pencil-path"
            d="M 0,5.1 Q 80,4.3 160,5.2 Q 240,6.1 320,4.9 Q 400,5.3 480,4.7 Q 560,5.4 640,4.8 Q 720,5.5 800,4.6 Q 880,5.2 960,4.9 L 1000,5"
            stroke="url(#pencilGradient)"
            stroke-width="2.8"
            fill="none"
            stroke-linecap="round"
            filter="url(#pencil-stroke)"
            vector-effect="non-scaling-stroke"
          />
        </svg>

        <div class="hero-content">
          <h1 class="hero-title" data-section="hero" :class="{ visible: visibleSections.has('hero') }">
            <span class="title-line">Our</span>
            <span class="title-line title-accent">cases</span>
          </h1>
          <p class="hero-subtitle" :class="{ visible: visibleSections.has('hero') }">
            Where gardens become art
          </p>
        </div>
      </section>

      <!-- GALLERI SEKTION -->
      <section ref="gallerySectionRef" class="gallery-container" :style="{ height: (cases.length * 110) + 'vh' }">
        <div ref="stickyWrapper" class="manual-sticky-wrapper">
          <div ref="canvasRef" class="gallery-canvas"></div>
          
          <div class="case-info">
            <p class="case-category">{{ currentCase.category }}</p>
            <h2 class="case-title">{{ displayTitle }}</h2>
          </div>
          
          <div class="case-counter">
            <span class="current">{{ String(currentCaseIndex + 1).padStart(2, '0') }}</span>
            <span class="separator">/</span>
            <span class="total">{{ String(cases.length).padStart(2, '0') }}</span>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  </div>
</template>

<style>
/* Smooth scroll setup */
html.smooth-scroll-active,
html.smooth-scroll-active body {
  overflow: hidden;
  height: 100%;
}
</style>

<style scoped>
.cases-page {
  background: #F0EEE9;
  color: #1a1a1a;
  font-family: 'Boska', serif;
}

.scroll-container {
  position: static;
  width: 100%;
  background: #F0EEE9;
}

html.smooth-scroll-active .scroll-container {
  position: fixed;
  top: 0; left: 0; width: 100%;
  background: #F0EEE9;
  will-change: transform;
}

.paper-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: url('/texture/paper.png');
  background-size: 500px 500px;
  background-repeat: repeat;
  pointer-events: none;
  z-index: 100;

  opacity: 1;
}

/* HERO STYLES (MATCHES ABOUT PAGE) */
.hero {
  position: relative;
  height: 50vh;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: clamp(1rem, 2vh, 1.5rem);
}

.hero-content {
  position: relative;
  z-index: 3;
  text-align: center;
}

.hero-title {
  font-weight: 300;
  font-size: clamp(3rem, 8vw + 2rem, 9rem);
  line-height: 0.9;
  letter-spacing: -0.02em;
  margin: 0;
}

.title-line {
  display: inline-block;
  opacity: 0;
  transform: translateY(60px);
  transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  margin-right: 0.3em;
}

.hero-title.visible .title-line:nth-child(1) { opacity: 1; transform: translateY(0); transition-delay: 0.1s; }
.hero-title.visible .title-line:nth-child(2) { opacity: 1; transform: translateY(0); transition-delay: 0.25s; }

.title-accent {
  color: #4a6741;
  font-style: italic;
}

.hero-subtitle {
  font-size: clamp(0.875rem, 1.5vw, 1.25rem);
  letter-spacing: 0.3em;
  text-transform: uppercase;
  margin-top: clamp(1.5rem, 2.5vh, 2rem);
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.6s, transform 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.6s;
}

.hero-subtitle.visible {
  opacity: 0.7;
  transform: translateY(0);
}

.center-line-svg {
  position: absolute;
  top: 50vh; /* Sidder i midten af heroen */
  left: 3rem; right: 3rem;
  width: calc(100% - 6rem);
  height: 10px;
  z-index: 3;
  pointer-events: none;
  clip-path: inset(0 100% 0 0);
  animation: drawLine 1.5s cubic-bezier(0.4, 0, 0.2, 0.8) forwards;
  animation-delay: 0.5s;
}

@keyframes drawLine {
  from { clip-path: inset(0 100% 0 0); }
  to { clip-path: inset(0 0% 0 0); }
}

/* GALLERI STYLES */
.gallery-container { position: relative; width: 100%; }
.manual-sticky-wrapper {
  position: relative; height: 100vh; width: 100%; overflow: hidden; will-change: transform;
}
.gallery-canvas { position: absolute; inset: 0; z-index: 1; }
.case-info { 
  position: absolute; 
  bottom: 50%; 
  left: 3rem; 
  z-index: 10;
  height: 50vh;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.case-title {
  font-weight: 200;
  font-size: clamp(1.2rem, 3.5vw, 2.5rem);
  text-transform: none;
  margin: 0;
}
.case-category {
  font-weight: 200;
  font-size: clamp(0.8rem, 1vw, 0.9rem);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
  opacity: 0.7;
}
.case-year { font-size: clamp(4rem, 10vw, 8rem); opacity: 0.1; line-height: 0.8; }
.case-counter { position: absolute; bottom: 50%; right: 6%; z-index: 10; font-size: 1.2rem; transform: translateY(0); }

/* ===== 12 Column Grid System ===== */
.grid-container {
  margin-left: 3rem;
  margin-right: 3rem;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: clamp(0.75rem, 1.5vw, 1.5rem);
}

.grid-col-1 { grid-column: span 1; }
.grid-col-2 { grid-column: span 2; }
.grid-col-3 { grid-column: span 3; }
.grid-col-4 { grid-column: span 4; }
.grid-col-5 { grid-column: span 5; }
.grid-col-6 { grid-column: span 6; }
.grid-col-7 { grid-column: span 7; }
.grid-col-8 { grid-column: span 8; }
.grid-col-9 { grid-column: span 9; }
.grid-col-10 { grid-column: span 10; }
.grid-col-11 { grid-column: span 11; }
.grid-col-12 { grid-column: span 12; }

/* Responsive */
@media (max-width: 900px) {
  .hero-subtitle {
    font-size: clamp(0.675rem, 1.3vw, 1.05rem);
  }
  
  .manual-sticky-wrapper {
    position: sticky;
    top: 0;
    will-change: auto;
  }
  
  .case-info {
    left: 1.5rem;
    bottom: 75%;
  }
  
  .case-counter {
    bottom: 50%;
  }
  
  .grid-container {
    margin-left: 1.5rem;
    margin-right: 1.5rem;
    gap: clamp(0.5rem, 1vw, 1rem);
  }
  
  .grid-col-1,
  .grid-col-2,
  .grid-col-3,
  .grid-col-4,
  .grid-col-5,
  .grid-col-6,
  .grid-col-7,
  .grid-col-8,
  .grid-col-9,
  .grid-col-10,
  .grid-col-11,
  .grid-col-12 {
    grid-column: span 12;
  }
}
</style>