<template>
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
