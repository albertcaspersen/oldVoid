<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
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
const ease = 0.08

// Team members visibility for wipe animation
const visibleSections = ref(new Set())

let handleWheel = null
let handleResize = null
let handleKeyDown = null
let handleTouchStart = null
let handleTouchMove = null
let touchStartY = 0
let touchStartedInScrollable = false

// Products data
const products = ref([
  {
    id: 1,
    name: 'Vaso Azalea',
    number: 'No 156',
    image: '/pics/produktPics/Products/VasoAzalea.png',
    variants: [
      { code: 'No 156B', size: '60/36', price: '2.100' },
      { code: 'No 156C', size: '70/42', price: '2.600' },
      { code: 'No 156D', size: '80/48', price: '3.200' },
      { code: 'No 156E', size: '90/54', price: '3.600' }
    ]
  },
  {
    id: 2,
    name: 'Vaso Orlato Liscio',
    number: 'No 176',
    image: '/pics/produktPics/Products/VasoOrlatoLiscio.png',
    variants: [
      { code: 'No 176B', size: '60/48', price: '2.200' },
      { code: 'No 176C', size: '70/56', price: '2.800' },
      { code: 'No 176D', size: '80/64', price: '4.000' },
      { code: 'No 176E', size: '90/72', price: '5.400' }
    ]
  },
  {
    id: 3,
    name: 'Vaso del Prete',
    number: 'No 430',
    image: '/pics/produktPics/Products/VasoDelPrete.png',
    variants: [
      { code: 'No 430B', size: '60/54', price: '2.200' },
      { code: 'No 430C', size: '70/63', price: '3.000' },
      { code: 'No 430D', size: '80/72', price: '4.300' }
    ]
  },
  {
    id: 4,
    name: 'Vaso Origini Love',
    number: 'No 260',
    image: '/pics/produktPics/Products/VasoOriginiLove.png',
    variants: [
      { code: 'No 260B', size: '55/62', price: '3.100' },
      { code: 'No 260C', size: '63/73', price: '4.000' }
    ]
  },
  {
    id: 5,
    name: 'Vaso',
    number: 'No 162',
    image: '/pics/produktPics/Products/Vaso.png',
    variants: [
      { code: 'No 162C', size: '50/46', price: '2.000' },
      { code: 'No 162D', size: '60/55', price: '2.400' },
      { code: 'No 162E', size: '70/65', price: '3.100' }
    ]
  },
  {
    id: 6,
    name: 'Vaso Tondo Liscio Alto',
    number: 'No 780',
    image: '/pics/produktPics/Products/VasoTondoLiscioAlto.png',
    variants: [
      { code: 'No 780B', size: '55/46', price: '2.000' },
      { code: 'No 780C', size: '65/51', price: '2.500' },
      { code: 'No 780D', size: '75/57', price: '2.700' },
      { code: 'No 780E', size: '85/65', price: '4.000' }
    ]
  },
  {
    id: 7,
    name: 'Vaso Tondo Liscio',
    number: 'No 781',
    image: '/pics/produktPics/Products/VasoTondoLiscio.png',
    variants: [
      { code: 'No 781B', size: '55/38', price: '2.000' },
      { code: 'No 781C', size: '65/44', price: '2.400' },
      { code: 'No 781D', size: '75/48', price: '2.600' },
      { code: 'No 781E', size: '85/51', price: '4.000' }
    ]
  },
  {
    id: 8,
    name: 'Vaso dell\'Olmo Liscio',
    number: 'No 790',
    image: '/pics/produktPics/Products/VasoDellOlmoLiscio.png',
    variants: [
      { code: 'No 790A', size: '58/46', price: '2.200' },
      { code: 'No 790B', size: '68/54', price: '2.600' },
      { code: 'No 790C', size: '78/62', price: '3.600' }
    ]
  },
  {
    id: 9,
    name: 'Anfora Con Righe Fontana',
    number: 'No 992',
    image: '/pics/produktPics/Products/AnforaConRigheFontana.png',
    variants: [
      { code: 'No 992', size: 'H:75', price: '6.000' },
      { code: 'No 992A', size: 'H:90', price: '8.900' }
    ]
  },
  {
    id: 10,
    name: 'Coppa per Colonne',
    number: 'No 314',
    image: '/pics/produktPics/Products/CoppaPerColonne.png',
    variants: [
      { code: 'No 314', size: '45/36', price: '2.200' }
    ]
  },
  {
    id: 11,
    name: 'Anfora Napoletana',
    number: 'No 214',
    image: '/pics/produktPics/Products/AnforaNapoletanaB.png',
    variants: [
      { code: 'No 214B', size: '58/80', price: '4.200' },
      { code: 'No 214C', size: '70/90', price: '5.000' }
    ]
  },
  {
    id: 12,
    name: 'Anfora Napoletana',
    number: 'No 214B',
    image: '/pics/produktPics/Products/AnforaNapoletanaB-B.png',
    variants: [
      { code: 'No 214B-B', size: '58/70', price: '4.200' },
      { code: 'No 214B-C', size: '70/80', price: '5.000' }
    ]
  },
  {
    id: 13,
    name: 'Orcetto Felci',
    number: 'No 270',
    image: '/pics/produktPics/Products/OrcettoFelci.png',
    variants: [
      { code: 'No 270', size: '(30)/50', price: '2.400' }
    ]
  },
  {
    id: 14,
    name: 'Vaso dell\'Olmo',
    number: 'No 850',
    image: '/pics/produktPics/Products/VasoDellOlmo.png',
    variants: [
      { code: 'No 850A', size: '58/46', price: '2.300' },
      { code: 'No 850B', size: '68/54', price: '2.800' },
      { code: 'No 850C', size: '78/62', price: '3.900' }
    ]
  },
  {
    id: 15,
    name: 'Vaso Azalea Festonato',
    number: 'No 707',
    image: '/pics/produktPics/Products/VasoAzaleaFestonato.png',
    variants: [
      { code: 'No 707B', size: '60/36', price: '2.300' },
      { code: 'No 707C', size: '70/42', price: '2.800' },
      { code: 'No 707D', size: '80/48', price: '3.700' }
    ]
  },
  {
    id: 16,
    name: 'Portavaso Liscio',
    number: 'No 250',
    image: '/pics/produktPics/Products/PortavasoLiscio.png',
    variants: [
      { code: 'No 250', size: '40/31', price: '2.100' },
      { code: 'No 250A', size: '50/39', price: '2.400' },
      { code: 'No 250B', size: '60/47', price: '2.700' }
    ]
  },
  {
    id: 17,
    name: 'Ciotola con Bordo',
    number: 'No 400',
    image: '/pics/produktPics/Products/CiotolaConBordo.png',
    variants: [
      { code: 'No 400C', size: '80/24', price: '2.300' },
      { code: 'No 400D', size: '90/25', price: '2.700' },
      { code: 'No 400E', size: '100/30', price: '3.300' }
    ]
  },
  {
    id: 18,
    name: 'Vaso Ortensia',
    number: 'No 711',
    image: '/pics/produktPics/Products/VasoOrtensia.png',
    variants: [
      { code: 'No 711B', size: '61/47', price: '2.000' },
      { code: 'No 711C', size: '73/56', price: '2.600' },
      { code: 'No 711D', size: '85/71', price: '4.300' }
    ]
  },
  {
    id: 19,
    name: 'Vaso Alto Liscio',
    number: 'No 150',
    image: '/pics/produktPics/Products/VasoAltoLiscio.png',
    variants: [
      { code: 'No 150A', size: '50/52', price: '2.100' },
      { code: 'No 150B', size: '60/63', price: '2.700' },
      { code: 'No 150C', size: '70/74', price: '3.500' }
    ]
  },
  {
    id: 20,
    name: 'Cassetta',
    number: 'No 372',
    image: '/pics/produktPics/Products/Cassetta.png',
    variants: [
      { code: 'No 372', size: '81/36/H61', price: '3.300' },
      { code: 'No 372A', size: '100/36/H61', price: '3.900' }
    ]
  },
  {
    id: 21,
    name: 'Vaso Rigato Felci',
    number: 'No 271',
    image: '/pics/produktPics/Products/VasoRigatoFelci.png',
    variants: [
      { code: 'No 271A', size: '59/47', price: '2.400' },
      { code: 'No 271B', size: '69/56', price: '2.700' },
      { code: 'No 271C', size: '79/65', price: '4.100' }
    ]
  },
  {
    id: 22,
    name: 'Pina',
    number: 'No 327',
    image: '/pics/produktPics/Products/Pina.png',
    variants: [
      { code: 'No 327A', size: '20/39', price: '1.800' }
    ]
  },
  {
    id: 23,
    name: 'Sfera',
    number: 'No 335',
    image: '/pics/produktPics/Products/Sfera.png',
    variants: [
      { code: 'No 335', size: '25', price: '1.200' },
      { code: 'No 335A', size: '30', price: '1.400' }
    ]
  },
  {
    id: 24,
    name: '3xPiedino',
    number: 'No 703',
    image: '/pics/produktPics/Products/Piedino.png',
    variants: [
      { code: 'No 703A', size: '10/10', price: '450' }
    ]
  },
  {
    id: 25,
    name: 'Sotto Vaso',
    number: 'No 390',
    image: '/pics/produktPics/Products/SottoVaso.png',
    variants: [
      { code: 'No 390', size: '23/4', price: '800' },
      { code: 'No 390A', size: '28/4', price: '900' },
      { code: 'No 390B', size: '33/4', price: '950' },
      { code: 'No 390C', size: '39/5', price: '1.000' },
      { code: 'No 390D', size: '45/5', price: '1.050' },
      { code: 'No 390E', size: '50/5', price: '1.100' },
      { code: 'No 390F', size: '55/6', price: '1.200' },
      { code: 'No 390G', size: '60/6', price: '1.400' }
    ]
  }
])

// Landscape images for alternating rows
const landscapeImages = [
  '/pics/produktPics/ForsideSketch.png',
  '/pics/produktPics/ProduktBænk.png',
  '/pics/produktPics/ProduktPic3.png'
]

// Computed property to create grid rows with alternating landscape images
const gridRows = computed(() => {
  const rows = []
  const productsPerStandardRow = 4 // Products in regular rows
  const productsPerSpecialRow = 2 // Products in rows with landscape images
  let productIndex = 0
  let landscapeIndex = 0
  
  // EXACT PATTERN:
  // Række 1: 4 produkter
  // Række 2: 2 produkter + landskabsbillede til højre
  // Række 3: 4 produkter
  // Række 4: landskabsbillede til venstre + 2 produkter
  // Række 5: 4 produkter
  // Række 6: 2 produkter + landskabsbillede til højre
  // osv.
  
  while (productIndex < products.value.length || landscapeIndex < landscapeImages.length) {
    // Even row index (0, 2, 4...) = regular row with 4 products
    // Odd row index (1, 3, 5...) = special row with 2 products + landscape
    const isEvenRow = rows.length % 2 === 0
    
    if (isEvenRow && productIndex < products.value.length) {
      // Regular row: 4 products
      const rowProducts = products.value.slice(productIndex, Math.min(productIndex + productsPerStandardRow, products.value.length))
      
      if (rowProducts.length > 0) {
        rows.push({
          type: 'regular',
          products: rowProducts
        })
        productIndex += rowProducts.length
      } else {
        break
      }
    } else if (!isEvenRow && landscapeIndex < landscapeImages.length) {
      // Special row: 2 products + landscape (alternating sides)
      const landscapeImage = landscapeImages[landscapeIndex]
      // landscapeIndex 0 = right, 1 = left, 2 = right, etc.
      const isRightSide = landscapeIndex % 2 === 0
      
      // Get 2 products (or however many are left)
      const rowProducts = products.value.slice(productIndex, Math.min(productIndex + productsPerSpecialRow, products.value.length))
      
      rows.push({
        type: 'special',
        landscape: {
          image: landscapeImage,
          position: isRightSide ? 'right' : 'left'
        },
        products: rowProducts
      })
      
      productIndex += rowProducts.length
      landscapeIndex++
    } else {
      // Can't create more rows
      break
    }
  }
  
  return rows
})

// Track which dropdowns are open
const openDropdowns = ref(new Set())

const toggleDropdown = (productId) => {
  if (openDropdowns.value.has(productId)) {
    openDropdowns.value.delete(productId)
  } else {
    openDropdowns.value.add(productId)
  }
  // Force reactivity
  openDropdowns.value = new Set(openDropdowns.value)
}

const isDropdownOpen = (productId) => {
  return openDropdowns.value.has(productId)
}

// Lerp function for smooth interpolation
const lerp = (start, end, factor) => start + (end - start) * factor

// Check visibility of sections manually
const checkSectionVisibility = () => {
  if (!scrollContainer.value) return
  
  const sections = scrollContainer.value.querySelectorAll('[data-section]')
  const viewportTop = currentScroll
  const viewportBottom = currentScroll + window.innerHeight
  const threshold = window.innerHeight * 0.2
  
  sections.forEach(section => {
    const rect = section.getBoundingClientRect()
    const sectionTop = rect.top + currentScroll
    const sectionBottom = sectionTop + rect.height
    
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
  currentScroll = lerp(currentScroll, targetScroll, ease)
  
  if (scrollContainer.value) {
    scrollContainer.value.style.transform = `translate3d(0, ${-currentScroll}px, 0)`
  }
  
  scrollY.value = currentScroll
  checkSectionVisibility()
  
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

const startLoop = () => {
  if (!isRunning) {
    isRunning = true
    rafId = requestAnimationFrame(smoothScrollLoop)
  }
}

const getMaxScroll = () => {
  if (!scrollContainer.value) return 0
  return scrollContainer.value.scrollHeight - window.innerHeight
}

const updateBodyHeight = () => {
  if (scrollContainer.value) {
    document.body.style.height = `${scrollContainer.value.scrollHeight}px`
    documentHeight.value = scrollContainer.value.scrollHeight
  }
}

onMounted(() => {
  windowHeight.value = window.innerHeight
  
  document.documentElement.classList.add('smooth-scroll-active')
  
  setTimeout(() => {
    updateBodyHeight()
    
    handleWheel = (e) => {
      // Check if the event is inside a scrollable container
      const scrollableContainer = e.target.closest('.collection-text-scrollable')
      
      if (scrollableContainer) {
        e.preventDefault()
        
        const container = scrollableContainer
        const isAtTop = container.scrollTop === 0 && e.deltaY < 0
        const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1 && e.deltaY > 0
        
        // If at boundary, scroll the page instead
        if (isAtTop || isAtBottom) {
          const maxScroll = getMaxScroll()
          targetScroll += e.deltaY
          targetScroll = Math.max(0, Math.min(targetScroll, maxScroll))
          startLoop()
          return
        }
        
        // Reduce scroll sensitivity inside container (requires more scrolling)
        const scrollSpeed = 0.3 // Reduce to 30% of normal speed
        container.scrollTop += e.deltaY * scrollSpeed
        return
      }
      
      e.preventDefault()
      
      const maxScroll = getMaxScroll()
      targetScroll += e.deltaY
      targetScroll = Math.max(0, Math.min(targetScroll, maxScroll))
      
      startLoop()
    }
    
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
    
    handleResize = () => {
      windowHeight.value = window.innerHeight
      updateBodyHeight()
      
      const maxScroll = getMaxScroll()
      if (targetScroll > maxScroll) {
        targetScroll = maxScroll
        currentScroll = Math.min(currentScroll, maxScroll)
        startLoop()
      }
    }
    
    handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY
      // Check if touch started inside a scrollable container
      touchStartedInScrollable = !!e.target.closest('.collection-text-scrollable')
    }
    
    handleTouchMove = (e) => {
      // If touch started in scrollable container, allow native scrolling
      if (touchStartedInScrollable) {
        const scrollableContainer = e.target.closest('.collection-text-scrollable')
        if (scrollableContainer) {
          const container = scrollableContainer
          const isAtTop = container.scrollTop === 0
          const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1
          
          const touchY = e.touches[0].clientY
          const delta = touchStartY - touchY
          
          // Only prevent default if at boundary and trying to scroll beyond
          if ((isAtTop && delta < 0) || (isAtBottom && delta > 0)) {
            e.preventDefault()
            touchStartY = touchY
            
            const maxScroll = getMaxScroll()
            targetScroll += delta * 1.5
            targetScroll = Math.max(0, Math.min(targetScroll, maxScroll))
            startLoop()
          }
          // Otherwise let the container scroll naturally
          return
        }
      }
      
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
    
    visibleSections.value.add('hero')
    checkSectionVisibility()
    
    // Check visibility again after a short delay to catch elements that are already visible
    setTimeout(() => {
      checkSectionVisibility()
    }, 300)
  }, 100)
  
  setTimeout(updateBodyHeight, 500)
  setTimeout(updateBodyHeight, 1000)
})

onUnmounted(() => {
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
  
  document.documentElement.classList.remove('smooth-scroll-active')
  document.body.style.height = ''
})

</script>

<template>
  <div class="products-wrapper">
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
          <span class="title-line">Product</span>
          <span class="title-line title-details">details</span>
        </h1>
        <p class="hero-subtitle" :class="{ visible: visibleSections.has('hero') }">
          Our collection
        </p>
      </div>
    </section>
    
    <!-- Products Grid Section -->
    <section class="products-section">
      <div class="grid-container collection-intro">
        <div 
          class="collection-text-scrollable collection-text-left"
          data-section="collection-text-left"
          :class="{ visible: visibleSections.has('collection-text-left') }"
        >
          <p class="collection-text">
            We are proud to present our new Terracotta Collection. Each pot is carefully crafted by hand
            to ensure quality and durability, only using natural colour and sustainable materials in the
            production. The result of this creative process, originating from the Italian Renaissance, makes
            each terracotta pot unique and creates simple lines and harmony in any landscape.
          </p>
          <p class="collection-text">
            As part of the Terracotta Collection, we have designed three pots that are exclusively
            manufactured and distributed by us. The first one is Anfora Rigata Acqua, a tall water
            fountain terracotta pot in the shape of a classic beehive that provides a calm water feature to any garden.
          </p>
          <p class="collection-text">
            Next is Portavaso Felci, a small yet spacious terracotta pot that perfectly accommodates larger plants. This modest piece will light up the garden especially when paired together in groups of 2 or more.
          </p>
          <p class="collection-text">
            Lastly, we are pleased to present Vaso Origini Love. This new terracotta pot is inspired by
            classic jewellery design. This timeless piece is characterised by a simple sculpture encased by three bands creating a classic yet elegant structure.
          </p>
        </div>
      </div>
      <div class="grid-container products-grid">
        <template v-for="(row, rowIndex) in gridRows" :key="`row-${rowIndex}`">
          <!-- Regular Row: Just products -->
          <template v-if="row.type === 'regular'">
            <div 
              v-for="(product, productIdx) in row.products" 
              :key="product.id"
              class="product-item grid-col-3"
            >
              <div class="product-image-wrapper">
                <img :src="product.image" :alt="product.name" class="product-image" />
              </div>
              <div class="product-info">
                <div class="product-name-row">
                  <span class="product-name">{{ product.name }}</span>
                  <span class="product-number">{{ product.number }}</span>
                </div>
                <button 
                  class="product-details-toggle"
                  :class="{ open: isDropdownOpen(product.id) }"
                  @click="toggleDropdown(product.id)"
                >
                  See details
                  <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </div>
              
              <!-- Dropdown Details -->
              <div class="product-dropdown" :class="{ open: isDropdownOpen(product.id) }">
                <div class="dropdown-content">
                  <table class="variants-table">
                    <thead>
                      <tr>
                        <th>{{ product.name }}</th>
                        <th>Ø/H Size</th>
                        <th>DKK</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="variant in product.variants" :key="variant.code">
                        <td>{{ variant.code }}</td>
                        <td>{{ variant.size }}</td>
                        <td>{{ variant.price }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </template>
          
          <!-- Special Row: Landscape image + products -->
          <template v-else-if="row.type === 'special'">
            <!-- Landscape image on left -->
            <div 
              v-if="row.landscape.position === 'left'"
              class="landscape-item grid-col-6"
            >
              <div class="landscape-image-wrapper">
                <img :src="row.landscape.image" alt="Landscape" class="landscape-image" />
              </div>
            </div>
            
            <!-- Products -->
            <div 
              v-for="(product, productIdx) in row.products" 
              :key="product.id"
              class="product-item grid-col-3"
            >
              <div class="product-image-wrapper">
                <img :src="product.image" :alt="product.name" class="product-image" />
              </div>
              <div class="product-info">
                <div class="product-name-row">
                  <span class="product-name">{{ product.name }}</span>
                  <span class="product-number">{{ product.number }}</span>
                </div>
                <button 
                  class="product-details-toggle"
                  :class="{ open: isDropdownOpen(product.id) }"
                  @click="toggleDropdown(product.id)"
                >
                  See details
                  <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </div>
              
              <!-- Dropdown Details -->
              <div class="product-dropdown" :class="{ open: isDropdownOpen(product.id) }">
                <div class="dropdown-content">
                  <table class="variants-table">
                    <thead>
                      <tr>
                        <th>{{ product.name }}</th>
                        <th>Ø/H Size</th>
                        <th>DKK</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="variant in product.variants" :key="variant.code">
                        <td>{{ variant.code }}</td>
                        <td>{{ variant.size }}</td>
                        <td>{{ variant.price }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <!-- Landscape image on right -->
            <div 
              v-if="row.landscape.position === 'right'"
              class="landscape-item grid-col-6"
            >
              <div class="landscape-image-wrapper">
                <img :src="row.landscape.image" alt="Landscape" class="landscape-image" />
              </div>
            </div>
          </template>
        </template>
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

.products-wrapper {
  position: relative;
  min-height: 100vh;
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

.title-details {
  font-style: italic;
  color: #4a6741;
  font-weight: 300;
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

.scroll-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  background: #F0EEE9;
  will-change: transform;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

/* ===== Products Section ===== */
.products-section {
  padding: clamp(4rem, 10vh, 8rem) 0;
  transition: all 0.5s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.collection-intro {
  margin-bottom: clamp(3rem, 6vh, 5rem);
}

.collection-text-left {
  grid-column: 5 / 9;
  opacity: 0;
  transform: translateY(60px);
  transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.3s, transform 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.3s;
}

.collection-text-left.visible {
  opacity: 1;
  transform: translateY(0);
}


.collection-text-scrollable {
  max-height: clamp(300px, 40vh, 500px);
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 1rem;
  position: relative;
  mask-image: linear-gradient(
    to bottom,
    black 0%,
    black 90%,
    transparent 100%
  );
  -webkit-mask-image: linear-gradient(
    to bottom,
    black 0%,
    black 90%,
    transparent 100%
  );
}

.collection-text-scrollable::-webkit-scrollbar {
  width: 6px;
}

.collection-text-scrollable::-webkit-scrollbar-track {
  background: transparent;
}

.collection-text-scrollable::-webkit-scrollbar-thumb {
  background: rgba(26, 26, 26, 0.3);
  border-radius: 3px;
}

.collection-text-scrollable::-webkit-scrollbar-thumb:hover {
  background: rgba(26, 26, 26, 0.5);
}

.collection-text {
  font-family: 'Boska', Georgia, serif;
  font-size: clamp(1rem, 1.5vw, 1.2rem);
  font-weight: 400;
  line-height: 1.8;
  color: #1a1a1a;
  letter-spacing: 0.01em;
  margin-bottom: 1.5rem;
  opacity: 0.8;
  max-width: clamp(300px, 90%, 600px);
}

.collection-text:last-child {
  margin-bottom: 0;
}

.products-grid {
  transition: all 0.5s cubic-bezier(0.25, 0.1, 0.25, 1);
}

/* Landscape Image Item */
.landscape-item {
  display: flex;
  flex-direction: column;
}

.landscape-image-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 1;
  background: transparent;
  overflow: hidden;
}

.landscape-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 0;
}

/* Product Item */
.product-item {
  display: flex;
  flex-direction: column;
  transition: all 0.5s cubic-bezier(0.25, 0.1, 0.25, 1);
  will-change: transform, height;
}

.product-image-wrapper {
  position: relative;
  aspect-ratio: 1 / 1;
  background: #f8f6f2;
  overflow: hidden;
  margin-bottom: 1rem;
}

.product-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 20%;
}

/* Product Info */
.product-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.product-name-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.product-name {
  font-family: 'Boska', Georgia, serif;
  font-size: clamp(0.95rem, 1.2vw, 1.1rem);
  font-weight: 400;
  color: #1a1a1a;
  letter-spacing: 0.01em;
}

.product-number {
  font-family: 'Boska', Georgia, serif;
  font-size: clamp(0.8rem, 1vw, 0.95rem);
  font-weight: 300;
  color: #666;
  letter-spacing: 0.02em;
}

.product-details-toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background: none;
  border: none;
  padding: 0;
  font-family: 'Boska', Georgia, serif;
  font-size: clamp(0.8rem, 1vw, 0.9rem);
  font-weight: 300;
  color: #1a1a1a;
  cursor: pointer;
  letter-spacing: 0.02em;
}

.chevron-icon {
  width: 14px;
  height: 14px;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.product-details-toggle.open .chevron-icon {
  transform: rotate(180deg);
}

/* Dropdown */
.product-dropdown {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transform: translateY(-10px);
  transition: max-height 0.6s cubic-bezier(0.25, 0.1, 0.25, 1), 
              opacity 0.5s cubic-bezier(0.25, 0.1, 0.25, 1),
              transform 0.5s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.product-dropdown.open {
  max-height: 300px;
  opacity: 1;
  transform: translateY(0);
}

.dropdown-content {
  padding-top: 1.5rem;
}

.variants-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'Boska', Georgia, serif;
}

.variants-table th {
  font-weight: 400;
  font-size: clamp(0.85rem, 1vw, 0.95rem);
  text-align: left;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  color: #1a1a1a;
}

.variants-table th:nth-child(2),
.variants-table th:nth-child(3) {
  text-align: center;
}

.variants-table td {
  font-weight: 300;
  font-size: clamp(0.8rem, 0.95vw, 0.9rem);
  padding: 0.6rem 0;
  color: #333;
  letter-spacing: 0.01em;
}

.variants-table td:nth-child(2),
.variants-table td:nth-child(3) {
  text-align: center;
}

.variants-table tbody tr:not(:last-child) td {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
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

/* Responsive adjustments */
@media (max-width: 900px) {
  .products-section {
    padding: clamp(3rem, 7vh, 5rem) 0;
  }
  
  .collection-text-left {
    grid-column: 1 / -1;
  }
  
  .collection-text {
    font-size: clamp(0.9rem, 2vw, 1.1rem);
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
}

@media (max-width: 768px) {
  .hero {
    height: 40vh;
    padding-bottom: clamp(0.5rem, 1.5vh, 1rem);
  }
  
  .hero-content {
    padding: clamp(0.75rem, 1.5vh, 1.5rem);
  }
  
  .hero-title {
    font-size: clamp(2rem, 10vw, 4rem);
  }
  
  .hero-subtitle {
    font-size: clamp(0.75rem, 2vw, 1rem);
    margin-top: clamp(1rem, 2vh, 1.5rem);
  }
  
  .products-section {
    padding: clamp(2.5rem, 5vh, 4rem) 0;
  }
  
  .grid-container {
    margin-left: clamp(1rem, 2vw, 1.5rem);
    margin-right: clamp(1rem, 2vw, 1.5rem);
  }
  
  .collection-text {
    font-size: clamp(0.9rem, 2.5vw, 1.05rem);
    line-height: 1.6;
    margin-bottom: 1.25rem;
  }
  
  .product-name {
    font-size: clamp(0.85rem, 2vw, 1rem);
  }
  
  .product-number {
    font-size: clamp(0.75rem, 1.8vw, 0.9rem);
  }
  
  .product-details-toggle {
    font-size: clamp(0.75rem, 1.8vw, 0.85rem);
  }
  
  .variants-table th,
  .variants-table td {
    font-size: clamp(0.75rem, 2vw, 0.85rem);
    padding: 0.5rem 0;
  }
}

@media (max-width: 480px) {
  .hero {
    height: 35vh;
  }
  
  .hero-title {
    font-size: clamp(1.75rem, 12vw, 3rem);
  }
  
  .hero-subtitle {
    font-size: clamp(0.7rem, 2.5vw, 0.9rem);
    letter-spacing: 0.2em;
  }
  
  .products-section {
    padding: clamp(2rem, 4vh, 3rem) 0;
  }
  
  .grid-container {
    margin-left: clamp(0.75rem, 2vw, 1rem);
    margin-right: clamp(0.75rem, 2vw, 1rem);
  }
  
  .collection-text {
    font-size: clamp(0.85rem, 3vw, 0.95rem);
    line-height: 1.65;
    margin-bottom: 1.15rem;
  }
  
  .product-image-wrapper {
    margin-bottom: 0.75rem;
  }
  
  .product-name {
    font-size: clamp(0.8rem, 2.5vw, 0.95rem);
  }
  
  .product-number {
    font-size: clamp(0.7rem, 2vw, 0.85rem);
  }
  
  .product-details-toggle {
    font-size: clamp(0.7rem, 2vw, 0.8rem);
  }
  
  .chevron-icon {
    width: 12px;
    height: 12px;
  }
  
  .variants-table {
    font-size: clamp(0.7rem, 2.5vw, 0.8rem);
  }
  
  .variants-table th,
  .variants-table td {
    padding: 0.45rem 0;
  }
  
  .dropdown-content {
    padding-top: 1rem;
  }
  
  .center-line-svg {
    opacity: 0.6;
  }
}

@media (max-width: 360px) {
  .hero {
    height: 30vh;
  }
  
  .products-section {
    padding: clamp(1.5rem, 3vh, 2.5rem) 0;
  }
  
  .grid-container {
    margin-left: 0.75rem;
    margin-right: 0.75rem;
  }
  
  .collection-text {
    font-size: 0.8rem;
  }
}
</style>
