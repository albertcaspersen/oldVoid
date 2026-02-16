<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Nav from './Nav.vue'
import NoiseWipeImage from './components/NoiseWipeImage.vue'
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
let isMobile = false

// Team members visibility for wipe animation
const visibleSections = ref(new Set())

// Wipe progress for each team member (0 to 1)
const memberWipeProgress = ref([0, 0])

// Team data
const team = [
  {
    name: 'Nete Højlund',
    title: 'Dip. (Grd Design)',
    bio: 'Originally an interior designer I was always attracted to the idea of extending interior design into the exterior space viewing the spaces as a whole. Awarded KLC Design of the Year (2010) followed by RHS Silver Gilt Hampton Court Flower Show (2011) I co-founded the garden design practise that today enjoys international recognition.',
    email: 'nete@ourlandscapedesigns.com',
    image: '/pics/neteNyt.png'
  },
  {
    name: 'Irene Højlund',
    title: 'Project Manager',
    bio: 'I\'m passionate about gardening and outdoors which attracted me here, from a career as coordinator. I attend to design briefings, meetings and site surveys with the designer and take over from there running the projects in Denmark.',
    email: 'irene@ourlandscapedesigns.com',
    image: '/pics/ireneNEW.png'
  }
]


const services = [
  'Design concept visuals',
  'Mood boards',
  'Presentation drawings',
  'Garden masterplanning',
  'Detailed design',
  'Technical specifications',
  'Planting design',
  'Garden styling',
  'Contract administration',
  'Site supervision'
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
  const threshold = window.innerHeight * 0.2 // 20% of viewport
  
  sections.forEach(section => {
    const rect = section.getBoundingClientRect()
    // Since container is transformed, we need to calculate actual position
    const sectionTop = rect.top + currentScroll
    const sectionBottom = sectionTop + rect.height
    
    // Check if section is in viewport with threshold
    const isVisible = sectionBottom > viewportTop + threshold && 
                      sectionTop < viewportBottom - threshold
    
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
  
  // Update wipe progress for team member images based on scroll position
  // Simple logic: progress is based on how far the element's top has entered the viewport
  // - Element below viewport: progress = 0 (hidden)
  // - Element entering viewport: progress increases (0 to 1)
  // - Element in or above viewport: progress = 1 (fully visible)
  if (scrollContainer.value) {
    team.forEach((member, index) => {
      const memberWrapper = scrollContainer.value.querySelector(`.member-image-wrapper.member-${index}`) ||
                            scrollContainer.value.querySelectorAll('.member-image-wrapper')[index]
      
      if (memberWrapper) {
        const rect = memberWrapper.getBoundingClientRect()
        const elementTop = rect.top + currentScroll
        
        // Viewport boundaries
        const viewportBottom = currentScroll + window.innerHeight
        
        // Animation range: from when element top enters viewport to when it's fully inside
        const revealStart = viewportBottom - window.innerHeight * 0.1  // Start reveal when element is 40% into viewport
        const revealEnd = viewportBottom - window.innerHeight * 1.2    // Fully revealed when element is 80% into viewport
        
        let targetProgress = 0
        
        if (elementTop > revealStart) {
          // Element top is still below the reveal start point - hidden
          targetProgress = 0
        } else if (elementTop < revealEnd) {
          // Element top has passed the reveal end point - fully visible
          targetProgress = 1
        } else {
          // Element is in the reveal range - interpolate
          const range = revealStart - revealEnd
          targetProgress = (revealStart - elementTop) / range
          targetProgress = Math.max(0, Math.min(1, targetProgress))
        }
        
        // Smooth interpolation for fluid animation
        memberWipeProgress.value[index] = lerp(memberWipeProgress.value[index], targetProgress, 0.1)
      } else {
        memberWipeProgress.value[index] = 0
      }
    })
  }
  
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
    document.body.style.height = `${scrollContainer.value.scrollHeight}px`
    documentHeight.value = scrollContainer.value.scrollHeight
  }
}

onMounted(() => {
  windowHeight.value = window.innerHeight

  // Detect mobile and only enable custom smooth scroll on non-mobile
  isMobile = window.innerWidth <= 900

  if (isMobile) {
    // On mobile: use native scrolling, but make all sections visible immediately
    visibleSections.value.add('hero')
    visibleSections.value.add('intro')
    visibleSections.value.add('intro-text')
    visibleSections.value.add('team-title')
    visibleSections.value.add('member-0')
    visibleSections.value.add('member-1')
    visibleSections.value.add('services-title')
    for (let i = 0; i < 10; i++) {
      visibleSections.value.add(`service-${i}`)
    }
    // Set wipe progress to 1 for team images on mobile
    memberWipeProgress.value = [1, 1]
  } else {
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
      }

      // Touch handlers for desktop touch devices
      handleTouchStart = (e) => {
        touchStartY = e.touches[0].clientY
      }

      handleTouchMove = (e) => {
        e.preventDefault()
        const touchY = e.touches[0].clientY
        const delta = (touchStartY - touchY) * 1.5
        touchStartY = touchY
        const maxScroll = getMaxScroll()
        targetScroll += delta
        targetScroll = Math.max(0, Math.min(targetScroll, maxScroll))
        startLoop()
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
    }, 100)

    // Update body height periodically to handle dynamic content
    setTimeout(updateBodyHeight, 500)
    setTimeout(updateBodyHeight, 1000)
  }
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
  if (!isMobile) {
    document.documentElement.classList.remove('smooth-scroll-active')
  }
  document.body.style.height = ''
})

</script>

<template>
  <div class="about-wrapper">
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
          <span class="title-line">About</span>
          <span class="title-line title-accent">us</span>
        </h1>
        <p class="hero-subtitle" :class="{ visible: visibleSections.has('hero') }">
          A Shared Passion for Exceptional Gardens
        </p>
      </div>
    </section>
    
    <!-- Introduction Section -->
    <section class="intro-section">
      <div 
        class="intro-content grid-container"
        data-section="intro"
        :class="{ visible: visibleSections.has('intro') }"
      >
        <div class="intro-text" data-section="intro-text" :class="{ visible: visibleSections.has('intro') }">
          <h2>Crafting Outdoor Spaces</h2>
          <p>
            We are two sisters passionate about transforming outdoor spaces into 
            living works of art. Each garden we create is a unique story, tailored 
            to reflect the dreams and personality of its owner.
          </p>
        </div>
      </div>
    </section>
    
    <!-- Team Section -->
    <section class="team-section">
      <div class="grid-container team-grid">
        <h2 class="section-title grid-col-12" data-section="team-title" :class="{ visible: visibleSections.has('team-title') }">
          The Team
        </h2>
        
        <template v-for="(member, index) in team" :key="member.name">
          <div 
            class="member-image-wrapper"
            :class="[`member-${index}`, { visible: visibleSections.has(`member-${index}`) }]"
            :data-section="`member-${index}`"
            :style="{ '--delay': `${index * 0.15}s` }"
          >
            <div 
              class="member-image-parallax"
              :style="{ transform: `translateY(${(scrollY - windowHeight * 1.5) * -0.08}px)` }"
            >
              <div class="member-image-container">
                <NoiseWipeImage 
                  :src="member.image" 
                  :alt="member.name"
                  :wipe-progress="memberWipeProgress[index]"
                  class="member-image"
                />
              </div>
            </div>
          </div>
          <div 
            class="member-info"
            :class="[`member-${index}`, { visible: visibleSections.has(`member-${index}`) }]"
            :style="{ '--delay': `${index * 0.15}s` }"
          >
            <h3 class="member-name">{{ member.name }}</h3>
            <span class="member-title">{{ member.title }}</span>
            <p class="member-bio">{{ member.bio }}</p>
            <a 
              :href="`mailto:${member.email}`" 
              class="member-email"
              :class="{ 'green-contact': member.name === 'Nete Højlund' || member.name === 'Irene Højlund' }"
            >
              {{ member.email }}
            </a>
          </div>
        </template>
      </div>
    </section>
    
    <!-- Services Section with Parallax -->
    <section class="services-section">
      <div class="services-content grid-container">
        <h2 
          class="section-title light grid-col-12"
          data-section="services-title"
          :class="{ visible: visibleSections.has('services-title') }"
        >
          Our Services
        </h2>
        <p class="services-intro grid-col-12" :class="{ visible: visibleSections.has('services-title') }">
          We are pleased to offer the following services, which can be tailored<br>
          to suit client and individual project requirements
        </p>
        <ul class="services-list grid-col-12">
          <li 
            v-for="(service, index) in services"
            :key="service"
            class="service-item"
            :data-section="`service-${index}`"
            :class="{ visible: visibleSections.has(`service-${index}`) }"
            :style="{ '--delay': `${index * 0.08}s` }"
          >
            <span class="service-bullet"></span>
            {{ service }}
          </li>
        </ul>
      </div>
    </section>
    
    <!-- Footer -->
    <Footer />
    </div>
  </div>
</template>

<style>
/* Smooth scroll with inertia - prevent native scrolling */
html.smooth-scroll-active,
html.smooth-scroll-active body {
  overflow: hidden;
  height: 100%;
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
.about-wrapper {
  position: relative;
  width: 100%;
  min-height: 100vh;
  background: #F0EEE9;
  color: #1a1a1a;
  font-family: 'Boska', Georgia, serif;
}

.scroll-container {
  position: static;
  width: 100%;
  background: #F0EEE9;
}

html.smooth-scroll-active .scroll-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  background: #F0EEE9;
  will-change: transform;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
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
  margin-right: 0.3em;
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

@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(60px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.title-accent {
  color: #4a6741;
 
  font-style: italic;
  font-weight: 300;
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

@keyframes fadeSlideInSubtle {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 0.7;
    transform: translateY(0);
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

/* ===== Introduction Section ===== */
.intro-section {
  padding: clamp(4rem, 8vh, 8rem) 0;
}

.intro-content {
  opacity: 0;
  transform: translateY(60px);
  transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1) 1.5s, transform 0.8s cubic-bezier(0.4, 0, 0.2, 1) 1.5s;
}

.intro-content.visible {
  opacity: 1;
  transform: translateY(0);
}

.intro-text {
  grid-column: 3 / -1;
  opacity: 0;
  transform: translateY(60px);
  transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1) 1.5s, transform 0.8s cubic-bezier(0.4, 0, 0.2, 1) 1.5s;
}

.intro-text.visible {
  opacity: 1;
  transform: translateY(0);
}

.intro-text h2 {
  font-family: 'Boska', Georgia, serif;
  font-size: clamp(1.75rem, 4vw + 0.5rem, 3.5rem);
  font-weight: 300;
  margin: 0 0 clamp(1rem, 1.5vh, 1.5rem) 0;
  letter-spacing: -0.01em;
}

.intro-text p {
  font-size: clamp(1rem, 1.5vw, 1.2rem);
  line-height: 1.8;
  opacity: 0.8;
  max-width: clamp(300px, 90%, 600px);
}

/* ===== Team Section ===== */
.team-section {
  padding: clamp(4rem, 7vh, 6rem) 0 clamp(6rem, 8vh, 8rem);
  background: linear-gradient(180deg, transparent 0%, rgba(74, 103, 65, 0.03) 100%);
}

.section-title {
  font-family: 'Boska', Georgia, serif;
  font-size: clamp(2rem, 4vw + 1rem, 4rem);
  font-weight: 300;
  text-align: center;
  margin: 0 0 clamp(3rem, 4vh, 4rem) 0;
  letter-spacing: 0.05em;
  opacity: 0;
  transform: translateY(60px);
  transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.section-title.visible {
  opacity: 1;
  transform: translateY(0);
}

.team-grid {
  row-gap: clamp(4rem, 7vh, 6rem);
  align-items: center;
}

.member-image-wrapper.member-0 {
  grid-column: 2 / 6;
}

.member-info.member-0 {
  grid-column: 8 / 12;
}

.member-image-wrapper.member-1 {
  grid-column: 8 / 12;
  grid-row: 3;
}

.member-info.member-1 {
  grid-column: 2 / 6;
  grid-row: 3;
  align-self: center;
}

.member-image-wrapper {
  position: relative;
  overflow: hidden;
  background: transparent;
  opacity: 0;
  transform: translateY(60px);
  transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1) var(--delay, 0s), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1) var(--delay, 0s);
}

.member-info {
  opacity: 0;
  transform: translateY(60px);
  transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1) var(--delay, 0s), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1) var(--delay, 0s);
}

.member-image-wrapper.visible,
.member-info.visible {
  opacity: 1;
  transform: translateY(0);
}

.member-image-parallax {
  will-change: transform;
  background: transparent;
}

.member-image-container {
  position: relative;
  aspect-ratio: 4/5;
  overflow: hidden;
  background: transparent;
}


.member-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(20%) contrast(1.05);
  transition: filter 0.6s ease, transform 0.6s ease;
  display: block;
  background: transparent;
}

.member-image-wrapper:hover .member-image {
  filter: grayscale(0%) contrast(1);
}

/* Slightly scale up the new Nete image (member-0) */
.member-image-wrapper.member-0 .member-image {
  transform: scale(1.28);
  transform-origin: center;
}

/* Slightly scale up Irene's image (member-1) */
.member-image-wrapper.member-1 .member-image {
  transform: scale(1.08);
  transform-origin: center;
}


.member-info.member-0 {
  padding-left: 0;
  align-self: center;
}

.member-name {
  font-family: 'Boska', Georgia, serif;
  font-size: clamp(1.5rem, 2.5vw + 0.5rem, 2.2rem);
  font-weight: 400;
  margin: 0 0 clamp(0.25rem, 0.5vh, 0.5rem) 0;
}

.member-title {
  display: block;
  font-size: clamp(0.8rem, 1vw, 0.9rem);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #4a6741;
  font-style: italic;
  margin-bottom: clamp(1rem, 1.5vh, 1.5rem);
}

.member-bio {
  font-size: clamp(0.9rem, 1.1vw, 1rem);
  line-height: 1.8;
  opacity: 0.8;
  margin-bottom: clamp(1rem, 1.5vh, 1.5rem);
}

.member-email {
  display: inline-block;
  color: #1a1a1a;
  text-decoration: none;
  font-size: clamp(0.8rem, 1vw, 0.9rem);
  letter-spacing: 0.05em;
  border-bottom: 1px solid #4a6741;
  padding-bottom: 2px;
  transition: all 0.3s ease;
  margin-bottom: clamp(0.25rem, 0.5vh, 0.5rem);
}

.member-email:hover {
  color: #4a6741;
  border-color: transparent;
}

.member-phone {
  display: block;
  width: fit-content;
  color: #1a1a1a;
  text-decoration: none;
  font-size: clamp(0.8rem, 1vw, 0.9rem);
  letter-spacing: 0.05em;
  border-bottom: 1px solid #4a6741;
  padding-bottom: 2px;
  transition: all 0.3s ease;
}

.member-phone:hover {
  color: #4a6741;
  border-color: transparent;
}

.member-email.green-contact,
.member-phone.green-contact {
  color: #4a6741;
}

.member-email.green-contact:hover,
.member-phone.green-contact:hover {
  color: #4a6741;
  border-color: #4a6741;
}

/* ===== Services Section ===== */
.services-section {
  position: relative;
  padding: clamp(4rem, 8vh, 8rem) 0;
  background: #2c3e2d;
  overflow: hidden;
}

.services-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: 
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 1px,
      rgba(0, 0, 0, 0.03) 1px,
      rgba(0, 0, 0, 0.03) 2px
    );
  pointer-events: none;
  z-index: 1;
}

.services-content {
  position: relative;
  z-index: 3;
  text-align: center;
}

.section-title.light {
  color: #f5f3ef;
  font-size: clamp(2.5rem, 5vw + 1rem, 4.5rem);
  font-weight: 300;
  margin-bottom: 0;
}

.services-intro {
  font-size: clamp(0.8rem, 1.2vw, 1rem);
  line-height: 1.8;
  color: #f5f3ef;
  font-family: 'Boska', Georgia, serif;
  opacity: 0;
  transform: translateY(30px);
  margin-bottom: clamp(2.5rem, 4vh, 3.5rem);
  transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.2s, transform 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.2s;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.services-intro.visible {
  opacity: 1;
  transform: translateY(0);
}

.services-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: clamp(0.75rem, 1.5vh, 1rem) clamp(12rem, 20vw, 20rem);
  text-align: left;
  max-width: 900px;
  margin: 0 auto;
}

.service-item {
  display: flex;
  align-items: center;
  gap: clamp(0.75rem, 1.2vw, 1rem);
  font-size: clamp(1rem, 1.3vw, 1.1rem);
  color: #f5f3ef;
  padding: clamp(0.5rem, 0.8vh, 0.75rem) 0;
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1) var(--delay, 0s), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1) var(--delay, 0s);
}

.service-item.visible {
  opacity: 1;
  transform: translateY(0);
}

.service-bullet {
  width: clamp(5px, 0.7vw, 7px);
  height: clamp(5px, 0.7vw, 7px);
  background: #8fb88f;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ===== Responsive ===== */
@media (max-width: 900px) {
  
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
  
  .intro-text {
    grid-column: 1 / -1;
    text-align: center;
  }
  
  .intro-text p {
    margin: 0 auto;
  }
  
  .team-section .section-title {
    grid-row: 1;
  }
  
  .member-image-wrapper.member-0 {
    grid-column: 1 / -1;
    grid-row: 2;
  }
  
  .member-info.member-0 {
    grid-column: 1 / -1;
    grid-row: 5;
  }
  
  .member-image-wrapper.member-1 {
    grid-column: 1 / -1;
    grid-row: 4;
  }
  
  .member-info.member-1 {
    grid-column: 1 / -1;
    grid-row: 3;
  }
  
  .member-image-wrapper.member-1 .member-image-container {
    max-width: 100%;
    margin-left: 0;
  }
  
  .services-intro {
    text-align: center;
    white-space: pre-line;
  }
  
  .services-list {
    grid-template-columns: 1fr;
  }
}
</style>
