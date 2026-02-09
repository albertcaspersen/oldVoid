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

const cases = [
  { id: 1, title: 'A Coastal Garden', location: 'Coastal', category: 'residential', year: '2024', image: '/pics/casesPics/ACoastalGarden.png' },
  { id: 2, title: 'A Cottage Garden', location: 'Countryside', category: 'residential', year: '2024', image: '/pics/casesPics/ACottageGarden.png' },
  { id: 3, title: 'A Modern Garden', location: 'Urban', category: 'urban', year: '2024', image: '/pics/casesPics/AModernGarden.png' },
  { id: 4, title: 'A Rural Garden', location: 'Countryside', category: 'residential', year: '2024', image: '/pics/casesPics/ARuralGarden.png' },
  { id: 5, title: 'Beach House', location: 'Coastal', category: 'residential', year: '2023', image: '/pics/casesPics/BeachHouse.png' },
  { id: 6, title: 'Brighton Garden', location: 'Brighton', category: 'residential', year: '2024', image: '/pics/casesPics/BrightonGarden.png' },
  { id: 7, title: 'Cobham Garden', location: 'Cobham', category: 'residential', year: '2023', image: '/pics/casesPics/CobhamGarden.png' },
  { id: 8, title: 'Copenhagen Garden', location: 'Copenhagen', category: 'urban', year: '2024', image: '/pics/casesPics/CopenhagenGarden.png' },
  { id: 9, title: 'Courtyard Garden', location: 'Urban', category: 'urban', year: '2023', image: '/pics/casesPics/CourtyardGarden.png' },
  { id: 10, title: 'CPH Garden', location: 'Copenhagen', category: 'urban', year: '2024', image: '/pics/casesPics/CPHGarden.png' },
  { id: 11, title: 'Entertainment Garden', location: 'Estate', category: 'estate', year: '2023', image: '/pics/casesPics/EntertainmentGarden.png' },
  { id: 12, title: 'London Garden', location: 'London', category: 'urban', year: '2024', image: '/pics/casesPics/LondonGarden.png' },
  { id: 13, title: 'Oxshott Garden', location: 'Oxshott', category: 'residential', year: '2024', image: '/pics/casesPics/OxshottGarden.png' },
  { id: 14, title: 'Seaside Garden', location: 'Coastal', category: 'residential', year: '2023', image: '/pics/casesPics/SeasideGarden.png' },
  { id: 15, title: 'St. Georges Hill', location: 'Surrey', category: 'estate', year: '2024', image: '/pics/casesPics/St.GeorgesHill.png' },
  { id: 16, title: 'Summer House', location: 'Countryside', category: 'residential', year: '2023', image: '/pics/casesPics/SummerHouse.png' },
  { id: 17, title: 'Tudor House', location: 'Historic', category: 'residential', year: '2024', image: '/pics/casesPics/TudorHouse.png' }
]

const currentCaseIndex = ref(0)
const currentCase = computed(() => cases[currentCaseIndex.value] || cases[0])

let scene, camera, renderer, animationId
let imagePlanes = []
const textureLoader = new THREE.TextureLoader()

const PLANE_WIDTH = 14
const PLANE_HEIGHT = 9
const LERP_FACTOR = 0.08
let threeScrollOffset = 0
let threeTargetOffset = 0

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

function animateThree() {
  animationId = requestAnimationFrame(animateThree)
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
  
  // Opdater kun hvis vi fandt et lodret billede
  if (smallestRotation < 0.3) {
    currentCaseIndex.value = mostUprightIndex
  }
  
  imagePlanes.forEach(({ mesh, index }) => {
    const dist = index - threeScrollOffset
    
    if (Math.abs(dist) < 0.01) {
      // --- AKTIVT BILLEDE (dist ≈ 0) ---
      const targetRotX = 0 // Lodret
      const targetY = 0
      const targetZ = 0
      
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
  const galleryTop = gallerySectionRef.value.offsetTop
  const galleryHeight = gallerySectionRef.value.offsetHeight
  const viewHeight = window.innerHeight
  
  let stickyY = 0
  if (currentScroll.value >= galleryTop) {
    stickyY = Math.min(currentScroll.value - galleryTop, galleryHeight - viewHeight)
  }
  stickyWrapper.value.style.transform = `translate3d(0, ${stickyY}px, 0)`

  const scrollDistance = currentScroll.value - galleryTop
  const totalScrollableHeight = galleryHeight - viewHeight
  
  // Tilføj en offset så første billede ikke vipper med det samme
  // Vi vil have at brugeren skal scrolle ca. 5% af sticky-sektionen før første billede vipper
  const startOffset = totalScrollableHeight * 0.05
  // Tilføj også en offset i slutningen så sidste billede ikke vipper helt ned med det samme
  const endOffset = totalScrollableHeight * 0.05
  const adjustedScrollDistance = Math.max(0, scrollDistance - startOffset)
  const adjustedTotalHeight = totalScrollableHeight - startOffset - endOffset
  
  let progress = adjustedTotalHeight > 0 
    ? Math.max(0, Math.min(1, adjustedScrollDistance / adjustedTotalHeight))
    : 0
  threeTargetOffset = progress * (cases.length - 1)
  
  // Overskrifterne opdateres nu i animateThree() baseret på det aktive billede
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

onMounted(() => {
  document.documentElement.classList.add('smooth-scroll-active')
  nextTick(() => {
    initThree()
    document.body.style.height = `${scrollContainer.value.scrollHeight}px`
    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('resize', () => {
      document.body.style.height = `${scrollContainer.value.scrollHeight}px`
      const aspect = canvasRef.value.clientWidth / canvasRef.value.clientHeight
      const isMobile = window.innerWidth <= 900
      const fov = isMobile ? 60 : 35
      camera.aspect = aspect
      camera.fov = fov
      camera.updateProjectionMatrix()
      renderer.setSize(canvasRef.value.clientWidth, canvasRef.value.clientHeight)
    })
    visibleSections.value.add('hero')
  })
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  cancelAnimationFrame(rafId)
  window.removeEventListener('wheel', handleWheel)
  document.documentElement.classList.remove('smooth-scroll-active')
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
            <h2 class="case-title">{{ currentCase.title }}</h2>
          </div>
          
          <div class="case-counter">
            <span class="current">{{ String(currentCaseIndex + 1).padStart(2, '0') }}</span>
            <span class="separator">/</span>
            <span class="total">{{ String(cases.length).padStart(2, '0') }}</span>
          </div>
        </div>
      </section>

      <section class="contact-section" data-section="cta">
        <div 
          class="contact-content grid-container"
          :class="{ visible: visibleSections.has('cta') }"
        >
          <h2 class="grid-col-12">Let's Create Together</h2>
          <p class="grid-col-12">
            Further information on our company capabilities and expertise, please email
          </p>
          <a href="mailto:info@ourlandscapedesigns.com" class="contact-email grid-col-12">
            info@ourlandscapedesigns.com
          </a>
          
          <div class="contact-divider grid-col-12"></div>
          
          <div class="social-links grid-col-12">
            <span class="social-label">Find us here</span>
            <div class="social-icons">
              <a href="#" class="social-icon" aria-label="Facebook">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a href="#" class="social-icon" aria-label="Instagram">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
              </a>
              <a href="#" class="social-icon" aria-label="Pinterest">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>
                </svg>
              </a>
            </div>
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
  text-transform: uppercase;
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
.case-counter { position: absolute; bottom: 12%; right: 6%; z-index: 10; font-size: 1.2rem; }

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

/* ===== Contact Section ===== */
.contact-section {
  padding: clamp(4rem, 8vh, 8rem) 0;
  text-align: center;
}

.contact-content {
  opacity: 0;
  transform: translateY(60px);
  transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.contact-content.visible {
  opacity: 1;
  transform: translateY(0);
}

.contact-content h2 {
  font-family: 'Boska', serif;
  font-size: clamp(2rem, 4vw + 0.5rem, 3rem);
  font-weight: 300;
  margin: 0 0 clamp(1rem, 1.5vh, 1.5rem) 0;
}

.contact-content p {
  font-size: clamp(1rem, 1.3vw, 1.1rem);
  opacity: 0.8;
  margin-bottom: clamp(1rem, 1.5vh, 1.5rem);
}

.contact-email {
  display: inline-block;
  font-size: clamp(1rem, 1.5vw, 1.2rem);
  color: #1a1a1a;
  text-decoration: none;
  transition: all 0.3s ease;
}

.contact-email:hover {
  color: #4a6741;
}

.contact-divider {
  height: 2px;
  background-color: #4a6741;
  margin: clamp(3rem, 4vh, 4rem) 0;
  filter: url(#pencil-stroke);
  opacity: 0.5;
  box-shadow: 
    0 0 1px rgba(74, 103, 65, 0.3),
    0 1px 0 rgba(74, 103, 65, 0.2);
  clip-path: inset(0 100% 0 0);
}

.contact-content.visible .contact-divider {
  animation: drawLine 2s cubic-bezier(0.4, 0, 0.2, 0.8) forwards;
  animation-delay: 0.5s;
}

.social-links {
  margin-top: 0;
}

.social-label {
  display: block;
  font-size: clamp(0.7rem, 1vw, 0.8rem);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  opacity: 0.5;
  margin-bottom: clamp(1rem, 1.5vh, 1.5rem);
}

.social-icons {
  display: flex;
  justify-content: center;
  gap: clamp(1rem, 1.5vw, 1.5rem);
}

.social-icon {
  width: clamp(40px, 5vw, 48px);
  height: clamp(40px, 5vw, 48px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #4a6741;
  color: #F0EEE9;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.social-icon:hover {
  background: #1a1a1a;
  transform: translateY(-3px);
}

.social-icon svg {
  width: clamp(18px, 2.2vw, 20px);
  height: clamp(18px, 2.2vw, 20px);
}

/* Responsive */
@media (max-width: 900px) {
  .case-info {
    left: 1.5rem;
    bottom: 75%;
  }
  
  .case-counter {
    bottom: 19%;
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