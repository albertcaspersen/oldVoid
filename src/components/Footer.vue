<script setup>
import { ref, onMounted } from 'vue'

const isVisible = ref(false)

onMounted(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          isVisible.value = true
        }
      })
    },
    { threshold: 0.2 }
  )
  
  const contactContent = document.querySelector('.contact-content')
  if (contactContent) {
    observer.observe(contactContent)
  }
})
</script>

<template>
  <!-- SVG Filter for pencil stroke effect -->
  <svg width="0" height="0" style="position: absolute; pointer-events: none;">
    <defs>
      <filter id="footer-pencil-stroke" x="-50%" y="-50%" width="200%" height="200%">
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

  <section class="contact-section">
    <div 
      class="contact-content grid-container"
      :class="{ visible: isVisible }"
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
          <a href="https://www.facebook.com/OurLandscapeDesigns/" class="social-icon" aria-label="Facebook" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </a>
          <a href="https://www.instagram.com/nete_hojlund/" class="social-icon" aria-label="Instagram" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
            </svg>
          </a>
          <a href="https://dk.pinterest.com/netehojlund/" class="social-icon" aria-label="Pinterest" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  </section>

  <footer class="footer">
    <div class="grid-container">
      <p class="grid-col-12">&copy; {{ new Date().getFullYear() }} Our Landscape Designs. All rights reserved.</p>
    </div>
  </footer>
</template>

<style scoped>
/* ===== Grid Container ===== */
.grid-container {
  margin-left: 3rem;
  margin-right: 3rem;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: clamp(0.75rem, 1.5vw, 1.5rem);
}

.grid-col-12 { 
  grid-column: span 12; 
}

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
  filter: url(#footer-pencil-stroke);
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

@keyframes drawLine {
  to {
    clip-path: inset(0 0 0 0);
  }
}

.social-links {
  margin-top: 0;
}

.social-label {
  display: block;
  font-size: clamp(0.7rem, 1vw, 0.8rem);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  opacity: 0.7;
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

.social-icon svg {
  width: clamp(18px, 2.2vw, 20px);
  height: clamp(18px, 2.2vw, 20px);
}

/* ===== Footer ===== */
.footer {
  position: relative;
  padding: clamp(1.5rem, 2vh, 2rem) 0;
  text-align: center;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  z-index: 1;
}

.footer p {
  font-family: 'Boska', Georgia, serif;
  font-size: clamp(0.75rem, 1vw, 0.85rem);
  font-weight: 300;
  color: #1a1a1a;
  opacity: 0.5;
  margin: 0;
}

/* Responsive adjustments */
@media (max-width: 900px) {
  .grid-container {
    margin-left: 1.5rem;
    margin-right: 1.5rem;
    gap: clamp(0.5rem, 1vw, 1rem);
  }
  
  .grid-col-12 {
    grid-column: span 12;
  }
}
</style>
