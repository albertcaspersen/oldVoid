import { createRouter, createWebHistory } from 'vue-router'
import Void from '../Void.vue'
import AboutUs from '../AboutUs.vue'
import Contact from '../Contact.vue'
import Cases from '../Cases.vue'
import Products from '../Products.vue'

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
    path: '/contact',
    name: 'Contact',
    component: Contact
  },
  {
    path: '/products',
    name: 'Products',
    component: Products
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
