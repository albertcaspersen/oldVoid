<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Nav from './Nav.vue'
import Footer from './components/Footer.vue'

// Scroll progress for parallax effects
const scrollY = ref(0)
const windowHeight = ref(0)
const documentHeight = ref(0)

// Smooth scroll with inertia
const scrollContainer = ref(null)
let currentScroll = 0
let targetScroll = 0
let rafId = null
let isRunning = false
const ease = 0.08 // Lower = more smooth/slow, Higher = more responsive

// Visibility for animations
const visibleSections = ref(new Set())

// Contact data
const contacts = [
  {
    name: 'Irene Højlund',
    email: 'irene@ourlandscapedesigns.com',
    phone: '+45 28 15 19 13'
  },
  {
    name: 'Nete Højlund',
    email: 'nete@ourlandscapedesigns.com',
    phone: '+45 53 78 86 60'
  }
]

let handleWheel = null
let handleResize = null
let handleKeyDown = null
let handleTouchStart = null
let handleTouchMove = null
let touchStartY = 0

// Lerp function for smooth interpolation
const lerp = (start, end, factor) => start + (end - start) * factor

// Check visibility of sections manually (since IntersectionObserver doesn't work with transform)
const checkSectionVisibility = () => {
  if (!scrollContainer.value) return
  
  const sections = scrollContainer.value.querySelectorAll('[data-section]')
  const viewportTop = currentScroll
  const viewportBottom = currentScroll + window.innerHeight
  // More lenient threshold on mobile for better visibility detection
  const isMobile = window.innerWidth <= 900
  const threshold = isMobile ? window.innerHeight * 0.1 : window.innerHeight * 0.2 // 10% on mobile, 20% on desktop
  
  sections.forEach(section => {
    const rect = section.getBoundingClientRect()
    // Since container is transformed, we need to calculate actual position
    const sectionTop = rect.top + currentScroll
    const sectionBottom = sectionTop + rect.height
    
    // Check if section is in viewport with threshold
    // On mobile, be more lenient - show if any part is visible
    const isVisible = isMobile 
      ? (sectionBottom > viewportTop && sectionTop < viewportBottom)
      : (sectionBottom > viewportTop + threshold && sectionTop < viewportBottom - threshold)
    
    if (isVisible) {
      const id = section.dataset.section
      visibleSections.value.add(id)
    }
  })
}

// Animation loop for smooth scrolling
const smoothScrollLoop = () => {
  // Lerp toward target
  currentScroll = lerp(currentScroll, targetScroll, ease)
  
  // Apply transform to container
  if (scrollContainer.value) {
    scrollContainer.value.style.transform = `translate3d(0, ${-currentScroll}px, 0)`
  }
  
  // Update scrollY ref for parallax effects
  scrollY.value = currentScroll
  
  // Check visibility of sections
  checkSectionVisibility()
  
  // Continue loop if not close enough to target
  if (Math.abs(targetScroll - currentScroll) > 0.5) {
    rafId = requestAnimationFrame(smoothScrollLoop)
  } else {
    currentScroll = targetScroll
    if (scrollContainer.value) {
      scrollContainer.value.style.transform = `translate3d(0, ${-currentScroll}px, 0)`
    }
    scrollY.value = currentScroll
    checkSectionVisibility()
    isRunning = false
  }
}

// Start the animation loop if not already running
const startLoop = () => {
  if (!isRunning) {
    isRunning = true
    rafId = requestAnimationFrame(smoothScrollLoop)
  }
}

// Calculate max scroll
const getMaxScroll = () => {
  if (!scrollContainer.value) return 0
  return scrollContainer.value.scrollHeight - window.innerHeight
}

// Update body height to match content
const updateBodyHeight = () => {
  if (scrollContainer.value) {
    const height = scrollContainer.value.scrollHeight
    document.body.style.height = `${height}px`
    document.documentElement.style.height = `${height}px`
    documentHeight.value = height
    
    // Update paper overlay height to match content
    const paperOverlay = document.querySelector('.paper-overlay')
    if (paperOverlay) {
      paperOverlay.style.height = `${Math.max(height, window.innerHeight)}px`
    }
  }
}

onMounted(() => {
  windowHeight.value = window.innerHeight
  
  const isMobile = window.innerWidth <= 900
  
  if (isMobile) {
    // On mobile: use native scrolling with IntersectionObserver for animations
    visibleSections.value.add('hero')
    
    // IntersectionObserver for staggered reveal animations
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    }
    
    const mobileObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.dataset.section
          if (sectionId) {
            visibleSections.value.add(sectionId)
          }
        }
      })
    }, observerOptions)
    
    // Observe all sections after a short delay to ensure DOM is ready
    setTimeout(() => {
      document.querySelectorAll('[data-section]').forEach(el => {
        mobileObserver.observe(el)
      })
    }, 100)
    
    return
  }
  
  // Desktop: Enable smooth scroll mode
  document.documentElement.classList.add('smooth-scroll-active')
  
  // Wait for content to render
  setTimeout(() => {
    updateBodyHeight()
    
    // Wheel event handler
    handleWheel = (e) => {
      e.preventDefault()
      
      const maxScroll = getMaxScroll()
      targetScroll += e.deltaY
      targetScroll = Math.max(0, Math.min(targetScroll, maxScroll))
      
      startLoop()
    }
    
    // Keyboard navigation
    handleKeyDown = (e) => {
      const maxScroll = getMaxScroll()
      let delta = 0
      
      switch(e.key) {
        case 'ArrowDown':
          delta = 100
          break
        case 'ArrowUp':
          delta = -100
          break
        case 'PageDown':
          delta = window.innerHeight * 0.8
          break
        case 'PageUp':
          delta = -window.innerHeight * 0.8
          break
        case 'Home':
          targetScroll = 0
          startLoop()
          return
        case 'End':
          targetScroll = maxScroll
          startLoop()
          return
        case ' ':
          delta = e.shiftKey ? -window.innerHeight * 0.8 : window.innerHeight * 0.8
          e.preventDefault()
          break
        default:
          return
      }
      
      targetScroll += delta
      targetScroll = Math.max(0, Math.min(targetScroll, maxScroll))
      startLoop()
    }
    
    // Resize handler
    handleResize = () => {
      windowHeight.value = window.innerHeight
      updateBodyHeight()
      
      // Clamp scroll position after resize
      const maxScroll = getMaxScroll()
      if (targetScroll > maxScroll) {
        targetScroll = maxScroll
        currentScroll = Math.min(currentScroll, maxScroll)
        startLoop()
      }
      
      // Re-check visibility after resize (important on mobile when rotating)
      setTimeout(() => {
        checkSectionVisibility()
      }, 100)
    }
    
    // Touch handlers for mobile
    handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY
    }
    
    handleTouchMove = (e) => {
      e.preventDefault()
      
      const touchY = e.touches[0].clientY
      const delta = (touchStartY - touchY) * 1.5 // Multiply for better feel on mobile
      touchStartY = touchY
      
      const maxScroll = getMaxScroll()
      targetScroll += delta
      targetScroll = Math.max(0, Math.min(targetScroll, maxScroll))
      
      startLoop()
      
      // On mobile, check visibility more frequently during touch scroll
      if (window.innerWidth <= 900) {
        checkSectionVisibility()
      }
    }
    
    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleResize)
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    
    // Hero section should be visible immediately on page load
    visibleSections.value.add('hero')
    
    // Initial visibility check
    checkSectionVisibility()
    
    // On mobile, check visibility more frequently and after a short delay to ensure cards are detected
    const isMobile = window.innerWidth <= 900
    if (isMobile) {
      setTimeout(() => {
        checkSectionVisibility()
        // Also check after scroll settles
        setTimeout(checkSectionVisibility, 500)
      }, 300)
    }
  }, 100)
  
  // Update body height periodically to handle dynamic content
  setTimeout(updateBodyHeight, 500)
  setTimeout(updateBodyHeight, 1000)
  
  // Additional visibility check after content is fully rendered (especially important on mobile)
  setTimeout(() => {
    checkSectionVisibility()
  }, 1500)
})

onUnmounted(() => {
  // Clean up
  if (rafId) {
    cancelAnimationFrame(rafId)
  }
  if (handleWheel) {
    window.removeEventListener('wheel', handleWheel)
  }
  if (handleKeyDown) {
    window.removeEventListener('keydown', handleKeyDown)
  }
  if (handleResize) {
    window.removeEventListener('resize', handleResize)
  }
  if (handleTouchStart) {
    window.removeEventListener('touchstart', handleTouchStart)
  }
  if (handleTouchMove) {
    window.removeEventListener('touchmove', handleTouchMove)
  }
  
  // Reset styles
  document.documentElement.classList.remove('smooth-scroll-active')
  document.body.style.height = ''
})

</script>

<template>
  <div class="contact-wrapper">
    <!-- Fixed elements that don't scroll -->
    <div class="paper-overlay"></div>
    <Nav />
    
    <!-- SVG filters (hidden, just definitions) -->
    <svg width="0" height="0" style="position: absolute; pointer-events: none;">
      <defs>
        <!-- Pencil texture filter -->
        <filter id="pencil-texture" x="-100%" y="-100%" width="300%" height="300%">
          <!-- Create rough paper texture -->
          <feTurbulence 
            type="fractalNoise" 
            baseFrequency="15 0.5" 
            numOctaves="4" 
            result="paper"
            seed="1"
          />
          <!-- Create pencil grain -->
          <feTurbulence 
            type="fractalNoise" 
            baseFrequency="0.5 0.5" 
            numOctaves="5" 
            result="grain"
            seed="3"
          />
          <!-- Combine textures -->
          <feComposite 
            in="paper" 
            in2="grain" 
            operator="multiply" 
            result="texture"
          />
          <!-- Apply texture to stroke -->
          <feDisplacementMap 
            in="SourceGraphic" 
            in2="texture" 
            scale="6" 
            xChannelSelector="R" 
            yChannelSelector="G"
            result="displaced"
          />
          <!-- Add softness -->
          <feGaussianBlur 
            in="displaced" 
            stdDeviation="0.5" 
            result="soft"
          />
        </filter>
        
        <!-- Pencil stroke filter with variation -->
        <filter id="pencil-stroke" x="-50%" y="-50%" width="200%" height="200%">
          <!-- Create rough paper grain -->
          <feTurbulence 
            type="fractalNoise" 
            baseFrequency="20 0.5" 
            numOctaves="3" 
            result="paperGrain"
            seed="13"
          />
          <!-- Main displacement for organic wavy shape -->
          <feTurbulence 
            type="fractalNoise" 
            baseFrequency="0.3 0.005" 
            numOctaves="6" 
            result="wave"
            seed="7"
          />
          <feDisplacementMap 
            in="SourceGraphic" 
            in2="wave" 
            scale="10" 
            xChannelSelector="R" 
            yChannelSelector="G"
            result="wavy"
          />
          <!-- Fine pencil texture -->
          <feTurbulence 
            type="fractalNoise" 
            baseFrequency="15 0.4" 
            numOctaves="5" 
            result="fine"
            seed="11"
          />
          <feDisplacementMap 
            in="wavy" 
            in2="fine" 
            scale="3" 
            xChannelSelector="R" 
            yChannelSelector="G"
            result="textured"
          />
          <!-- Apply paper grain -->
          <feComposite 
            in="textured" 
            in2="paperGrain" 
            operator="multiply" 
            result="grainy"
          />
          <!-- Soft blur for pencil feel -->
          <feGaussianBlur 
            in="grainy" 
            stdDeviation="0.7" 
            result="blurred"
          />
          <!-- Enhance contrast for pencil look -->
          <feComponentTransfer in="blurred" result="enhanced">
            <feFuncA type="gamma" exponent="0.85"/>
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
    
    <!-- Scrollable content container -->
    <div class="scroll-container" ref="scrollContainer">
      <!-- Vandret linje i midten - scrolls with content -->
      <svg class="center-line-svg" viewBox="0 0 1000 10" preserveAspectRatio="none">
        <defs>
          <linearGradient id="pencilGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#1a1a1a;stop-opacity:0.3" />
            <stop offset="5%" style="stop-color:#1a1a1a;stop-opacity:0.6" />
            <stop offset="15%" style="stop-color:#1a1a1a;stop-opacity:0.9" />
            <stop offset="25%" style="stop-color:#1a1a1a;stop-opacity:0.85" />
            <stop offset="35%" style="stop-color:#1a1a1a;stop-opacity:0.95" />
            <stop offset="45%" style="stop-color:#1a1a1a;stop-opacity:0.75" />
            <stop offset="55%" style="stop-color:#1a1a1a;stop-opacity:0.9" />
            <stop offset="65%" style="stop-color:#1a1a1a;stop-opacity:0.88" />
            <stop offset="75%" style="stop-color:#1a1a1a;stop-opacity:0.7" />
            <stop offset="85%" style="stop-color:#1a1a1a;stop-opacity:0.85" />
            <stop offset="95%" style="stop-color:#1a1a1a;stop-opacity:0.5" />
            <stop offset="100%" style="stop-color:#1a1a1a;stop-opacity:0.3" />
          </linearGradient>
        </defs>
        <!-- Organisk bølget linje der simulerer håndtegning med variation -->
        <path 
          class="pencil-path"
          d="M 0,5.1 Q 80,4.3 160,5.2 Q 240,6.1 320,4.9 Q 400,5.3 480,4.7 Q 560,5.4 640,4.8 Q 720,5.5 800,4.6 Q 880,5.2 960,4.9 L 1000,5"
          stroke="url(#pencilGradient)"
          stroke-width="2.8"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
          filter="url(#pencil-stroke)"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      
      <!-- Hero Section -->
      <section class="hero">
        <div class="hero-overlay"></div>
        <div class="hero-content">
          <h1 class="hero-title" data-section="hero" :class="{ visible: visibleSections.has('hero') }">
            <span class="title-line">Let's</span>
            <span class="title-line title-accent"> talk</span>
          </h1>
          <p class="hero-subtitle" :class="{ visible: visibleSections.has('hero') }">
            Your story starts here
          </p>
        </div>
      </section>
      
      <!-- Contact Info Section -->
      <section class="contact-section">
        <div class="grid-container">
          <h2 
            class="section-title grid-col-12"
            data-section="contact-title"
            :class="{ visible: visibleSections.has('contact-title') }"
          >
            OUR LANDSCAPE DESIGNS
          </h2>
          
          <div 
            v-for="(contact, index) in contacts" 
            :key="contact.name"
            class="contact-card"
            :class="[
              index === 0 ? 'contact-card-irene' : 'contact-card-nete',
              { visible: visibleSections.has(`contact-${index}`) }
            ]"
            :data-section="`contact-${index}`"
            :style="{ '--delay': `${index * 0.15}s` }"
          >
            <h3 class="contact-name">{{ contact.name }}</h3>
            <a 
              :href="`mailto:${contact.email}`" 
              class="contact-email"
              :class="{ 'green-contact': contact.name === 'Nete Højlund' || contact.name === 'Irene Højlund' }"
            >
              {{ contact.email }}
            </a>
            <a 
              :href="`tel:${contact.phone}`" 
              class="contact-phone"
              :class="{ 'green-contact': contact.name === 'Nete Højlund' || contact.name === 'Irene Højlund' }"
            >
              {{ contact.phone }}
            </a>
          </div>
        </div>
      </section>
      

    </div>
  </div>
</template>

<style>
/* Smooth scroll with inertia - prevent native scrolling */
html.smooth-scroll-active,
html.smooth-scroll-active body {
  overflow: hidden;
  height: 100%;
  background: #F0EEE9;
}

html,
body {
  background: #F0EEE9;
  min-height: 100vh;
}
</style>

<style scoped>
/* ===== Font Import ===== */
@font-face {
  font-family: 'Boska';
  src: url('/font/Boska-Regular.woff2') format('woff2'),
       url('/font/Boska-Regular.woff') format('woff'),
       url('/font/Boska-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: 'Boska';
  src: url('/font/Boska-Medium.woff2') format('woff2'),
       url('/font/Boska-Medium.woff') format('woff'),
       url('/font/Boska-Medium.ttf') format('truetype');
  font-weight: 500;
  font-style: normal;
}

@font-face {
  font-family: 'Boska';
  src: url('/font/Boska-Light.woff2') format('woff2'),
       url('/font/Boska-Light.woff') format('woff'),
       url('/font/Boska-Light.ttf') format('truetype');
  font-weight: 300;
  font-style: normal;
}

/* ===== Base Styles ===== */
.contact-wrapper {
  position: relative;
  width: 100%;
  min-height: 100vh;
  background: #F0EEE9;
  color: #1a1a1a;
  font-family: 'Boska', Georgia, serif;
  overflow-x: hidden;
}

.scroll-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  min-height: 100vh;
  background: #F0EEE9;
  will-change: transform;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  display: flex;
  flex-direction: column;
}

.paper-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  min-height: 100vh;
  background: url('/texture/paper.png');
  background-size: 500px 500px;
  background-repeat: repeat;
  pointer-events: none;
  z-index: 2;
  mix-blend-mode: multiply;
}

.center-line-svg {
  position: absolute;
  top: 50vh;
  left: 3rem;
  right: 3rem;
  width: calc(100% - 6rem);
  height: 10px;
  z-index: 3;
  pointer-events: none;
  opacity: 0.9;
  clip-path: inset(0 100% 0 0);
  animation: drawLine 1.5s cubic-bezier(0.4, 0, 0.2, 0.8) forwards;
  animation-delay: 0.5s;
}

.pencil-path {
  filter: url(#pencil-stroke);
  opacity: 0.85;
}

@keyframes drawLine {
  from {
    clip-path: inset(0 100% 0 0);
  }
  to {
    clip-path: inset(0 0% 0 0);
  }
}

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

.grid-col-start-1 { grid-column-start: 1; }
.grid-col-start-2 { grid-column-start: 2; }
.grid-col-start-3 { grid-column-start: 3; }
.grid-col-start-4 { grid-column-start: 4; }
.grid-col-start-5 { grid-column-start: 5; }
.grid-col-start-6 { grid-column-start: 6; }
.grid-col-start-7 { grid-column-start: 7; }
.grid-col-start-8 { grid-column-start: 8; }
.grid-col-start-9 { grid-column-start: 9; }
.grid-col-start-10 { grid-column-start: 10; }
.grid-col-start-11 { grid-column-start: 11; }
.grid-col-start-12 { grid-column-start: 12; }

/* ===== Hero Section ===== */
.hero {
  position: relative;
  height: 50vh;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overflow: visible;
  padding-bottom: clamp(1rem, 2vh, 1.5rem);
}

.hero-content {
  position: relative;
  z-index: 3;
  text-align: center;
  padding: clamp(1rem, 2vh, 2rem);
}

.hero-title {
  font-family: 'Boska', Georgia, serif;
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
}

.hero-title.visible .title-line:nth-child(1) {
  opacity: 1;
  transform: translateY(0);
  transition-delay: 0.1s;
}

.hero-title.visible .title-line:nth-child(2) {
  opacity: 1;
  transform: translateY(0);
  transition-delay: 0.25s;
}

.title-accent {
  color: #4a6741;
  font-style: italic;
  font-weight: 300;
  margin-left: 0.15em;
}

.hero-subtitle {
  font-family: 'Boska', Georgia, serif;
  font-size: clamp(0.875rem, 1.5vw, 1.25rem);
  font-weight: 300;
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

/* ===== Contact Section ===== */
.contact-section {
  padding: clamp(4rem, 8vh, 8rem) 0;
  flex: 1;
}

.section-title {
  font-family: 'Boska', Georgia, serif;
  font-size: clamp(1rem, 2vw, 1.2rem);
  font-weight: 400;
  text-align: center;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  margin: 0 0 clamp(3rem, 4vh, 4rem) 0;
  opacity: 0;
  transform: translateY(60px);
  transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.section-title.visible {
  opacity: 1;
  transform: translateY(0);
}

.contact-card {
  display: flex;
  flex-direction: column;
  gap: clamp(0.5rem, 1vh, 0.75rem);
  opacity: 0;
  transform: translateY(60px);
  transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1) var(--delay, 0s), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1) var(--delay, 0s);
}

.contact-card-irene {
  grid-column-start: 4;
  grid-column-end: 6;
}

.contact-card-nete {
  grid-column-start: 8;
  grid-column-end: 10;
}

.contact-card.visible {
  opacity: 1;
  transform: translateY(0);
}

.contact-name {
  font-family: 'Boska', Georgia, serif;
  font-size: clamp(1.5rem, 2.5vw + 0.5rem, 2.2rem);
  font-weight: 400;
  margin: 0 0 clamp(0.25rem, 0.5vh, 0.5rem) 0;
  letter-spacing: 0.02em;
}

.contact-email {
  display: inline-block;
  color: #1a1a1a;
  text-decoration: underline;
  text-decoration-color: #4a6741;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
  font-size: clamp(0.8rem, 1vw, 0.9rem);
  letter-spacing: 0.05em;
  transition: all 0.3s ease;
  margin-bottom: clamp(0.25rem, 0.5vh, 0.5rem);
}

.contact-email:hover {
  color: #4a6741;
  text-decoration-color: transparent;
}

.contact-phone {
  display: block;
  width: fit-content;
  color: #1a1a1a;
  text-decoration: underline;
  text-decoration-color: #4a6741;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
  font-size: clamp(0.8rem, 1vw, 0.9rem);
  letter-spacing: 0.05em;
  transition: all 0.3s ease;
  font-variant-numeric: lining-nums;
}

.contact-phone:hover {
  color: #4a6741;
  text-decoration-color: transparent;
}

.contact-email.green-contact,
.contact-phone.green-contact {
  color: #4a6741;
  text-decoration-color: #4a6741;
}

.contact-email.green-contact:hover,
.contact-phone.green-contact:hover {
  color: #4a6741;
  text-decoration-color: #4a6741;
}


/* ===== Responsive ===== */
@media (max-width: 900px) {
  
  .hero-subtitle {
    font-size: clamp(0.675rem, 1.3vw, 1.05rem);
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
  
  .grid-col-start-1,
  .grid-col-start-2,
  .grid-col-start-3,
  .grid-col-start-4,
  .grid-col-start-5,
  .grid-col-start-6,
  .grid-col-start-7,
  .grid-col-start-8,
  .grid-col-start-9,
  .grid-col-start-10,
  .grid-col-start-11,
  .grid-col-start-12 {
    grid-column-start: 1;
  }
  
  .contact-card-irene,
  .contact-card-nete {
    grid-column: span 12 !important;
    grid-column-start: 1 !important;
    grid-column-end: -1 !important;
  }
  
  .contact-card {
    margin-bottom: clamp(2rem, 4vh, 3rem);
  }
  
  .contact-card:last-child {
    margin-bottom: 0;
  }
  
  /* Ensure contact section is properly visible on mobile */
  .contact-section {
    padding: clamp(3rem, 6vh, 6rem) 0;
    min-height: auto;
  }
  
  /* Make sure contact info is readable on mobile */
  .contact-name {
    font-size: clamp(1.25rem, 4vw, 1.75rem);
  }
  
  .contact-email,
  .contact-phone {
    font-size: clamp(0.875rem, 3vw, 1rem);
    word-break: break-word;
  }
}
</style>
