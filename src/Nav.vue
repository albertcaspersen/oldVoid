<script setup>
import { useRouter, useRoute } from 'vue-router'
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { gsap } from 'gsap'

const props = defineProps({
  opacity: {
    type: Number,
    default: 1
  },
  isWarmedUp: {
    type: Boolean,
    default: false
  },
  onNavigate: {
    type: Function,
    default: null
  }
})

const router = useRouter()
const route = useRoute()
const navBarRef = ref(null)
const isMenuOpen = ref(false) // Track if burger menu is open via click

onMounted(() => {
  // Add click outside listener for burger menu
  document.addEventListener('click', handleClickOutside)
})

const goHome = () => {
  if (props.onNavigate) props.onNavigate()
  router.push('/')
}

const goToAbout = () => {
  if (props.onNavigate) props.onNavigate()
  router.push('/about')
}

const goToCases = () => {
  if (props.onNavigate) props.onNavigate()
  router.push('/cases')
}

const goToContact = () => {
  if (props.onNavigate) props.onNavigate()
  router.push('/contact')
}

const goToProducts = () => {
  if (props.onNavigate) props.onNavigate()
  router.push('/products')
}

// Toggle burger menu
const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

// Close menu when navigating
const closeMenu = () => {
  isMenuOpen.value = false
}

// Close menu when clicking outside
const handleClickOutside = (event) => {
  const burgerMenu = event.target.closest('.burger-menu')
  if (!burgerMenu && isMenuOpen.value) {
    closeMenu()
  }
}

// Watch for route changes to close menu
watch(() => route.path, () => {
  closeMenu()
})

onUnmounted(() => {
  // Remove click outside listener
  document.removeEventListener('click', handleClickOutside)
})

// Skjul under preloader på forsiden, animer ned ved landing page. På undersider: vis altid.
watch([() => props.isWarmedUp, () => route.path, navBarRef], ([warmedUp, path, navEl]) => {
  if (!navEl) return

  nextTick(() => {
    const el = navBarRef.value
    if (!el) return

    gsap.killTweensOf(el)

    // På undersider (ikke forsiden): vis nav altid
    if (path !== '/') {
      gsap.set(el, { y: 0, opacity: 1, visibility: 'visible' })
      return
    }

    if (!warmedUp) {
      // Preloader: skjul nav helt over viewport
      gsap.set(el, {
        y: '-100vh',
        opacity: 0,
        visibility: 'hidden'
      })
    } else {
      // Landing page klar: start fra top og animer ned (som landing logo animerer op)
      gsap.set(el, {
        y: '-100vh',
        opacity: 0,
        visibility: 'visible'
      })
      gsap.to(el, {
        y: 0,
        opacity: 1,
        duration: 1.8,
        ease: 'expo.out',
        delay: 0
      })
    }
  })
}, { immediate: true, flush: 'post' })
</script>

<template>
  <nav ref="navBarRef" class="nav-bar">
    <img 
      src="/logo/nytlogoold.svg" 
      alt="Logo" 
      class="nav-logo"
      @click="goHome"
    />
    
    <!-- Burger menu -->
    <div class="burger-menu" :class="{ 'is-open': isMenuOpen }">
      <div class="burger-icon" @click.stop="toggleMenu">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="burger-menu-items">
        <a v-if="route.path !== '/'" href="#" @click.prevent="() => { goHome(); closeMenu(); }" class="menu-item"><span class="menu-item-label">Home</span></a>
        <a v-if="route.path !== '/about'" href="#" @click.prevent="() => { goToAbout(); closeMenu(); }" class="menu-item"><span class="menu-item-label">About</span></a>
        <a v-if="route.path !== '/cases'" href="#" @click.prevent="() => { goToCases(); closeMenu(); }" class="menu-item"><span class="menu-item-label">Cases</span></a>
        <a v-if="route.path !== '/products'" href="#" @click.prevent="() => { goToProducts(); closeMenu(); }" class="menu-item"><span class="menu-item-label">Products</span></a>
        <a v-if="route.path !== '/contact'" href="#" @click.prevent="() => { goToContact(); closeMenu(); }" class="menu-item"><span class="menu-item-label">Contact</span></a>
      </div>
    </div>
  </nav>
</template>

<style scoped>
/* ===== Navigation ===== */
.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10000;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 3rem;
  pointer-events: none;
  will-change: transform, opacity; /* Optimize for GSAP animation */
  transform-origin: top center; /* Scale from top */
}

.nav-logo {
  position: absolute;
  top: 1.5rem;
  left: 3rem;
  z-index: 10000;
  max-height: 3.5rem;
  width: auto;
  cursor: pointer;
  pointer-events: auto;
  /* Compensate for extra transparent space at top of SVG */
  object-fit: contain;
  object-position: top;
  transform: translateY(-0.3rem);
}

/* Burger menu */
.burger-menu {
  position: absolute;
  top: 1.5rem;
  right: 3rem;
  z-index: 10001;
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  transform: translateY(0.2rem);
}

.burger-icon {
  width: 30px;
  height: 18px;
  position: relative;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.burger-icon span {
  display: block;
  height: 2px;
  width: 100%;
  background-color: #1a1a1a;
  border-radius: 2px;
  transition: all 0.3s ease;
  position: relative;
}

.burger-menu:hover .burger-icon span:nth-child(1),
.burger-menu.is-open .burger-icon span:nth-child(1) {
  transform: translateY(8px);
  z-index: 1;
}

.burger-menu:hover .burger-icon span:nth-child(2),
.burger-menu.is-open .burger-icon span:nth-child(2) {
  background-color: #4a6741;
  z-index: 2;
}

.burger-menu:hover .burger-icon span:nth-child(3),
.burger-menu.is-open .burger-icon span:nth-child(3) {
  transform: translateY(-8px);
  z-index: 1;
}

.burger-menu-items {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  background: transparent;
  border-radius: 4px;
  padding: 2rem 0;
  min-width: 180px;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-10px);
  transition: all 0.3s ease;
  pointer-events: none;
  z-index: 10002;
}

.burger-menu-items::before {
  content: '';
  position: absolute;
  top: -0.5rem;
  left: 0;
  right: 0;
  height: 0.5rem;
  background: transparent;
}

.burger-menu:hover .burger-menu-items,
.burger-menu.is-open .burger-menu-items,
.burger-menu-items:hover {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  pointer-events: auto;
}

.menu-item {
  display: block;
  padding: 0.75rem 0rem;
  color: #1a1a1a;
  text-decoration: none;
  font-family: 'Boska', Georgia, serif;
  font-size: 0.875rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  text-align: right;
  position: relative;
}
.menu-item-label {
  display: inline-block;
  position: relative;
}

.menu-item-label::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background-color: #4a6741;
  transform-origin: right center; /* restore right-to-left growth */
  transform: scaleX(0);
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
  bottom: -0.25rem;
}

.menu-item:hover .menu-item-label::after,
.menu-item:focus .menu-item-label::after,
.menu-item:focus-visible .menu-item-label::after {
  transform: scaleX(1);
}

.menu-item:first-child {
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
}

.menu-item:last-child {
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
}

/* ===== Responsive ===== */
@media (max-width: 900px) {
  .nav-bar {
    padding: 1rem 1.5rem;
  }
  
  .nav-logo {
    top: 1rem;
    left: 1.5rem;
    max-height: 3rem;
    /* Compensate for extra transparent space at top of SVG on mobile */
    transform: translateY(-0.2rem);
  }
  
  .burger-menu {
    top: 1rem;
    right: 1.5rem;
    display: flex;
    align-items: flex-start;
    transform: translateY(0.15rem);
  }
}
</style>
