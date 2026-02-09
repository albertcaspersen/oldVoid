<script setup>
</script>

<template>
  <router-view />
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
}

/* Only lock overflow for 3D garden view, not for about page */
html.locked, body.locked {
  overflow: hidden;
}

#app {
  width: 100%;
  height: 100%;
}
</style>
