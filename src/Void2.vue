<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import * as THREE from 'three'

const containerRef = ref(null)
let scene, camera, renderer, plane, paperTexture, bumpTexture, imagePlane
let imageWipeProgress = 0 // Progress for gradient wipe effekt (0-1)
let animationId = null
let handleResize = null
let pencilLine = null
let pencilLineGroup = null
let lastEndT = -1 // Gem sidste endT for at undgå unødvendige opdateringer
let scrollProgress = 0
let targetScrollProgress = 0
let totalScroll = 0
let cameraPath = null
let currentCameraPosition = null
let targetCameraPosition = null
let currentLookAt = null
let targetLookAt = null
const keys = { w: false, a: false, s: false, d: false }
const moveSpeed = 0.1
const rotationSpeed = 0.02 // Hastighed for rotation med A og D
let cameraRotationY = 0 // Nuværende Y-rotation offset (venstre/højre)
let handleKeyDown = null
let handleKeyUp = null
let particles = null
let particleSystem = null
const particleCount = 500

// Tekst der vises under scroll
const currentText = ref('')
const textOpacity = ref(0)
const scrollTexts = [
  'Vi starter med en grundig dialog om dine drømme og ønsker for haven. Vi lytter til dine visioner og forstår dit behov for et personligt udendørsrum',
  'Derefter skitserer vi din unikke have i detaljerede plantegninger. Hver vinkel, hver plante og hver sti tænkes igennem med omhu',
  'Med vandfarve bringer vi skitsen til livs og viser dig, hvordan haven kommer til at se ud. Farverne fortæller historien om din fremtidige have',
  'Vi handler alt ind til haven med omhu og ekspertise. Hver plante er nøje udvalgt, hvert materiale er valgt med kærlighed til detaljen',
  'Det fysiske arbejde begynder med præcision og kærlighed. Vi former haven med hænder, der forstår både kunst og håndværk',
  'Hver plante, hver sten, hver detalje placeres med hensigt. Intet er tilfældigt, alt er gennemtænkt for at skabe harmoni',
  'Din drømmehave tager form gennem vores håndværk. Dag for dag vokser visionen og bliver til virkelighed lige foran dine øjne',
  'Resultatet er en skræddersyet have, unik som dig. Et rum hvor naturen møder design, og hvor hver detalje fortæller din historie'
]
let previousTextIndex = -1
let fadeState = 'in' // 'in', 'out', eller 'pause'
let fadeProgress = 0
const textSectionRatio = 0.55 // Hvor meget af hver sektion teksten skal vises (0.55 = 55% tekst, 45% pause)
let isScrollingBackToStart = false

onMounted(() => {
  // Opret scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xFFFFFF) // Hvid baggrund
 //scene.fog = new THREE.FogExp2(0xffffff, 0.00) // Hvid fog der skjuler horisonten
  
  // Opret kamera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  
  // Opret bølget kamera path (som en sti)
  // PATH KONFIGURATION - Juster disse værdier for at ændre pathen:
  const planeSize = 50 // Planens størrelse (50x50)
  const pathMargin = 5 // Margin fra kanten af planen
  const pathStartX = 0 // Start X position (0 = midten)
  const pathStartZ = planeSize / 2 - pathMargin // Start Z position (nær toppen af planen)
  const pathEndX = 0 // Slut X position (0 = midten)
  const pathEndZ = -planeSize / 2 + pathMargin // Slut Z position (nær bunden af planen)
  const pathWidth = 8 // Bredde af bølgerne (side til side bevægelse)
  const pathHeight = 0.8 // Højde af kameraet over planen
  const pathWaveFrequency = 4 // Antal bølger langs pathen (højere = flere bølger)
  const pathVerticalVariation = 0.3 // Op/ned variation (0 = ingen, højere = mere variation)
  
  const pathPoints = []
  const numPoints = 30 // Antal kontrolpunkter (flere = glattere kurve)
  
  // Opret bølget path med flere kontrolpunkter
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints // 0 til 1
    
    // Lineær interpolation fra start til slut position
    const baseX = pathStartX + (pathEndX - pathStartX) * t
    const baseZ = pathStartZ + (pathEndZ - pathStartZ) * t
    
    // Tilføj bølget bevægelse side til side
    const waveX = Math.sin(t * Math.PI * pathWaveFrequency) * pathWidth
    
    // Tilføj lidt op og ned bevægelse
    const waveY = pathHeight + Math.sin(t * Math.PI * 2) * pathVerticalVariation
    
    // Sikr at vi ikke går udenfor planen
    const x = Math.max(-planeSize/2 + pathMargin, Math.min(planeSize/2 - pathMargin, baseX + waveX))
    const z = Math.max(-planeSize/2 + pathMargin, Math.min(planeSize/2 - pathMargin, baseZ))
    
    pathPoints.push(new THREE.Vector3(x, waveY, z))
  }
  
  cameraPath = new THREE.CatmullRomCurve3(pathPoints)
  
  // Start kameraet højt oppe og kig direkte ned
  camera.position.set(0, 8, 0) // Tættere på planen
  
  // Initialiser smooth interpolation variabler
  currentCameraPosition = new THREE.Vector3(0, 8, 0)
  targetCameraPosition = new THREE.Vector3(0, 8, 0)
  
  // Kig direkte ned mod planen
  const lookDownPoint = new THREE.Vector3(0, 0, 0) // Midtpunktet på planen
  camera.lookAt(lookDownPoint)
  currentLookAt = lookDownPoint.clone()
  targetLookAt = lookDownPoint.clone()
  
  // Opret blyant-streg (bruger samme path som kameraet)
  const createPencilLine = () => {
    if (!cameraPath) return
    
    // Opret en gruppe til at holde alle linjesegmenter
    pencilLineGroup = new THREE.Group()
    scene.add(pencilLineGroup)
    
    // Opret hovedlinjen (bruges til at opdatere geometri)
    const geometry = new THREE.BufferGeometry()
    const material = new THREE.LineBasicMaterial({
      color: 0x222222, // Mørkegrå
      transparent: true,
      opacity: 0.85
    })
    
    pencilLine = new THREE.Line(geometry, material)
    pencilLineGroup.add(pencilLine)
  }
  
  createPencilLine()
  
  // Opret renderer
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  containerRef.value.appendChild(renderer.domElement)
  
  // Load papir tekstur fra billede
  const textureLoader = new THREE.TextureLoader()
  paperTexture = textureLoader.load('/texture/paper.png', (texture) => {
    // Når teksturen er loaded, sæt indstillinger for crisp tekstur
    texture.wrapS = THREE.RepeatWrapping // Tillad gentagelser
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(4, 4) // Gentag teksturen flere gange
    // Brug LineFiltering for skarpere tekstur (bevarer detaljer bedre end default)
    texture.magFilter = THREE.LinearFilter
    texture.minFilter = THREE.LinearFilter
    // Deaktiver mipmapping for at bevare detaljer
    texture.generateMipmaps = false
    texture.needsUpdate = true
  })
  paperTexture.wrapS = THREE.RepeatWrapping // Tillad gentagelser
  paperTexture.wrapT = THREE.RepeatWrapping
  paperTexture.repeat.set(4, 4) // Gentag teksturen flere gange
  // Sæt filtering indstillinger også før teksturen er loaded
  paperTexture.magFilter = THREE.LinearFilter
  paperTexture.minFilter = THREE.LinearFilter
  paperTexture.generateMipmaps = false
  
  // Tilføj billede på planen med gradient wipe shader
  const imageTexture = textureLoader.load('/pics/sketch1-Photoroom.png', (loadedTexture) => {
    // Når teksturen er loaded, beregn aspect ratio og opdater størrelse
    const aspect = loadedTexture.image.width / loadedTexture.image.height
    const imageSize = 10 // Størrelse i 3D enheder
    const imageWidth = imageSize
    const imageHeight = imageSize / aspect
    
    // Opdater geometri med korrekt aspect ratio
    if (imagePlane) {
      imagePlane.geometry.dispose()
      imagePlane.geometry = new THREE.PlaneGeometry(imageWidth, imageHeight)
    }
    
    // Opdater tekstur i shader material
    if (imagePlane && imagePlane.material && imagePlane.material.uniforms) {
      imagePlane.material.uniforms.uTexture.value = imageTexture
    }
  })
  
  // Custom shader for gradient wipe effekt
  const gradientWipeShader = {
    uniforms: {
      uTexture: { value: null },
      uWipeProgress: { value: 0.0 },
      uColor: { value: new THREE.Color(0x222222) }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
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
        for(int i = 0; i < 4; i++) {
          value += amplitude * noise(st);
          st *= 2.0;
          amplitude *= 0.5;
        }
        return value;
      }
      
      void main() {
        vec4 texColor = texture2D(uTexture, vUv);
        
        // Skab gradient mask baseret kun på noise - ingen lineær gradient
        // Dette simulerer After Effects gradient wipe hvor hver pixel har en "reveal order"
        // baseret på noise pattern
        vec2 gradientCoord = vUv * vec2(6.0, 5.0); // Øget noise skala for mere variation
        
        // Brug noise med flere lag for mere kompleks pattern
        float noise1 = fbm(gradientCoord);
        float noise2 = fbm(gradientCoord * 1.5 + vec2(10.0));
        float noise3 = fbm(gradientCoord * 0.7 + vec2(20.0));
        
        // Kombiner flere noise lag for mere kompleks og organisk pattern
        float gradientMask = (noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2);
        
        // After Effects gradient wipe: sammenlign gradient mask med progress
        // Hvis gradient mask værdi er lavere end progress, vis pixel
        // Brug step for skarpe kanter (ingen softness)
        float reveal = step(gradientMask, uWipeProgress);
        
        // Anvend reveal til alpha
        float alpha = texColor.a * reveal;
        
        // Anvend farve til teksturen
        vec3 finalColor = texColor.rgb * uColor;
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `
  }
  
  // Opret shader material
  const imageMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: imageTexture },
      uWipeProgress: { value: 0.0 },
      uColor: { value: new THREE.Color(0x222222) }
    },
    vertexShader: gradientWipeShader.vertexShader,
    fragmentShader: gradientWipeShader.fragmentShader,
    transparent: true,
    side: THREE.DoubleSide
  })
  
  // Start med en standard størrelse, opdateres når teksturen er loaded
  const imageGeometry = new THREE.PlaneGeometry(10, 10)
  imagePlane = new THREE.Mesh(imageGeometry, imageMaterial)
  imagePlane.rotation.x = -Math.PI / 2 // Roter så billedet ligger fladt
  imagePlane.position.set(0, 0.02, 7) // Lidt over griddet
  scene.add(imagePlane)
  
  // Opret bump map for papir struktur
  const createBumpTexture = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 1024
    const ctx = canvas.getContext('2d')
    
    const noise = (x, y) => {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
      return (n - Math.floor(n))
    }
    
    const smoothNoise = (x, y) => {
      const intX = Math.floor(x)
      const intY = Math.floor(y)
      const fracX = x - intX
      const fracY = y - intY
      
      const v1 = noise(intX, intY)
      const v2 = noise(intX + 1, intY)
      const v3 = noise(intX, intY + 1)
      const v4 = noise(intX + 1, intY + 1)
      
      const i1 = v1 * (1 - fracX) + v2 * fracX
      const i2 = v3 * (1 - fracX) + v4 * fracX
      return i1 * (1 - fracY) + i2 * fracY
    }
    
    const fractalNoise = (x, y) => {
      let value = 0
      let amplitude = 1
      let frequency = 0.02
      
      for (let i = 0; i < 3; i++) {
        value += smoothNoise(x * frequency, y * frequency) * amplitude
        amplitude *= 0.5
        frequency *= 2
      }
      return value
    }
    
    const imageData = ctx.createImageData(canvas.width, canvas.height)
    const data = imageData.data
    
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const index = (y * canvas.width + x) * 4
        
        const n = fractalNoise(x, y)
        const bump = Math.floor(n * 128 + 127) // Grayscale for bump
        
        data[index] = bump     // R
        data[index + 1] = bump // G
        data[index + 2] = bump // B
        data[index + 3] = 255  // Alpha
      }
    }
    
    ctx.putImageData(imageData, 0, 0)
    
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(2, 2)
    return texture
  }
  
  bumpTexture = createBumpTexture()
  
  // Opret et stort plan
  const planeGeometry = new THREE.PlaneGeometry(50, 50, 10, 10)
  const planeMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffffff, // Hvid farve så teksturen vises tydeligt
    map: paperTexture,
    bumpMap: bumpTexture,
    bumpScale: 0.15,
    emissive: 0xffffff, // Hvid emissive
    emissiveIntensity: 0.0, // Ingen emissive så teksturen vises tydeligt
    side: THREE.DoubleSide
  })
  plane = new THREE.Mesh(planeGeometry, planeMaterial)
  plane.rotation.x = -Math.PI / 2 // Roter planen så den ligger fladt
  scene.add(plane)
  
  
  // Opret flyvende specs/partikler
  const createParticles = () => {
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const velocities = []
    
    // Initialiser partikler med tilfældige positioner og hastigheder
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3
      
      // Tilfældig position i rummet (spredt over hele planens areal 50x50)
      positions[i3] = (Math.random() - 0.5) * 50 // X - hele planens bredde
      positions[i3 + 1] = Math.random() * 2.5 + 0.5 // Y (tæt på kamera højde 0.5-3)
      positions[i3 + 2] = (Math.random() - 0.5) * 50 // Z - hele planens længde
      
      // Tilfældig hastighed (meget langsom og stille)
      velocities.push({
        x: (Math.random() - 0.5) * 0.008,
        y: (Math.random() - 0.5) * 0.004,
        z: (Math.random() - 0.5) * 0.008
      })
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    
    // Material for partiklerne
    const material = new THREE.PointsMaterial({
      color: 0x444444, // Mørkere grå så de kan ses mod hvid baggrund
      size: 0.02, // Meget små specs
      transparent: true,
      opacity: 0.6, // Synlige men subtile
      sizeAttenuation: true, // Størrelse ændres med afstand
      depthWrite: false
    })
    
    particleSystem = new THREE.Points(geometry, material)
    scene.add(particleSystem)
    
    // Gem velocities så vi kan opdatere dem
    particles = {
      geometry,
      velocities,
      positions
    }
  }
  
  createParticles()
  
  // Tilføj lys (meget stærkt hvidt lys)
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5) // Øget intensitet
  scene.add(ambientLight)
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5) // Øget intensitet
  directionalLight.position.set(10, 10, 5)
  scene.add(directionalLight)
  
  // Opdater streg baseret på scroll - følger kameraets path
  const updatePencilLine = () => {
    if (!pencilLine || !cameraPath) return
    
    // Linjen starter bag kameraet og vokser fremad
    // Når linjen når foran kameraet (0), begynder kameraet at følge med
    const lineStartOffset = 0.0 // Start bag kameraet (tættere på kameraet)
    const lineEndOffset = 0.01 // Slut foran kameraet
    const totalLineLength = lineEndOffset - lineStartOffset // 0.08 total længde
    
    // Beregn hvor langt linjen er kommet baseret på scrollProgress
    // scrollProgress fra 0 til 0.1 skal mappe til linjen fra -0.02 til 0
    // Når linjen når 0 (foran kameraet), begynder kameraet at følge med
    const lineProgress = Math.min(1, Math.max(0, scrollProgress / 0.1)) // Juster denne værdi for at kontrollere hvor hurtigt linjen vokser (lavere = hurtigere)
    
    let cameraT, startT, endT
    
    if (lineProgress < 0.5) {
      // Før linjen når foran kameraet: linjen vokser fra -0.02 mod 0
      // Kameraet står stille ved position 0
      cameraT = 0
      // Linjen vokser fra -0.02 mod 0
      // Ved lineProgress 0: startT = -0.02, endT = -0.02
      // Ved lineProgress 0.5: startT = -0.02, endT = 0
      const currentLineEnd = lineStartOffset + (lineProgress * 2 * (0 - lineStartOffset))
      startT = lineStartOffset // Start ved -0.02
      endT = currentLineEnd // Slut ved currentLineEnd (vokser mod 0)
    } else {
      // Efter linjen har nået foran kameraet: kameraet begynder at følge med
      // Map scrollProgress fra [0.1, 1] til kamera position [0, 1]
      cameraT = Math.min(1, ((scrollProgress - 0.1) / (1 - 0.1)))
      // Linjen følger med kameraet (fra cameraT - 0.06 til cameraT + 0.06)
      startT = Math.max(0, cameraT - 0.06)
      endT = Math.min(1, cameraT + 0.06)
    }
    
    // Sikr at startT < endT for at undgå fejl
    if (startT >= endT) {
      endT = startT + 0.001 // Tilføj lille offset hvis de er ens
    }
    
    // Opret punkter langs pathen fra startT til endT
    // Projektér ned på planen (Y = 0.01) så stregen ligger på papiret
    // Sikr at startT og endT er gyldige (mellem 0 og 1)
    const safeStartT = Math.max(0, Math.min(1, startT))
    const safeEndT = Math.max(0, Math.min(1, endT))
    const segmentLength = safeEndT - safeStartT
    const numPoints = Math.max(20, Math.floor(Math.abs(segmentLength) * 600)) // Flere punkter for smooth linje
    const points = []
    
    // Sikr at vi altid har mindst 2 punkter
    if (segmentLength > 0) {
      for (let i = 0; i <= numPoints; i++) {
        const pathT = safeStartT + (i / numPoints) * segmentLength
        const pathPoint = cameraPath.getPoint(pathT)
        // Projektér ned på planen
        points.push(new THREE.Vector3(pathPoint.x, 0.01, pathPoint.z))
      }
    } else {
      // Hvis vi er ved slutningen, vis et lille segment
      const pathPoint = cameraPath.getPoint(Math.max(0, safeStartT - 0.01))
      points.push(new THREE.Vector3(pathPoint.x, 0.01, pathPoint.z))
      const nextPoint = cameraPath.getPoint(safeStartT)
      points.push(new THREE.Vector3(nextPoint.x, 0.01, nextPoint.z))
    }
    
    // Opret ny geometri med de synlige punkter
    if (points.length > 0) {
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      
      // Opdater hovedlinjen
      pencilLine.geometry.dispose()
      pencilLine.geometry = geometry
      
      // Kun opdater overlays hvis stregen faktisk er vokset (endT er ændret betydeligt)
      // Dette forhindrer vibration når stregen ikke ændrer sig
      const endTChanged = Math.abs(endT - lastEndT) > 0.001
      
      if (endTChanged) {
        // Fjern gamle overlays (behold kun hovedlinjen)
        while (pencilLineGroup.children.length > 1) {
          const child = pencilLineGroup.children[1]
          if (child.geometry) child.geometry.dispose()
          if (child.material) child.material.dispose()
          pencilLineGroup.remove(child)
        }
        
        // Tilføj teksturerede overlays for blyant-effekt
        // Opret mange små linjesegmenter med varierende opacitet for tykkere, tekstureret linje
        // Brug deterministisk noise baseret på position så det ikke vibrerer
        const hash = (x, y, z) => {
          return Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
        }
        
        const seededRandom = (x, y, z, seed) => {
          const n = hash(x, y, z + seed)
          return (n - Math.floor(n))
        }
        
        for (let i = 0; i < points.length - 1; i++) {
          // Tilføj flere overlays per segment for tykkere linje
          for (let layer = 0; layer < 7; layer++) {
            // Brug deterministisk noise baseret på punktets position og layer
            // Lidt større variation for tykkere linje
            const noiseScale = 0.03
            const noise1 = (seededRandom(points[i].x, points[i].y, points[i].z, layer * 0.1) - 0.5) * noiseScale
            const noise2 = (seededRandom(points[i].x, points[i].y, points[i].z, layer * 0.1 + 1) - 0.5) * noiseScale
            const noise3 = (seededRandom(points[i + 1].x, points[i + 1].y, points[i + 1].z, layer * 0.1) - 0.5) * noiseScale
            const noise4 = (seededRandom(points[i + 1].x, points[i + 1].y, points[i + 1].z, layer * 0.1 + 1) - 0.5) * noiseScale
            
            const p1 = new THREE.Vector3(
              points[i].x + noise1,
              points[i].y,
              points[i].z + noise2
            )
            const p2 = new THREE.Vector3(
              points[i + 1].x + noise3,
              points[i + 1].y,
              points[i + 1].z + noise4
            )
            
            // Deterministisk opacity baseret på position
            const opacitySeed = seededRandom(points[i].x, points[i].z, layer, 100)
            const opacity = opacitySeed * 0.6 + 0.3 // Varierende opacitet 0.3-0.9
            
            const segmentGeometry = new THREE.BufferGeometry().setFromPoints([p1, p2])
            const segmentMaterial = new THREE.LineBasicMaterial({
              color: 0x333333, // Mørkegrå
              linewidth: 13, // Tykkere streger
              transparent: true,
              opacity: opacity
            })
            
            const segmentLine = new THREE.Line(segmentGeometry, segmentMaterial)
            pencilLineGroup.add(segmentLine)
          }
        }
        
        // Opdater lastEndT
        lastEndT = endT
      }
    }
  }
  
  // Opdater kamera position baseret på scroll
  const updateCameraPosition = () => {
    // Kameraet er fast højt oppe og kigger altid direkte ned
    // Vi kan flytte kameraet horisontalt baseret på scroll hvis nødvendigt
    const cameraStartThreshold = 0.1
    
    let t
    if (scrollProgress < cameraStartThreshold) {
      t = 0
    } else {
      t = Math.min(1, (scrollProgress - cameraStartThreshold) / (1 - cameraStartThreshold))
    }
    
    // Hvis vi vil følge pathen horisontalt, kan vi bruge cameraPath
    // Men kameraet forbliver højt oppe
    if (cameraPath) {
      const pathPoint = cameraPath.getPoint(t)
      // Behold højden, men følg pathen horisontalt
      targetCameraPosition.set(pathPoint.x, 8, pathPoint.z)
    } else {
      // Ellers hold kameraet i midten
      targetCameraPosition.set(0, 8, 0)
    }
    
    // Smooth interpolation af kamera position (lavere værdi = mere smooth)
    currentCameraPosition.lerp(targetCameraPosition, 0.08)
    camera.position.copy(currentCameraPosition)
    
    // Kig altid direkte ned mod planen (under kameraet)
    const lookDownPoint = new THREE.Vector3(currentCameraPosition.x, 0, currentCameraPosition.z)
    camera.lookAt(lookDownPoint)
  }
  
  // Scroll/wheel event handler
  const handleScroll = (event) => {
    if (event) {
      // Akkumuler scroll med lavere sensitivity for smooth bevægelse
      totalScroll += event.deltaY * 0.00003 // Reduceret for smooth scroll
      // Begræns target scroll progress til 0-1
      targetScrollProgress = Math.min(1, Math.max(0, totalScroll))
    }
    
    // Opdater ikke direkte - lad animation loop håndtere det smooth
    // Kamera opdateres nu i animation loop med smooth interpolation
  }
  
  // Tilføj wheel listener (mouse scroll)
  window.addEventListener('wheel', handleScroll, { passive: true })
  handleScroll() // Initial opdatering
  
  // WASD keyboard controls
  handleKeyDown = (event) => {
    const key = event.key.toLowerCase()
    if (key === 'w') keys.w = true
    if (key === 'a') keys.a = true
    if (key === 's') keys.s = true
    if (key === 'd') keys.d = true
  }
  
  handleKeyUp = (event) => {
    const key = event.key.toLowerCase()
    if (key === 'w') keys.w = false
    if (key === 'a') keys.a = false
    if (key === 's') keys.s = false
    if (key === 'd') keys.d = false
  }
  
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  
  // Smooth interpolation funktion
  const lerp = (start, end, factor) => {
    return start + (end - start) * factor
  }
  
  // Opdater tekst baseret på scroll progress med fade effekt
  const updateScrollText = () => {
    if (scrollTexts.length === 0) {
      currentText.value = ''
      textOpacity.value = 0
      return
    }
    
    // Håndter fade animation
    const fadeSpeed = 0.05 // Hastighed for fade (højere = hurtigere)
    
    // Map scrollProgress (0-1) til tekst index
    // Vis kun tekst når scrollProgress er over 0.1 (når kameraet begynder at bevæge sig)
    if (scrollProgress < 0.1) {
      // Fade ud tekst når vi scroller tilbage til start
      if (currentText.value !== '') {
        if (!isScrollingBackToStart) {
          isScrollingBackToStart = true
          fadeState = 'out'
          fadeProgress = 0
        }
        // Fortsæt fade out animation
        fadeProgress += fadeSpeed
        textOpacity.value = Math.max(0, 1 - fadeProgress)
        // Fade ud billedet når vi scroller tilbage til start
        imageWipeProgress = Math.max(0, scrollProgress / 0.1)
        if (fadeProgress >= 1) {
          currentText.value = ''
          textOpacity.value = 0
          previousTextIndex = -1
          fadeState = 'pause'
          fadeProgress = 0
          isScrollingBackToStart = false
          // Billedet forbliver skjult når vi scroller tilbage før vandfarve-teksten
          imageWipeProgress = 0
        }
        return
      } else {
        currentText.value = ''
        textOpacity.value = 0
        previousTextIndex = -1
        fadeState = 'pause'
        fadeProgress = 0
        isScrollingBackToStart = false
        // Billedet forbliver skjult når vi scroller tilbage før vandfarve-teksten
        imageWipeProgress = 0
        return
      }
    } else {
      isScrollingBackToStart = false
    }
    
    // Del scroll range op i sektioner: tekst-pause-tekst-pause-...
    // Struktur: [tekst1][pause][tekst2][pause][tekst3]...
    const scrollRange = 1 - 0.1 // 0.9 total range
    const normalizedProgress = (scrollProgress - 0.1) / scrollRange // 0 til 1
    
    // Hver tekst får sin egen sektion med pause efter
    // Struktur: tekst (35%) + pause (65%)
    const totalSections = scrollTexts.length // Antal tekst-sektioner
    const sectionSize = 1 / totalSections // Størrelse af hver sektion
    
    // Find hvilken sektion vi er i
    const currentSection = Math.floor(normalizedProgress / sectionSize)
    const clampedIndex = Math.min(currentSection, scrollTexts.length - 1)
    
    // Beregn position inden for sektionen (0 til 1)
    let positionInSection = (normalizedProgress / sectionSize) % 1
    if (clampedIndex === scrollTexts.length - 1 && positionInSection === 0 && normalizedProgress > 0.99) {
      positionInSection = 1
    }
    
    // I hver sektion: først tekst, så pause
    // textSectionRatio bestemmer hvor meget af sektionen teksten optager
    const isInTextPart = positionInSection < textSectionRatio
    
    if (isInTextPart && clampedIndex < scrollTexts.length) {
      // Vi er i tekst-delen af sektionen
      const targetText = scrollTexts[clampedIndex]
      
      // Sørg altid for at teksten er sat korrekt når vi er i tekst-delen
      if (currentText.value !== targetText) {
        currentText.value = targetText
      }
      
      // Hvis teksten har ændret sig (ny sektion), start fade in
      if (clampedIndex !== previousTextIndex) {
        previousTextIndex = clampedIndex
        // Start fade in når vi kommer til ny tekst
        fadeState = 'in'
        fadeProgress = 0
      }
      
      // Hvis vi går fra pause til tekst, start fade in
      if (fadeState === 'pause' || fadeState === 'out') {
        fadeState = 'in'
        fadeProgress = 0
      }
      
      // Fade in animation
      if (fadeState === 'in') {
        fadeProgress += fadeSpeed
        textOpacity.value = Math.min(1, fadeProgress)
        
        // Animer gradient wipe på billedet baseret på scroll progress når tekst index 2 vises
        if (clampedIndex === 2) {
          // Brug positionInSection direkte for langsommere, scroll-baseret animation
          // Map positionInSection (0 til textSectionRatio) til wipe progress (0 til 1)
          // Brug hele textSectionRatio området for langsommere animation
          imageWipeProgress = Math.min(1, positionInSection / textSectionRatio)
        }
        
        if (fadeProgress >= 1) {
          textOpacity.value = 1
          fadeState = 'visible' // Hold tekst synlig
        }
      } else if (fadeState === 'visible') {
        // Hold teksten synlig mens vi er i tekst-delen
        textOpacity.value = 1
        // Opdater billedet baseret på scroll progress hvis det er vandfarve teksten
        if (clampedIndex === 2) {
          // Brug positionInSection direkte for langsommere, scroll-baseret animation
          // Brug hele textSectionRatio området for langsommere animation
          imageWipeProgress = Math.min(1, positionInSection / textSectionRatio)
        } else if (clampedIndex > 2) {
          // Når vi er forbi vandfarve teksten, hold billedet synligt
          imageWipeProgress = 1
        } else if (clampedIndex < 2) {
          // Hvis vi scroller tilbage før vandfarve-teksten, skjul billedet
          imageWipeProgress = 0
        }
      }
    } else {
      // Vi er i pause-delen af sektionen
      // Start fade out hvis vi har tekst og ikke allerede er i fade out
      if (fadeState !== 'pause' && fadeState !== 'out') {
        if (currentText.value !== '') {
          fadeState = 'out'
          fadeProgress = 0
        } else {
          fadeState = 'pause'
          textOpacity.value = 0
        }
      }
      
      // Fade out animation
      if (fadeState === 'out') {
        fadeProgress += fadeSpeed
        textOpacity.value = 1 - fadeProgress
        
        // Billedet forbliver synligt - vi animerer ikke fade out på billedet
        // imageWipeProgress forbliver på 1 når teksten forsvinder
        
        if (fadeProgress >= 1) {
          currentText.value = ''
          textOpacity.value = 0
          fadeState = 'pause'
          fadeProgress = 0
          // Billedet forbliver synligt (imageWipeProgress = 1)
        }
      } else if (fadeState === 'pause') {
        // Hold pause - ingen tekst
        textOpacity.value = 0
        if (currentText.value !== '') {
          currentText.value = ''
        }
        // Opdater billedet baseret på hvilken sektion vi er i
        if (clampedIndex === 2) {
          // Hvis vi er i pause efter vandfarve-teksten, fortsæt animationen lidt
          // positionInSection går fra textSectionRatio til 1 i pause-delen
          // Fortsæt animationen ind i pause-delen for mere scroll-tid
          const pauseProgress = (positionInSection - textSectionRatio) / (1 - textSectionRatio)
          imageWipeProgress = Math.min(1, 1.0 + pauseProgress * 0.3) // Fortsæt lidt ind i pause
        } else if (clampedIndex > 2) {
          // Hvis vi er efter vandfarve-teksten, hold billedet synligt
          imageWipeProgress = 1
        } else {
          // Hvis vi scroller tilbage før vandfarve-teksten, skjul billedet
          imageWipeProgress = 0
        }
      }
    }
  }
  
  // Animation loop
  const animate = () => {
    animationId = requestAnimationFrame(animate)
    
    // Smooth interpolation af scroll progress (lavere værdi = mere smooth)
    scrollProgress = lerp(scrollProgress, targetScrollProgress, 0.04)
    
    // Opdater kamera baseret på scroll
    updateCameraPosition()
    updatePencilLine()
    updateScrollText()
    
    // Opdater gradient wipe progress på billedet
    if (imagePlane && imagePlane.material && imagePlane.material.uniforms) {
      imagePlane.material.uniforms.uWipeProgress.value = imageWipeProgress
    }
    
    // Opdater flyvende specs
    if (particles && particleSystem) {
      const positions = particles.positions
      const velocities = particles.velocities
      
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3
        
        // Opdater position baseret på hastighed
        positions[i3] += velocities[i].x
        positions[i3 + 1] += velocities[i].y
        positions[i3 + 2] += velocities[i].z
        
        // Tilføj lidt tilfældig variation for organisk bevægelse
        velocities[i].x += (Math.random() - 0.5) * 0.0002
        velocities[i].y += (Math.random() - 0.5) * 0.0001
        velocities[i].z += (Math.random() - 0.5) * 0.0002
        
        // Begræns hastighed (meget langsom)
        velocities[i].x = Math.max(-0.008, Math.min(0.008, velocities[i].x))
        velocities[i].y = Math.max(-0.004, Math.min(0.004, velocities[i].y))
        velocities[i].z = Math.max(-0.008, Math.min(0.008, velocities[i].z))
        
        // Wrap partikler rundt hvis de går for langt væk (hele planens areal)
        if (positions[i3] > 25) positions[i3] = -25
        if (positions[i3] < -25) positions[i3] = 25
        if (positions[i3 + 1] > 3) positions[i3 + 1] = 0.5
        if (positions[i3 + 1] < 0.5) positions[i3 + 1] = 3
        if (positions[i3 + 2] > 25) positions[i3 + 2] = -25
        if (positions[i3 + 2] < -25) positions[i3 + 2] = 25
      }
      
      // Opdater geometri
      particles.geometry.attributes.position.needsUpdate = true
    }
    
    // WASD movement (kun hvis ikke scrollet)
    if (scrollProgress === 0) {
      const direction = new THREE.Vector3()
      const right = new THREE.Vector3()
      camera.getWorldDirection(direction)
      right.crossVectors(direction, camera.up).normalize()
      
      if (keys.w) {
        camera.position.addScaledVector(direction, moveSpeed)
      }
      if (keys.s) {
        camera.position.addScaledVector(direction, -moveSpeed)
      }
      // A og D bruges nu til rotation i stedet for side-bevægelse
    }
    
    renderer.render(scene, camera)
  }
  animate()
  
  // Håndter window resize
  handleResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (handleResize) {
    window.removeEventListener('resize', handleResize)
  }
  window.removeEventListener('wheel', handleScroll)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  if (pencilLineGroup) {
    // Ryd op i alle linjer i gruppen
    pencilLineGroup.children.forEach(child => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) child.material.dispose()
    })
    scene.remove(pencilLineGroup)
  }
  if (imagePlane) {
    if (imagePlane.geometry) imagePlane.geometry.dispose()
    if (imagePlane.material) {
      if (imagePlane.material.map) imagePlane.material.map.dispose()
      imagePlane.material.dispose()
    }
    scene.remove(imagePlane)
  }
  if (paperTexture) {
    paperTexture.dispose()
  }
  if (bumpTexture) {
    bumpTexture.dispose()
  }
  if (particleSystem) {
    particleSystem.geometry.dispose()
    particleSystem.material.dispose()
    scene.remove(particleSystem)
  }
  if (renderer) {
    renderer.dispose()
  }
})
</script>

<template>
  <div ref="containerRef" class="container">
    <img src="/logo/OldLogo.png" alt="Logo" class="logo" />
    <div v-if="currentText" class="scroll-text" :style="{ opacity: textOpacity }">{{ currentText }}</div>
  </div>
</template>

<style scoped>
.container {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  position: relative;
}

.logo {
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  max-height: 7rem;
  width: auto;
}

.scroll-text {
  position: absolute;
  bottom: 4rem;
  left: 4rem;
  z-index: 1000;
  font-size: 1.5rem;
  font-weight: 400;
  color: #000000;
  text-align: left;
  pointer-events: none;
  font-family: 'Boska-Regular', serif;
  letter-spacing: 0.02em;
  transition: opacity 0.1s ease-out;
  max-width: 30%;
}

</style>

