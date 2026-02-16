<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  src: {
    type: String,
    required: true
  },
  alt: {
    type: String,
    default: ''
  },
  wipeProgress: {
    type: Number,
    default: 0
  }
})

const canvasRef = ref(null)
let gl = null
let program = null
let texture = null
let image = null
let animationFrame = null
let positionBuffer = null
let texCoordBuffer = null
let positionLocation = null
let texCoordLocation = null
let textureLocation = null
let wipeProgressLocation = null
let colorLocation = null
let resolutionLocation = null
let imageSizeLocation = null

// Vertex shader with aspect ratio correction
const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  uniform vec2 u_resolution;
  uniform vec2 u_imageSize;
  varying vec2 vUv;
  
  void main() {
    vUv = a_texCoord;
    
    // Calculate aspect ratios
    float canvasAspect = u_resolution.x / u_resolution.y;
    float imageAspect = u_imageSize.x / u_imageSize.y;
    
    // Adjust position to maintain aspect ratio (letterbox/pillarbox)
    vec2 adjustedPosition = a_position;
    if (imageAspect > canvasAspect) {
      // Image is wider - add letterbox (black bars top/bottom)
      adjustedPosition.y = a_position.y * (canvasAspect / imageAspect);
    } else {
      // Image is taller - add pillarbox (black bars left/right)
      adjustedPosition.x = a_position.x * (imageAspect / canvasAspect);
    }
    
    gl_Position = vec4(adjustedPosition, 0.0, 1.0);
  }
`

// Fragment shader - samme som 3D scenen
const fragmentShaderSource = `
  precision mediump float;
  uniform sampler2D uTexture;
  uniform float uWipeProgress;
  uniform vec3 uColor;
  varying vec2 vUv;
  
  // Noise funktioner for gradient mask
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }
  
  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  
  float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    for(int i = 0; i < 3; i++) {
      value += amplitude * noise(st);
      st *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }
  
  void main() {
    // If wipeProgress is 0 or very low, don't show anything
    if (uWipeProgress < 0.01) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }
    
    vec4 texColor = texture2D(uTexture, vUv);
    
    // Skab gradient mask baseret kun på noise - ingen lineær gradient
    vec2 gradientCoord = vUv * vec2(6.0, 5.0);
    
    // Optimeret: reduceret fra 3 til 2 noise lag for bedre performance (~33% hurtigere)
    float noise1 = fbm(gradientCoord);
    float noise2 = fbm(gradientCoord * 1.5 + vec2(10.0));
    
    // Kombiner noise lag for organisk pattern (bevarer visuel kvalitet)
    // Offset the mask slightly so it starts at a minimum value > 0
    float gradientMask = (noise1 * 0.6 + noise2 * 0.4) * 0.9 + 0.05;
    
    // After Effects gradient wipe: sammenlign gradient mask med progress
    float reveal = step(gradientMask, uWipeProgress);
    
    // Anvend reveal til alpha
    float alpha = texColor.a * reveal;
    
    // Anvend farve til teksturen
    vec3 finalColor = texColor.rgb * uColor;
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`

// Helper functions for WebGL
function createShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Error compiling shader:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  
  return shader
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Error linking program:', gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }
  
  return program
}

function createTexture(gl, image) {
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  
  // Set parameters for image texture
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  
  // Upload image to texture
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
  
  return texture
}

function initWebGL() {
  if (!canvasRef.value) return
  
  const canvas = canvasRef.value
  gl = canvas.getContext('webgl')
  
  if (!gl) {
    console.error('WebGL not supported')
    return
  }
  
  // Create shaders
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
  
  if (!vertexShader || !fragmentShader) return
  
  // Create program
  program = createProgram(gl, vertexShader, fragmentShader)
  
  if (!program) return
  
  // Create quad geometry (full screen quad)
  const positions = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1,
  ])
  
  const texCoords = new Float32Array([
    0, 1,
    1, 1,
    0, 0,
    0, 0,
    1, 1,
    1, 0,
  ])
  
  // Create buffers
  positionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
  
  texCoordBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW)
  
  // Store attribute locations
  positionLocation = gl.getAttribLocation(program, 'a_position')
  texCoordLocation = gl.getAttribLocation(program, 'a_texCoord')
  
  // Store uniform locations
  textureLocation = gl.getUniformLocation(program, 'uTexture')
  wipeProgressLocation = gl.getUniformLocation(program, 'uWipeProgress')
  colorLocation = gl.getUniformLocation(program, 'uColor')
  resolutionLocation = gl.getUniformLocation(program, 'u_resolution')
  imageSizeLocation = gl.getUniformLocation(program, 'u_imageSize')
  
  // Set canvas size based on container (will be updated on resize)
  updateCanvasSize()
  
  // Load image
  image = new Image()
  image.crossOrigin = 'anonymous'
  image.onload = () => {
    // Wait a frame to ensure container has correct size
    requestAnimationFrame(() => {
      // Update canvas size first
      updateCanvasSize()
      
      // Create texture from image
      texture = createTexture(gl, image)
      
      // Render
      render()
    })
  }
  image.onerror = () => {
    console.error('Failed to load image:', props.src)
  }
  image.src = props.src
}

function updateCanvasSize() {
  if (!canvasRef.value || !gl) return
  
  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  
  // Set canvas size accounting for device pixel ratio
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  
  // Set viewport
  gl.viewport(0, 0, canvas.width, canvas.height)
}

function render() {
  if (!gl || !program || !texture) return
  
  // Update canvas size if needed
  updateCanvasSize()
  
  // Enable alpha blending
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  
  // Clear canvas
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  
  // Use program
  gl.useProgram(program)
  
  // Set up position buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.enableVertexAttribArray(positionLocation)
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)
  
  // Set up texCoord buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
  gl.enableVertexAttribArray(texCoordLocation)
  gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0)
  
  // Set uniforms
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.uniform1i(textureLocation, 0)
  gl.uniform1f(wipeProgressLocation, props.wipeProgress)
  gl.uniform3f(colorLocation, 1.0, 1.0, 1.0)
  
  // Set resolution and image size for aspect ratio correction
  if (canvasRef.value && image && resolutionLocation && imageSizeLocation) {
    gl.uniform2f(resolutionLocation, canvasRef.value.width, canvasRef.value.height)
    gl.uniform2f(imageSizeLocation, image.width, image.height)
  }
  
  // Draw
  gl.drawArrays(gl.TRIANGLES, 0, 6)
}

// Watch for wipeProgress changes
watch(() => props.wipeProgress, () => {
  if (gl && program && texture) {
    render()
  }
})

// Watch for src changes
watch(() => props.src, () => {
  if (image) {
    image.src = props.src
  }
})

let handleResize = null

onMounted(() => {
  initWebGL()
  
  // Handle resize
  handleResize = () => {
    if (gl && program && texture) {
      render()
    }
  }
  
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (handleResize) {
    window.removeEventListener('resize', handleResize)
  }
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
  }
  if (texture && gl) {
    gl.deleteTexture(texture)
  }
  if (positionBuffer && gl) {
    gl.deleteBuffer(positionBuffer)
  }
  if (texCoordBuffer && gl) {
    gl.deleteBuffer(texCoordBuffer)
  }
  if (program && gl) {
    gl.deleteProgram(program)
  }
})
</script>

<template>
  <canvas 
    ref="canvasRef"
    :alt="alt"
    class="noise-wipe-image"
    :style="{ opacity: wipeProgress > 0 ? 1 : 0 }"
  ></canvas>
</template>

<style scoped>
.noise-wipe-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
</style>
