import { createRouter, createWebHistory } from 'vue-router'
import Void from '../Void.vue'
import AboutUs from '../AboutUs.vue'
import Contact from '../Contact.vue'
import Cases from '../Cases.vue'
import OurDesigns from '../OurDesigns.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Void
  },
  {
    path: '/about',
    name: 'About',
    component: AboutUs
  },
  {
    path: '/cases',
    name: 'Cases',
    component: Cases
  },
  {
    path: '/ourdesigns',
    name: 'OurDesigns',
    component: OurDesigns
  },
  {
    path: '/contact',
    name: 'Contact',
    component: Contact
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // On mobile, always scroll to top
    const isMobile = window.innerWidth <= 768
    if (isMobile) {
      return { top: 0 }
    }
    // On desktop, use saved position if available (back/forward navigation)
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0 }
  }
})

export default router
