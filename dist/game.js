const B = window.BABYLON;
const $ = selector => document.querySelector(selector);

// ---------------- Color Palette & Themes ----------------
const colors = [0xff3366, 0x10b981, 0x2563eb, 0xf97316, 0x8b5cf6];
const colorNames = ['Strawberry', 'Lime', 'Blueberry', 'Orange', 'Grape'];
const boxCapacity = 4;
const visibleCansPerLane = 7;
const canSpacing = 0.96;

const themes = {
  bottles: { id: 'bottles', name: 'Bottles', icon: '🍾', title: 'Fresh Juice Bottles' },
  cans: { id: 'cans', name: 'Cans', icon: '🥤', title: 'Sleek Craft Cans' },
  boba: { id: 'boba', name: 'Boba', icon: '🧋', title: 'Boba Bubble Tea' }
};
let currentTheme = localStorage.getItem('bj-theme') || 'cans';

// ---------------- Engine & Scene Setup ----------------
const canvas = $('#scene');
const engine = new B.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));

const scene = new B.Scene(engine);
scene.useRightHandedSystem = true;
scene.clearColor = new B.Color4(0.46, 0.58, 0.72, 1.0);

const cameraTarget = new B.Vector3(0, 0, 0.20);
const cameraDirection = new B.Vector3(0, 21, 18).normalize();
const camera = new B.FreeCamera('game-camera', new B.Vector3(0, 15.5, 19), scene);
camera.setTarget(cameraTarget);
camera.mode = B.Camera.PERSPECTIVE_CAMERA;
camera.fov = 0.32;
camera.minZ = 0.1;
camera.maxZ = 120;

function color(value) {
  return typeof value === 'number' ? B.Color3.FromHexString('#' + value.toString(16).padStart(6, '0')) : value;
}
function mix(a, b, t) {
  return B.Color3.Lerp(color(a), color(b), t);
}

// ---------------- Lighting & Shadows ----------------
const hemi = new B.HemisphericLight('sky', new B.Vector3(0, 1, 0), scene);
hemi.diffuse = color(0xf8fafc);
hemi.groundColor = color(0x8fa3b8);
hemi.intensity = 0.62;

const sun = new B.DirectionalLight('sun', new B.Vector3(4, -10, -7), scene);
sun.position.set(-4, 10, 7);
sun.diffuse = color(0xfff5e7);
sun.intensity = 0.38;

const shadows = new B.ShadowGenerator(2048, sun);
shadows.usePercentageCloserFiltering = true;
shadows.filteringQuality = B.ShadowGenerator.QUALITY_MEDIUM;
shadows.bias = 0.003;
shadows.normalBias = 0.05;
shadows.setDarkness(0.30);

const fill = new B.DirectionalLight('fill', new B.Vector3(-6, -5, 4), scene);
fill.diffuse = color(0xd8e2ff);
fill.intensity = 0.20;

const pieceLight = new B.DirectionalLight('pieces', new B.Vector3(3.2, -4.5, -7.0), scene);
pieceLight.diffuse = color(0xfff8ee);
pieceLight.intensity = 0.45;

const world = new B.TransformNode('factory', scene);
const materials = new Map();
const geometries = new Map();

function mat(value, roughness = 0.30, metallic = 0.1, alpha = 1.0) {
  const c = color(value);
  const key = c.toHexString() + ':' + roughness + ':' + metallic + ':' + alpha;
  if (!materials.has(key)) {
    const m = new B.StandardMaterial(key, scene);
    m.diffuseColor = c;
    m.emissiveColor = c.scale(0.035);
    m.specularColor = new B.Color3(0.26 + metallic * 0.38, 0.26 + metallic * 0.38, 0.26 + metallic * 0.38);
    m.specularPower = 48 * (1 - roughness) + 12;
    m.backFaceCulling = alpha === 1.0;
    m.alpha = alpha;
    materials.set(key, m);
  }
  return materials.get(key);
}

function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
  const o = new B.Mesh('piece', scene);
  geometry.applyToMesh(o);
  o.material = material;
  o.parent = parent;
  o.position.set(x, y, z);
  o.receiveShadows = true;
  shadows.addShadowCaster(o);
  return o;
}

function roundedGeometry(w, h, d, r) {
  const key = [w, h, d, r].join(',');
  if (geometries.has(key)) return geometries.get(key);
  const positions = [], indices = [], uvs = [], normals = [], half = [w / 2, h / 2, d / 2];
  for (let axis = 0; axis < 3; axis++) {
    for (const sign of [-1, 1]) {
      const u = (axis + 1) % 3, v = (axis + 2) % 3, base = positions.length / 3, N = 8;
      for (let j = 0; j <= N; j++) {
        for (let i = 0; i <= N; i++) {
          const p = [0, 0, 0];
          p[axis] = sign * half[axis];
          p[u] = (i / N * 2 - 1) * half[u];
          p[v] = (j / N * 2 - 1) * half[v];
          const q = p.map((a, k) => Math.max(-half[k] + r, Math.min(half[k] - r, a)));
          const delta = p.map((a, k) => a - q[k]);
          const len = Math.hypot(...delta) || 1;
          positions.push(...q.map((a, k) => a + delta[k] / len * r));
          normals.push(...delta.map(a => a / len));
          uvs.push(i / N, j / N);
        }
      }
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const a = base + j * (N + 1) + i, b = a + 1, c = a + N + 1, e = c + 1;
          if (sign > 0) indices.push(a, c, b, b, c, e);
          else indices.push(a, b, c, b, e, c);
        }
      }
    }
  }
  const data = new B.VertexData();
  Object.assign(data, { positions, indices, normals, uvs });
  geometries.set(key, data);
  return data;
}

function cube(w, h, d, c, x = 0, y = 0, z = 0, parent = world, r = 0.08) {
  return mesh(roundedGeometry(w, h, d, Math.min(r, w / 2, h / 2, d / 2)), mat(c), parent, x, y, z);
}

const sphereGeo = B.VertexData.CreateSphere({ diameter: 2, segments: 16 });
function orb(r, c, x, y, z, parent) {
  const o = mesh(sphereGeo, mat(c), parent, x, y, z);
  o.scaling.setAll(r);
  shadows.removeShadowCaster(o);
  return o;
}

function cylinder(r, h, c, x, y, z, parent = world) {
  const key = `cylinder:${r}:${h}`;
  if (!geometries.has(key)) geometries.set(key, B.VertexData.CreateCylinder({ diameter: r * 2, height: h, tessellation: 32 }));
  return mesh(geometries.get(key), mat(c), parent, x, y, z);
}

function extract(o) {
  const data = B.VertexData.ExtractFromMesh(o);
  o.dispose();
  return data;
}

function torus(r, t, c, x, y, z, parent) {
  const key = `torus:${r}:${t}`;
  if (!geometries.has(key)) {
    const o = B.MeshBuilder.CreateTorus('template', { diameter: r * 2, thickness: t * 2, tessellation: 32 }, scene);
    o.rotation.x = Math.PI / 2;
    o.bakeCurrentTransformIntoVertices();
    geometries.set(key, extract(o));
  }
  return mesh(geometries.get(key), mat(c), parent, x, y, z);
}

// ---------------- Background Floor ----------------
const backdropTexture = new B.DynamicTexture('backdrop', { width: 512, height: 512 }, scene, false);
const backdropContext = backdropTexture.getContext();
const gradient = backdropContext.createRadialGradient(256, 240, 20, 256, 256, 360);
gradient.addColorStop(0, '#9db8d6');
gradient.addColorStop(0.55, '#7c99bc');
gradient.addColorStop(1, '#587498');
backdropContext.fillStyle = gradient;
backdropContext.fillRect(0, 0, 512, 512);
backdropTexture.update();

const backdropMaterial = new B.StandardMaterial('backdrop', scene);
backdropMaterial.emissiveTexture = backdropTexture;
backdropMaterial.disableLighting = true;
backdropMaterial.specularColor = B.Color3.Black();
backdropMaterial.backFaceCulling = false;
const backdropGeometry = B.VertexData.CreatePlane({ width: 70, height: 70 });

function screenPosition(p) {
  return B.Vector3.Project(p, B.Matrix.Identity(), scene.getTransformMatrix(), new B.Viewport(0, 0, innerWidth, innerHeight));
}

// ---------------- Procedural Flavor Icons & Textures ----------------
function drawFlavorIcon(ctx, cx, cy, colorIndex, s = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  if (colorIndex === 0) {
    // Cherry Fizz - Twin cherries
    ctx.strokeStyle = '#2b9348';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-11, 6);
    ctx.quadraticCurveTo(-2, -18, 11, -22);
    ctx.moveTo(13, 6);
    ctx.quadraticCurveTo(8, -14, 11, -22);
    ctx.stroke();

    ctx.fillStyle = '#55a630';
    ctx.beginPath();
    ctx.ellipse(17, -20, 9, 4.5, 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#d90429';
    ctx.beginPath();
    ctx.arc(-11, 7, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(-14, 3, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ef233c';
    ctx.beginPath();
    ctx.arc(12, 7, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(9, 3, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (colorIndex === 1) {
    // Lime Crush - Citrus lime slice
    ctx.fillStyle = '#2d6a4f';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 18.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#52b788';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * 16, Math.sin(angle) * 16);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (colorIndex === 2) {
    // Berry Wave - Blueberries & Crown
    ctx.fillStyle = '#1d3557';
    ctx.beginPath();
    ctx.arc(-9, 5, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#457b9d';
    ctx.beginPath();
    ctx.arc(10, 4, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(-12, 1, 3.5, 0, Math.PI * 2);
    ctx.arc(7, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d3557';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✦', 10, -5);
    ctx.fillText('✦', -9, -4);
  } else if (colorIndex === 3) {
    // Orange Pop - Sunny orange wheel
    ctx.fillStyle = '#f77f00';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 18.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fcbf49';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * 16, Math.sin(angle) * 16);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Grape Zest - Grape cluster
    ctx.fillStyle = '#7209b7';
    const spots = [[0, 12], [-7, 4], [7, 4], [-12, -4], [0, -4], [12, -4], [-6, -12], [6, -12]];
    for (const [gx, gy] of spots) {
      ctx.beginPath();
      ctx.arc(gx, gy, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(-7, 2, 2.2, 0, Math.PI * 2);
    ctx.arc(0, -6, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38b000';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.quadraticCurveTo(-3, -20, 2, -22);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------- ColaCan.fbx Mesh & Texture Loader ----------------
const [colaCanVertexData, colaCanBaseImage] = await Promise.all([
  fetch('cola-can.bin').then(r => r.arrayBuffer()).then(buf => {
    const view = new DataView(buf);
    const nv = view.getUint32(0, true);
    const ni = view.getUint32(4, true);
    let offset = 8;
    const positions = new Float32Array(buf, offset, nv * 3);
    offset += nv * 12;
    const normals = new Float32Array(buf, offset, nv * 3);
    offset += nv * 12;
    const uvs = new Float32Array(buf, offset, nv * 2);
    offset += nv * 8;
    const indices = new Uint16Array(buf, offset, ni);
    const vd = new B.VertexData();
    vd.positions = positions;
    vd.normals = normals;
    vd.uvs = uvs;
    vd.indices = indices;
    return vd;
  }),
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'cola-can-texture.png';
  })
]);

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const canMaterials = new Map();
function getCanMaterial(colorIndex) {
  if (canMaterials.has(colorIndex)) return canMaterials.get(colorIndex);

  // High-resolution 1024x1024 texture for ultra-sharp vectors, labels, and mipmapped crispness
  const width = 1024;
  const height = 1024;
  const tex = new B.DynamicTexture(`cola-can-tex-${colorIndex}`, { width, height }, scene, true, B.Texture.TRILINEAR_SAMPLINGMODE);
  tex.anisotropicFilteringLevel = 16;
  const ctx = tex.getContext();

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw base artwork in native orientation
  ctx.drawImage(colaCanBaseImage, 0, 0, width, height);

  // Exact quadrant recoloring matching ColaCan.fbx UV islands:
  // - Body (lower-left: x < 0.455 * W, y > 0.44 * H): Rich flavor color + brilliant white wave
  // - Top Lid (upper-right: x >= 0.455 * W, y < 0.54 * H): Colored outer rim + polished brushed aluminum face
  // - Pull-Tab (lower-right: x >= 0.455 * W, y >= 0.54 * H): Gleaming silver aluminum
  // - Bottom Dome (upper-left: x < 0.455 * W, y <= 0.44 * H): Sleek recessed aluminum
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const cHex = colors[colorIndex];
  const tr = ((cHex >> 16) & 255) / 255;
  const tg = ((cHex >> 8) & 255) / 255;
  const tb = (cHex & 255) / 255;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const brightness = Math.max(r, g, b);
    const darkest = Math.min(r, g, b);
    const sat = (brightness - darkest) / Math.max(brightness, 0.0001);

    const px = (i / 4) % width;
    const py = Math.floor((i / 4) / width);

    const isBody = px <= width * 0.47 && py >= height * 0.38;
    const isLid = px >= width * 0.44 && py < height * 0.55;

    if (isBody) {
      // Body cylinder: Pure brilliant white ribbon vs vibrant lacquer body
      const isWhiteRibbon = (1.0 - smoothstep(0.12, 0.28, sat)) * smoothstep(0.40, 0.80, brightness);

      // Deep, punchy cylindrical shading contrast
      const bodyShade = 0.26 + 0.74 * brightness;
      const cr = bodyShade * tr;
      const cg = bodyShade * tg;
      const cb = bodyShade * tb;

      // Pure brilliant white ribbon
      const wr = Math.min(1, brightness * 1.08);
      const wg = Math.min(1, brightness * 1.08);
      const wb = Math.min(1, brightness * 1.12);

      data[i] = Math.round((cr * (1 - isWhiteRibbon) + wr * isWhiteRibbon) * 255);
      data[i + 1] = Math.round((cg * (1 - isWhiteRibbon) + wg * isWhiteRibbon) * 255);
      data[i + 2] = Math.round((cb * (1 - isWhiteRibbon) + wb * isWhiteRibbon) * 255);
    } else if (isLid) {
      // Top lid: Outer circular rim gets body flavor color; inner face is polished silver aluminum
      const dx = px - width * 0.705;
      const dy = py - height * 0.285;
      const dist = Math.hypot(dx, dy);
      const isRim = dist > width * 0.22 && dist < width * 0.30;

      const silver = 0.58 + 0.42 * brightness;
      const rimShade = 0.38 + 0.62 * brightness;

      const outR = isRim ? rimShade * tr : silver;
      const outG = isRim ? rimShade * tg : silver * 1.02;
      const outB = isRim ? rimShade * tb : silver * 1.05;

      data[i] = Math.round(Math.min(1, outR) * 255);
      data[i + 1] = Math.round(Math.min(1, outG) * 255);
      data[i + 2] = Math.round(Math.min(1, outB) * 255);
    } else {
      // Pull-tab and bottom dome: Bright polished aluminum
      const silver = 0.56 + 0.44 * brightness;
      data[i] = Math.round(Math.min(1, silver) * 255);
      data[i + 1] = Math.round(Math.min(1, silver * 1.02) * 255);
      data[i + 2] = Math.round(Math.min(1, silver * 1.05) * 255);
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // Crisp metallic brand emblem on front of can body (px = 0.34 * width, py = 0.70 * height)
  const emblemX = width * 0.34;
  const emblemY = height * 0.70;

  ctx.save();
  ctx.translate(emblemX, emblemY);

  // Outer glossy white seal
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 54, 0, Math.PI * 2);
  ctx.fill();

  // Double-embossed gold foil rim
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 51, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#cca033';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, 46, 0, Math.PI * 2);
  ctx.stroke();

  // Upper glossy highlight crescent
  const grad = ctx.createLinearGradient(0, -46, 0, 46);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 44, 0, Math.PI);
  ctx.fill();

  // Crisp flavor fruit icon
  drawFlavorIcon(ctx, 0, 1.5, colorIndex, 1.65);

  ctx.restore();

  // Generate full trilinear anisotropic mipmaps with native vertical flip (invertY = true)
  tex.update(true, true);

  // Polished lacquer on metallic aluminum material
  const m = new B.StandardMaterial(`cola-can-mat-${colorIndex}`, scene);
  m.diffuseTexture = tex;
  m.specularColor = new B.Color3(0.92, 0.92, 0.96); // Bright glossy gleam
  m.specularPower = 96; // Sharp metallic highlight
  m.emissiveColor = new B.Color3(0.04, 0.04, 0.04);
  m.backFaceCulling = false;

  // Fresnel reflection glint on curved silhouette edges
  const fresnel = new B.FresnelParameters();
  fresnel.isEnabled = true;
  fresnel.bias = 0.12;
  fresnel.power = 2.4;
  fresnel.leftColor = new B.Color3(0.35, 0.38, 0.45);
  fresnel.rightColor = new B.Color3(0, 0, 0);
  m.reflectionFresnelParameters = fresnel;

  canMaterials.set(colorIndex, m);
  return m;
}

// Tape Texture
let tapeMaterial;
function getTapeMaterial() {
  if (tapeMaterial) return tapeMaterial;
  const tex = new B.DynamicTexture('tape-tex', { width: 256, height: 64 }, scene, false);
  const ctx = tex.getContext();
  ctx.fillStyle = '#ffe082';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.25)';
  ctx.lineWidth = 3;
  for (let i = -64; i < 320; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 64, 64);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(180, 83, 9, 0.65)';
  ctx.font = '900 16px "Arial Rounded MT Bold", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★ PACKED WITH LOVE ★', 128, 32);
  tex.update();

  tapeMaterial = new B.StandardMaterial('tape-mat', scene);
  tapeMaterial.diffuseTexture = tex;
  tapeMaterial.specularColor = new B.Color3(0.2, 0.2, 0.2);
  return tapeMaterial;
}

// ---------------- Bottle, Can & Boba 3D Mesh Builders ----------------
// Theme 1: Fresh Juice Bottles (Default)
const bottleProfile = [
  [0.17, 0.0],
  [0.21, 0.025],
  [0.222, 0.06],
  [0.222, 0.44],
  [0.21, 0.51],
  [0.165, 0.58],
  [0.115, 0.65],
  [0.108, 0.74],
  [0.118, 0.75],
  [0.118, 0.82],
  [0.09, 0.83]
];
const bottleGeometry = extract(B.MeshBuilder.CreateLathe('bottle-template', {
  shape: bottleProfile.map(([r, y]) => new B.Vector3(r, y, 0)),
  tessellation: 32,
  cap: B.Mesh.CAP_ALL
}, scene));

function createBottle(colorIndex) {
  const root = new B.TransformNode('bottle', scene);
  root.metadata = { color: colorIndex };
  const group = new B.TransformNode('bottle-model', scene);
  group.parent = root;
  group.scaling.y = 1.15;

  // Glossy glass / juice body
  mesh(bottleGeometry, mat(colors[colorIndex], 0.15, 0.25), group, 0, 0.02, 0);

  // Label white wrap band
  cylinder(0.224, 0.20, 0xffffff, 0, 0.26, 0, group);

  // Gold foil pinstripes
  torus(0.225, 0.005, 0xffd166, 0, 0.16, 0, group);
  torus(0.225, 0.005, 0xffd166, 0, 0.36, 0, group);

  // Twist cap with gold rim
  cylinder(0.120, 0.08, 0xfcfcfd, 0, 0.785, 0, group);
  torus(0.121, 0.006, 0xffd166, 0, 0.75, 0, group);

  pieceLight.includedOnlyMeshes.push(...group.getChildMeshes());
  return root;
}

// Theme 2: ColaCan.fbx Mesh with Applied & Tinted ColaCanTexture
function createCan(colorIndex) {
  const root = new B.TransformNode('can', scene);
  root.metadata = { color: colorIndex };
  const group = new B.TransformNode('can-model', scene);
  group.parent = root;

  const canMesh = mesh(colaCanVertexData, getCanMaterial(colorIndex), group, 0, 0, 0);
  canMesh.scaling.set(1.10, 1.34, 1.10);

  pieceLight.includedOnlyMeshes.push(canMesh);
  return root;
}

// Theme 3: Boba / Bubble Tea Cups (Upgraded Clear Frosted Cup & Boba Pearls)
const bobaDrinkColors = [0xff6584, 0x38b000, 0x38bdf8, 0xffb703, 0xb5838d]; // Creamy strawberry, matcha, blue butterfly pea, mango, taro

function createBoba(colorIndex) {
  const root = new B.TransformNode('boba', scene);
  root.metadata = { color: colorIndex };
  const group = new B.TransformNode('boba-model', scene);
  group.parent = root;
  group.scaling.y = 1.25;

  // 1. Clear Translucent Outer Cup (smooth glass/PET)
  const cupKey = 'boba-cup-outer';
  if (!geometries.has(cupKey)) {
    geometries.set(cupKey, B.VertexData.CreateCylinder({ diameterTop: 0.46, diameterBottom: 0.33, height: 0.62, tessellation: 36 }));
  }
  mesh(geometries.get(cupKey), mat(0xf0f7ff, 0.08, 0.4, 0.32), group, 0, 0.31, 0);

  // Rolled lip rim of cup
  torus(0.23, 0.011, 0xffffff, 0, 0.62, 0, group);

  // 2. Creamy Milk Tea Liquid inside
  const liquidKey = 'boba-liquid';
  if (!geometries.has(liquidKey)) {
    geometries.set(liquidKey, B.VertexData.CreateCylinder({ diameterTop: 0.435, diameterBottom: 0.315, height: 0.54, tessellation: 32 }));
  }
  mesh(geometries.get(liquidKey), mat(bobaDrinkColors[colorIndex], 0.22, 0.05), group, 0, 0.27, 0);

  // 3. Thick Cream / Cheese Foam Layer on top
  cylinder(0.216, 0.045, 0xfffdf2, 0, 0.525, 0, group);

  // 4. Abundant Glistening Tapioca Pearls (Boba) clustered at bottom
  const pearlMat = mat(0x160c08, 0.08, 0.7);
  const pearlOffsets = [
    [0, 0.045, 0],
    [-0.065, 0.045, -0.05],
    [0.065, 0.045, -0.05],
    [0, 0.045, 0.065],
    [-0.05, 0.055, 0.045],
    [0.05, 0.055, 0.045],
    [-0.075, 0.065, 0],
    [0.075, 0.065, 0],
    [-0.035, 0.085, -0.035],
    [0.035, 0.085, -0.035],
    [0, 0.09, 0.04]
  ];
  for (const [px, py, pz] of pearlOffsets) {
    const pearl = orb(0.034, 0x160c08, px, py, pz, group);
    pearl.material = pearlMat;
  }

  // 5. Floating Rounded Ice Cubes
  const iceMat = mat(0xffffff, 0.05, 0.5, 0.58);
  const ice1 = cube(0.075, 0.070, 0.075, 0xffffff, -0.06, 0.47, 0.03, group, 0.015);
  ice1.material = iceMat;
  ice1.rotation.y = 0.4;
  const ice2 = cube(0.068, 0.075, 0.068, 0xffffff, 0.055, 0.48, -0.035, group, 0.015);
  ice2.material = iceMat;
  ice2.rotation.y = -0.5;

  // 6. Frosted Dome Lid
  const domeKey = 'boba-dome';
  if (!geometries.has(domeKey)) {
    geometries.set(domeKey, B.VertexData.CreateSphere({ diameter: 0.46, slice: 0.5, segments: 24 }));
  }
  const dome = mesh(geometries.get(domeKey), mat(0xffffff, 0.12, 0.3, 0.42), group, 0, 0.62, 0);
  dome.rotation.x = Math.PI;

  // 7. Thick Angled Boba Straw poking through the dome
  const straw = cylinder(0.027, 0.36, colors[colorIndex], 0.035, 0.70, 0, group);
  straw.rotation.z = -0.22;
  straw.rotation.x = 0.08;
  const strawRing = cylinder(0.029, 0.04, 0xffffff, 0.035, 0.74, 0, group);
  strawRing.rotation.z = -0.22;
  strawRing.rotation.x = 0.08;

  pieceLight.includedOnlyMeshes.push(...group.getChildMeshes());
  return root;
}

function createDrink(colorIndex) {
  if (currentTheme === 'cans') return createCan(colorIndex);
  if (currentTheme === 'boba') return createBoba(colorIndex);
  return createBottle(colorIndex); // default: 'bottles'
}
function can(colorIndex) {
  return createDrink(colorIndex);
}

function roundRectPath(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

function badge(colorIndex, text) {
  const texture = new B.DynamicTexture('count', { width: 256, height: 128 }, scene, false);
  texture.hasAlpha = true;
  const ctx = texture.getContext();

  function redraw(val) {
    ctx.clearRect(0, 0, 256, 128);
    // Rounded pill background
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    roundRectPath(ctx, 14, 18, 228, 92, 46);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#' + colors[colorIndex].toString(16).padStart(6, '0');
    ctx.lineWidth = 4;
    ctx.beginPath();
    roundRectPath(ctx, 16, 20, 224, 88, 44);
    ctx.stroke();

    // Flavor mini icon
    drawFlavorIcon(ctx, 68, 64, colorIndex, 0.72);

    // Text count
    ctx.font = '900 48px "Arial Rounded MT Bold", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#244b75';
    ctx.fillText(val, 154, 65);
    texture.update();
  }

  redraw(text);
  const material = new B.StandardMaterial('badge-mat', scene);
  material.diffuseTexture = texture;
  material.emissiveColor = B.Color3.White();
  material.disableLighting = true;
  material.useAlphaFromDiffuseTexture = true;
  material.backFaceCulling = false;
  return { texture, material, redraw };
}

function carton(colorIndex) {
  const group = new B.TransformNode('group', scene);
  const c = colors[colorIndex];
  group.metadata = { color: colorIndex };
  const inside = mix(c, 0x64596f, 0.26);

  cube(1.10, 0.10, 1.10, c, 0, 0.07, 0, group);
  cube(1.10, 0.68, 0.14, c, 0, 0.46, 0.48, group, 0.065);
  cube(1.10, 0.68, 0.14, c, 0, 0.46, -0.48, group, 0.065);
  cube(0.14, 0.68, 0.96, c, -0.48, 0.46, 0, group, 0.065);
  cube(0.14, 0.68, 0.96, c, 0.48, 0.46, 0, group, 0.065);
  cube(0.90, 0.02, 0.90, inside, 0, 0.13, 0, group);

  const flaps = [];
  for (const side of [-1, 1]) {
    const hinge = new B.TransformNode('side-flap', scene);
    hinge.position.set(side * 0.50, 0.80, 0);
    hinge.parent = group;
    cube(0.50, 0.045, 0.99, c, side * 0.25, 0, 0, hinge, 0.018);
    hinge.rotation.z = -side * 1.12;
    flaps.push({ hinge, axis: 'z', open: -side * 1.12, closed: side * Math.PI, delay: 0 });
  }
  for (const side of [-1, 1]) {
    const hinge = new B.TransformNode('lid-flap', scene);
    hinge.position.set(0, side < 0 ? 0.825 : 0.84, side * 0.50);
    hinge.parent = group;
    cube(1.05, 0.045, 0.52, c, 0, 0, side * 0.26, hinge, 0.018);
    hinge.rotation.x = side * 1.25;
    flaps.push({ hinge, axis: 'x', open: side * 1.25, closed: -side * Math.PI, delay: 0.10 });
  }

  const tapeMesh = mesh(roundedGeometry(0.18, 0.020, 1.05, 0.008), getTapeMaterial(), group, 0, 0.875, 0);
  tapeMesh.setEnabled(false);
  group.metadata.flaps = flaps;
  group.metadata.tape = tapeMesh;

  const counter = badge(colorIndex, '0 / 4');
  if (!geometries.has('badge')) geometries.set('badge', B.VertexData.CreatePlane({ width: 0.44, height: 0.22 }));
  const countLabel = mesh(geometries.get('badge'), counter.material, group, 0, 0.46, 0.568);
  shadows.removeShadowCaster(countLabel);
  group.metadata.badge = counter;

  pieceLight.includedOnlyMeshes.push(...group.getChildMeshes());
  return group;
}

// ---------------- Sound Engine (Zero-Dependency Web Audio) ----------------
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.soundOn = localStorage.getItem('bj-sound') !== 'off';
    this.musicOn = localStorage.getItem('bj-music') === 'on';
    this.bgmTimer = null;
    this.bgmStep = 0;
  }
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.musicOn && !this.bgmTimer) {
      this.startBgm();
    }
  }
  playCanLand(count) {
    if (!this.soundOn) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const scale = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const freq = scale[Math.min(count - 1, 3)] || 523.25;

    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq * 1.3, now);
    osc1.frequency.exponentialRampToValueAtTime(freq, now + 0.02);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.22);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2.76, now);
    gain2.gain.setValueAtTime(0.04, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.08);
  }
  playBoxSend() {
    if (!this.soundOn) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.14);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }
  playFlapClose() {
    if (!this.soundOn) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.09);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.10);
  }
  playTapeZip() {
    if (!this.soundOn) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.frequency.exponentialRampToValueAtTime(4200, now + 0.12);
    filter.Q.value = 4.0;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }
  playBoxPacked(combo = 1) {
    if (!this.soundOn) return;
    this.init();
    if (!this.ctx) return;
    const semitone = Math.pow(2, Math.min(combo - 1, 4) * 2 / 12);
    const chord = [523.25, 659.25, 783.99, 1046.50].map(f => f * semitone);
    chord.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.10, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      }, idx * 50);
    });
  }
  playCoin() {
    if (!this.soundOn) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [987.77, 1318.51].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.05);
      gain.gain.setValueAtTime(0.08, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.20);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.20);
    });
  }
  playWarning() {
    if (!this.soundOn) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [240, 205].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.11);
      gain.gain.setValueAtTime(0.12, now + i * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.11);
      osc.stop(now + i * 0.11 + 0.18);
    });
  }
  playBooster(type) {
    if (!this.soundOn) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (type === 'undo') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.2);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'shuffle') {
      [400, 520, 680, 840].forEach((f, i) => {
        setTimeout(() => {
          if (!this.ctx) return;
          const t = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, t);
          gain.gain.setValueAtTime(0.09, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(t);
          osc.stop(t + 0.15);
        }, i * 35);
      });
    } else {
      [523.25, 659.25, 783.99, 987.77, 1046.50].forEach((f, i) => {
        setTimeout(() => {
          if (!this.ctx) return;
          const t = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, t);
          gain.gain.setValueAtTime(0.10, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(t);
          osc.stop(t + 0.28);
        }, i * 60);
      });
    }
  }
  playVictory() {
    if (!this.soundOn) return;
    this.init();
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
    notes.forEach((f, i) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.45);
      }, i * 70);
    });
  }
  startBgm() {
    if (this.bgmTimer) return;
    const chords = [
      [349.23, 440.00, 523.25, 659.25], // Fmaj7
      [392.00, 493.88, 587.33, 698.46], // G
      [329.63, 392.00, 493.88, 587.33], // Em7
      [220.00, 261.63, 329.63, 392.00]  // Am7
    ];
    this.bgmTimer = setInterval(() => {
      if (!this.musicOn || !this.ctx) return;
      const chord = chords[this.bgmStep % chords.length];
      this.bgmStep++;
      const now = this.ctx.currentTime;
      chord.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.02, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 1.9);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 1.9);
      });
    }, 2200);
  }
  stopBgm() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}
const soundEngine = new SoundEngine();

// Vibration / Haptics
let vibrationOn = localStorage.getItem('bj-vibrate') !== 'off';
function haptic(pattern) {
  if (vibrationOn && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch { /* ignore */ }
  }
}

// ---------------- Game State ----------------
let level = Number(localStorage.getItem('bj-level')) || 1;
let coins = Number(localStorage.getItem('bj-coins')) || 100;
let lanes = [], boxes = [], waiting = [], flights = [], particles = [], slots = [];
let packed = 0, total = 0, paused = false, ended = false, slotMax = 4;
let boosts = { undo: 3, shuffle: 3, extra: 1 };
let lastTime = 0, tick = 0, jamAcknowledged = false;
let lastPackTime = 0, combo = 0, boostersUsedThisLevel = 0;
let lastActionTime = performance.now();

function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
}

function pulse(element, amount = 1.15) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !element) return;
  element.animate([{ transform: 'scale(1)' }, { transform: `scale(${amount})`, offset: 0.35 }, { transform: 'scale(1)' }], { duration: 240, easing: 'ease-out' });
}

function slotX(i) {
  return (i - (slotMax - 1) / 2) * 1.738;
}
function queueColumns() {
  return Math.min(4, lanes.length);
}
function queueX(i) {
  return slotX(i + (slotMax - queueColumns()) / 2);
}

// ---------------- Solvable Puzzle Generator ----------------
function generateSolvableLevel(lvl) {
  const numLanes = Math.min(5, 2 + Math.floor((lvl - 1) / 3));
  const numColors = Math.min(5, Math.min(numLanes + 1, 2 + Math.floor((lvl - 1) / 2)));
  const boxesPerColor = Math.max(2, Math.min(4, 2 + Math.floor(lvl / 4)));
  const totalBoxes = numColors * boxesPerColor;
  const cansTotal = totalBoxes * boxCapacity;
  const targetPerLane = Math.ceil(cansTotal / numLanes);

  const boxColors = [];
  for (let c = 0; c < numColors; c++) {
    for (let b = 0; b < boxesPerColor; b++) {
      boxColors.push(c);
    }
  }
  // Shuffle box colors
  for (let i = boxColors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [boxColors[i], boxColors[j]] = [boxColors[j], boxColors[i]];
  }

  // Reverse simulation to ensure guaranteed solvability
  const laneCans = Array.from({ length: numLanes }, () => []);
  const reverseWaiting = [];
  const boxQueue = [];
  const boxesToProcess = boxColors.map((clr, id) => ({ color: clr, id, cansLeft: boxCapacity }));

  while (boxesToProcess.length > 0 || reverseWaiting.length > 0) {
    while (reverseWaiting.length < 3 && boxesToProcess.length > 0) {
      reverseWaiting.push(boxesToProcess.pop());
    }
    if (reverseWaiting.length === 0) break;

    const randIdx = Math.floor(Math.random() * reverseWaiting.length);
    const box = reverseWaiting[randIdx];

    const eligibleLanes = [];
    for (let l = 0; l < numLanes; l++) {
      if (laneCans[l].length < targetPerLane) eligibleLanes.push(l);
    }
    const chosenLane = eligibleLanes.length > 0
      ? eligibleLanes[Math.floor(Math.random() * eligibleLanes.length)]
      : Math.floor(Math.random() * numLanes);

    laneCans[chosenLane].unshift(box.color);
    box.cansLeft--;

    if (box.cansLeft === 0) {
      reverseWaiting.splice(randIdx, 1);
      boxQueue.unshift(box.color);
    }
  }

  const numColumns = Math.min(4, numLanes);
  const queueBoxes = boxQueue.map((clr, idx) => ({
    color: clr,
    id: idx,
    column: idx % numColumns
  }));

  return { numLanes, totalBoxes, cansTotal, laneCans, queueBoxes };
}

// ---------------- Start / Restart Level ----------------
function start() {
  boxes.forEach(b => {
    b.mesh.metadata.badge.texture.dispose();
    b.mesh.metadata.badge.material.dispose();
  });
  world.getChildren().forEach(node => node.dispose(false, false));
  pieceLight.includedOnlyMeshes = [];

  lanes = [];
  boxes = [];
  waiting = [];
  flights = [];
  particles = [];
  slots = [];
  packed = 0;
  slotMax = 4;
  boosts = { undo: 3, shuffle: 3, extra: 1 };
  boostersUsedThisLevel = 0;
  ended = false;
  paused = false;
  tick = 0;
  jamAcknowledged = false;
  lastPackTime = 0;
  combo = 0;
  lastActionTime = performance.now();

  $('#modal').classList.add('hidden');
  $('#hint').textContent = 'Tap an open box to pack matching cans!';

  const puzzle = generateSolvableLevel(level);
  total = puzzle.cansTotal;

  // Floor
  const floor = mesh(backdropGeometry, backdropMaterial, world, 0, -0.52, -0.5);
  floor.rotation.x = -Math.PI / 2;
  shadows.removeShadowCaster(floor);

  // Lanes & Conveyors (Scaled 25% smaller for balanced sleek proportions)
  for (let l = 0; l < puzzle.numLanes; l++) {
    const x = (l - (puzzle.numLanes - 1) / 2) * 1.17;

    // Support footings / cross-braces
    cube(1.14, 0.14, 0.17, 0x223246, x, -0.05, 0.35, world, 0.025);
    cube(1.14, 0.14, 0.17, 0x223246, x, -0.05, -3.00, world, 0.025);
    cube(1.14, 0.14, 0.17, 0x223246, x, -0.05, -5.80, world, 0.025);

    // Bed frame - length 7.45, width 1.08, height 0.11
    cube(1.08, 0.11, 7.45, 0x364860, x, 0.07, -3.00, world, 0.035);

    // Rollers / Ribs (30 industrial rollers from z = -5.98 to +0.69)
    const rollers = [];
    for (let j = 0; j < 30; j++) {
      const roller = cube(1.00, 0.024, 0.040, 0x486082, x, 0.13, -5.98 + j * 0.23, world, 0.01);
      rollers.push(roller);
    }

    // Dual-tier side rails
    const railOffset = 0.54;
    cube(0.038, 0.11, 7.50, 0x56779c, x - railOffset, 0.15, -3.00, world, 0.016);
    cube(0.038, 0.11, 7.50, 0x56779c, x + railOffset, 0.15, -3.00, world, 0.016);
    cube(0.048, 0.034, 7.52, 0x98bfe8, x - railOffset, 0.21, -3.00, world, 0.013);
    cube(0.048, 0.034, 7.52, 0x98bfe8, x + railOffset, 0.21, -3.00, world, 0.013);

    // Factory chute portal (scaled to 1.18 width)
    cube(1.18, 0.18, 1.15, 0x5e85b4, x, 1.16, -6.15, world, 0.045);
    cube(0.14, 0.96, 1.15, 0x5077a5, x - 0.53, 0.58, -6.15, world, 0.022);
    cube(0.14, 0.96, 1.15, 0x5077a5, x + 0.53, 0.58, -6.15, world, 0.022);
    cube(1.18, 0.96, 0.08, 0x1a2d42, x, 0.58, -6.72, world, 0.022);
    cube(1.02, 0.10, 0.06, 0x8ab2dc, x, 1.06, -5.55, world, 0.018);

    // Chute LED Indicator
    const indicator = orb(0.032, 0x22c55e, x + 0.39, 1.16, -5.53, world);
    shadows.removeShadowCaster(indicator);

    // Create 7 spacious visible cans / drinks per lane
    const laneCanList = puzzle.laneCans[l];
    const cansArr = [];
    for (let j = 0; j < laneCanList.length; j++) {
      const clr = laneCanList[j];
      const obj = can(clr);
      obj.position.set(x, 0.15, 0.40 - j * canSpacing);
      obj.setEnabled(j < visibleCansPerLane);
      obj.parent = world;
      cansArr.push({ color: clr, mesh: obj, visible: j < visibleCansPerLane });
    }

    lanes.push({ x, cans: cansArr, rollers, indicator, beltSpeed: 0 });
  }

  // Create queue boxes
  for (let i = 0; i < puzzle.queueBoxes.length; i++) {
    const qb = puzzle.queueBoxes[i];
    const obj = carton(qb.color);
    obj.parent = world;
    boxes.push({
      color: qb.color,
      mesh: obj,
      count: 0,
      reserved: 0,
      id: qb.id,
      column: qb.column,
      queueVisible: true,
      status: 'queue',
      bounce: 0,
      shake: 0
    });
  }

  // Front shelf divider
  cube(40, 0.10, 6.3, 0x6c90b8, 0, -0.23, 6.70, world, 0.045);
  cube(40, 0.055, 0.12, 0xbcd3ec, 0, -0.12, 3.55, world, 0.025);
  cube(40, 0.055, 0.10, 0x55779e, 0, -0.12, 4.974, world, 0.025);

  makeSlots();
  layoutQueue(true);
  update();
  resize();
}

function makeSlots() {
  slots.forEach(object => object.dispose(false, false));
  slots = [];
  for (let i = 0; i < slotMax; i++) {
    // Outer bevel tray
    slots.push(cube(1.16, 0.04, 1.10, 0xc8dcf0, slotX(i), -0.025, 2.20, world, 0.045));
    // Inner floor
    slots.push(cube(1.02, 0.026, 0.96, 0x527196, slotX(i), 0.003, 2.20, world, 0.024));
  }
}

const visibleBoxRows = 3;
const boxQueueStart = 4.05;
const boxRowSpacing = 1.848;

function queuedColumn(column) {
  return boxes.filter(b => b.status === 'queue' && b.column === column);
}

function layoutQueue(instant = false) {
  for (let column = 0; column < queueColumns(); column++) {
    queuedColumn(column).forEach((b, row) => {
      b.target = new B.Vector3(queueX(column), 0.015, boxQueueStart + row * boxRowSpacing);
      b.wantsOpen = row === 0;
      if (instant || !b.wantsOpen) {
        b.openAmount = b.wantsOpen ? 1 : 0;
        b.openTime = 0;
        poseQueuedFlaps(b);
      }
      const visible = row < visibleBoxRows;
      if (instant) b.mesh.position.copyFrom(b.target);
      else if (visible && !b.queueVisible) b.mesh.position.set(queueX(column), 0.015, boxQueueStart + visibleBoxRows * boxRowSpacing);
      b.mesh.setEnabled(visible);
      b.queueVisible = visible;
    });
  }
  rebuildControls();
}

function poseQueuedFlaps(box) {
  for (const flap of box.mesh.metadata.flaps) {
    const progress = B.Scalar.Clamp(((box.openAmount || 0) - (flap.axis === 'z' ? 0.22 : 0)) / 0.78, 0, 1);
    const ease = progress * progress * (3 - 2 * progress);
    flap.hinge.rotation[flap.axis] = B.Scalar.Lerp(flap.closed, flap.open, ease);
  }
}

// ---------------- DOM Controls & Direct 3D Pointer Picking ----------------
function rebuildControls() {
  const root = $('#box-controls');
  root.replaceChildren();
  for (let column = 0; column < queueColumns(); column++) {
    const b = queuedColumn(column)[0];
    if (!b) continue;
    const button = document.createElement('button');
    button.className = 'box-hit';
    button.setAttribute('aria-label', `Pack ${colorNames[b.color]} box`);
    button.dataset.id = b.id;
    button.onclick = () => sendBox(b);
    root.append(button);
  }
  positionControls();
}

function positionControls() {
  const span = camera.orthoTop - camera.orthoBottom;
  const scale = innerHeight / span;
  document.querySelectorAll('.box-hit').forEach(button => {
    const box = boxes.find(b => b.id == button.dataset.id);
    if (!box) return;
    button.disabled = (box.openAmount || 0) < 0.95;
    const p = screenPosition(box.mesh.position.add(new B.Vector3(0, 0.40, 0)));
    button.style.left = `${p.x - scale * 0.65}px`;
    button.style.top = `${p.y - scale * 0.48}px`;
    button.style.width = `${scale * 1.3}px`;
    button.style.height = `${scale * 1.1}px`;
  });
}

function findBoxByMesh(meshObj) {
  if (!meshObj) return null;
  return boxes.find(b => b.mesh === meshObj || meshObj.isDescendantOf(b.mesh));
}

scene.onPointerObservable.add(pointerInfo => {
  if (paused || ended) return;
  const type = pointerInfo.type;

  if (type === B.PointerEventTypes.POINTERMOVE) {
    const pick = scene.pick(scene.pointerX, scene.pointerY);
    let isHover = false;
    if (pick.hit && pick.pickedMesh) {
      const box = findBoxByMesh(pick.pickedMesh);
      if (box && box.status === 'queue' && box.wantsOpen && (box.openAmount || 0) >= 0.95) {
        isHover = true;
      } else if (box && box.status === 'waiting' && box.reserved === 0 && !box.move) {
        isHover = true;
      }
    }
    $('#scene').style.cursor = isHover ? 'pointer' : 'default';
  } else if (type === B.PointerEventTypes.POINTERDOWN) {
    const pick = scene.pick(scene.pointerX, scene.pointerY);
    if (pick.hit && pick.pickedMesh) {
      const box = findBoxByMesh(pick.pickedMesh);
      if (box) {
        if (box.status === 'queue' && box.wantsOpen && (box.openAmount || 0) >= 0.95) {
          sendBox(box);
        } else if (box.status === 'waiting' && box.reserved === 0 && !box.move) {
          returnWaitingBox(box);
        }
      }
    }
  }
});

function sendBox(box) {
  lastActionTime = performance.now();
  if (paused || ended || box.status !== 'queue' || (box.openAmount || 0) < 0.95) return;

  if (waiting.length >= slotMax) {
    box.shake = 1;
    soundEngine.playWarning();
    haptic([40, 50, 40]);
    toast('Waiting slots are full! Use a booster or free up a slot.');
    pulse($('#slots-pill'), 1.2);
    return;
  }

  const slot = Array.from({ length: slotMax }, (_, i) => i).find(i => !waiting.some(b => b.slot === i));
  jamAcknowledged = false;
  box.slot = slot;
  box.status = 'waiting';
  box.bounce = 1;
  box.target = new B.Vector3(slotX(slot), 0.07, 2.20);
  box.move = { from: box.mesh.position.clone(), to: box.target.clone(), t: 0 };
  waiting.push(box);

  layoutQueue();
  soundEngine.playBoxSend();
  haptic(15);
  $('#hint').textContent = '';
  update();
  tick = 0.5;
}

function returnWaitingBox(box) {
  if (box.reserved > 0 || box.move || paused || ended) return;
  lastActionTime = performance.now();
  waiting = waiting.filter(b => b !== box);
  box.status = 'queue';
  boxes.splice(boxes.indexOf(box), 1);
  boxes.unshift(box);
  layoutQueue();
  update();
  soundEngine.playBooster('undo');
  haptic(15);
  toast('Returned to shelf!');
}

// ---------------- Packing & Match Checking ----------------
function pack() {
  if (ended) return;
  for (const lane of lanes) {
    const front = lane.cans[0];
    if (!front) continue;
    const box = waiting.find(b => b.color === front.color && b.reserved < boxCapacity && !b.move);
    if (!box) continue;

    lane.cans.shift();
    const index = box.reserved++;
    flights.push({ mesh: front.mesh, from: front.mesh.position.clone(), to: new B.Vector3(), t: 0, index, box, color: front.color });

    lane.cans.forEach((canItem, j) => {
      canItem.target = new B.Vector3(lane.x, 0.15, 0.40 - j * canSpacing);
      const visible = j < visibleCansPerLane;
      if (visible && !canItem.visible) {
        canItem.mesh.position.set(lane.x, 0.15, -6.10);
        // Pulse LED green
        lane.indicator.material = mat(0x00ff88);
        setTimeout(() => { lane.indicator.material = mat(0x22c55e); }, 220);
      }
      canItem.visible = visible;
      canItem.mesh.setEnabled(visible);
    });
  }
  checkLoss();
}

function checkLoss() {
  if (!jamAcknowledged && waiting.length === slotMax && !flights.length && !waiting.some(b => b.reserved === boxCapacity) &&
    !lanes.some(l => l.cans[0] && waiting.some(b => b.color === l.cans[0].color && b.reserved < boxCapacity))) {
    ended = true;
    jamAcknowledged = true;
    soundEngine.playWarning();
    haptic([60, 60, 60]);

    modal('Conveyors Jammed!', 'All packing slots are full. Use a booster to keep the flow going, or restart the level.', '📦', [
      ['Use Booster', () => { ended = false; closeModal(); }],
      ['Restart Level', start]
    ]);
  }
}

// ---------------- UI & HUD Update ----------------
function update() {
  $('#level').textContent = level;
  $('#coins').textContent = coins;
  $('#counter').textContent = `${packed} / ${total} cans packed`;
  $('#progress').style.width = `${(packed / total) * 100}%`;
  $('.progress-track').setAttribute('aria-valuenow', Math.round((packed / total) * 100));

  $('#slots-count').textContent = `${waiting.length} / ${slotMax}`;
  const pill = $('#slots-pill');
  if (waiting.length >= slotMax) {
    pill.className = 'slot-pill danger';
  } else if (waiting.length >= slotMax - 1) {
    pill.className = 'slot-pill warning';
  } else {
    pill.className = 'slot-pill';
  }

  // Booster buttons with coin-purchase support
  const boosterCosts = { undo: 25, shuffle: 35, extra: 50 };
  for (const key of ['undo', 'shuffle', 'extra']) {
    const countEl = $(`#${key}-count`);
    const btn = $(`#${key}`);
    if (boosts[key] > 0) {
      countEl.textContent = boosts[key];
      countEl.classList.remove('buy-cost');
      btn.disabled = false;
    } else {
      const cost = boosterCosts[key];
      if (coins >= cost) {
        countEl.textContent = `🪙${cost}`;
        countEl.classList.add('buy-cost');
        btn.disabled = false;
      } else {
        countEl.textContent = '0';
        countEl.classList.remove('buy-cost');
        btn.disabled = true;
      }
    }
  }

  localStorage.setItem('bj-coins', coins);
}

function updateBoxBadge(box) {
  box.mesh.metadata.badge.redraw(`${box.count} / ${boxCapacity}`);
}

// ---------------- Particles & Floating Text ----------------
function burstConfetti(position, colorIndex = 0, count = 22) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const palette = [colors[colorIndex], 0xffffff, 0xffbe0b, 0x38bdf8, 0x4ade80];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const speed = 0.8 + Math.random() * 1.4;
    const clr = palette[Math.floor(Math.random() * palette.length)];
    const pMesh = cube(0.065, 0.040, 0.065, clr, position.x, position.y + 0.65, position.z, world, 0.015);
    shadows.removeShadowCaster(pMesh);
    particles.push({
      mesh: pMesh,
      v: new B.Vector3(Math.cos(angle) * speed, 1.6 + Math.random() * 1.2, Math.sin(angle) * speed),
      rot: new B.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
      life: 0.65
    });
  }
}

function spawnFloatingText(pos3D, text, isCombo = false) {
  const p = screenPosition(pos3D.add(new B.Vector3(0, 0.8, 0)));
  const container = $('#floating-fx');
  const elem = document.createElement('div');
  elem.className = isCombo ? 'floating-text combo' : 'floating-text';
  elem.textContent = text;
  elem.style.left = `${p.x}px`;
  elem.style.top = `${p.y}px`;
  container.append(elem);
  setTimeout(() => elem.remove(), 1100);
}

// ---------------- Modal Dialogs ----------------
function modal(title, text, icon, actions, stars = 0) {
  paused = true;
  $('#modal-title').textContent = title;
  $('#modal-text').textContent = text;
  $('#modal-icon').textContent = icon;
  $('#modal-actions').replaceChildren();

  const starsContainer = $('#modal-stars');
  if (stars > 0) {
    starsContainer.style.display = 'flex';
    for (let s = 1; s <= 3; s++) {
      const starEl = $(`#star-${s}`);
      starEl.classList.remove('active');
      if (s <= stars) {
        setTimeout(() => {
          starEl.classList.add('active');
          soundEngine.playCanLand(s + 1);
        }, s * 220);
      }
    }
  } else {
    starsContainer.style.display = 'none';
  }

  actions.forEach(([label, action, cls]) => {
    const button = document.createElement('button');
    button.textContent = label;
    if (cls) button.className = cls;
    button.onclick = action;
    $('#modal-actions').append(button);
  });
  $('#modal').classList.remove('hidden');
}

function closeModal() {
  paused = false;
  $('#modal').classList.add('hidden');
}

// ---------------- Booster Handlers ----------------
function useOrBuyBooster(type, cost, action) {
  if (paused) return;
  lastActionTime = performance.now();
  if (boosts[type] > 0) {
    boosts[type]--;
    boostersUsedThisLevel++;
    action();
    update();
  } else if (coins >= cost) {
    coins -= cost;
    boostersUsedThisLevel++;
    action();
    update();
    toast(`Purchased ${type} for ${cost} coins!`);
  } else {
    toast(`Need ${cost} coins to use ${type}!`);
  }
}

$('#undo').onclick = () => {
  useOrBuyBooster('undo', 25, () => {
    const box = [...waiting].reverse().find(b => !b.reserved);
    if (!box) {
      toast('Only an empty box can return');
      boosts.undo++; // Refund
      return;
    }
    jamAcknowledged = false;
    waiting = waiting.filter(b => b !== box);
    box.status = 'queue';
    boxes.splice(boxes.indexOf(box), 1);
    boxes.unshift(box);
    layoutQueue();
    soundEngine.playBooster('undo');
    haptic(20);
    toast('Back to the shelf!');
  });
};

$('#shuffle').onclick = () => {
  useOrBuyBooster('shuffle', 35, () => {
    const queue = boxes.filter(b => b.status === 'queue');
    if (queue.length < 2) {
      toast('No boxes left to shuffle');
      boosts.shuffle++; // Refund
      return;
    }
    const front = lanes.map(lane => lane.cans[0]?.color);
    queue.sort((a, b) => Number(front.includes(b.color)) - Number(front.includes(a.color)));
    boxes = [...boxes.filter(b => b.status !== 'queue'), ...queue];
    layoutQueue();
    soundEngine.playBooster('shuffle');
    haptic(30);
    toast('Fresh matches coming up!');
  });
};

$('#extra').onclick = () => {
  useOrBuyBooster('extra', 50, () => {
    jamAcknowledged = false;
    slotMax++;
    makeSlots();
    layoutQueue();
    waiting.forEach(box => {
      if (box.target) box.target.x = slotX(box.slot);
    });
    soundEngine.playBooster('extra');
    haptic(40);
    toast('Extra slot unlocked!');
  });
};

// ---------------- Theme Switching ----------------
function updateThemeUI() {
  const t = themes[currentTheme];
  if ($('#theme-icon')) $('#theme-icon').textContent = t.icon;
  if ($('#theme-name')) $('#theme-name').textContent = t.name;
}

function switchTheme() {
  const order = ['bottles', 'cans', 'boba'];
  const nextIdx = (order.indexOf(currentTheme) + 1) % order.length;
  currentTheme = order[nextIdx];
  localStorage.setItem('bj-theme', currentTheme);
  updateThemeUI();

  // Dynamically re-skin active drinks in conveyor lanes
  for (const lane of lanes) {
    lane.cans.forEach(canItem => {
      const oldMesh = canItem.mesh;
      const pos = oldMesh.position.clone();
      const enabled = oldMesh.isEnabled();
      const newMesh = createDrink(canItem.color);
      newMesh.position.copyFrom(pos);
      newMesh.setEnabled(enabled);
      newMesh.parent = world;
      oldMesh.dispose(false, false);
      canItem.mesh = newMesh;
    });
  }

  // Re-skin packed drinks inside cartons
  for (const box of boxes) {
    const children = [...box.mesh.getChildren()];
    for (const child of children) {
      if (child.metadata?.color !== undefined) {
        const clr = child.metadata.color;
        const pos = child.position.clone();
        const rot = child.rotation.clone();
        const scl = child.scaling.clone();
        const newMesh = createDrink(clr);
        newMesh.position.copyFrom(pos);
        newMesh.rotation.copyFrom(rot);
        newMesh.scaling.copyFrom(scl);
        newMesh.parent = box.mesh;
        child.dispose(false, false);
      }
    }
  }

  soundEngine.playBooster('shuffle');
  haptic(25);
  pulse($('#theme-btn'), 1.2);
  toast(`Theme: ${themes[currentTheme].title}!`);
}

if ($('#theme-btn')) $('#theme-btn').onclick = switchTheme;
updateThemeUI();

// ---------------- Settings Modal ----------------
$('#settings').onclick = () => {
  soundEngine.init();
  modal('Game Settings', 'Bottle Jam 3D · Match colorful drinks with their cartons!', '⚙', [
    ['Keep Playing', closeModal, 'primary'],
    [`Theme: ${themes[currentTheme].title}`, () => {
      switchTheme();
      $('#settings').onclick();
    }, 'secondary'],
    [soundEngine.soundOn ? 'Sound FX: ON ♫' : 'Sound FX: OFF', () => {
      soundEngine.soundOn = !soundEngine.soundOn;
      localStorage.setItem('bj-sound', soundEngine.soundOn ? 'on' : 'off');
      $('#settings').onclick();
    }, 'secondary'],
    [soundEngine.musicOn ? 'Chill Music: ON ♪' : 'Chill Music: OFF', () => {
      soundEngine.musicOn = !soundEngine.musicOn;
      localStorage.setItem('bj-music', soundEngine.musicOn ? 'on' : 'off');
      if (soundEngine.musicOn) soundEngine.startBgm();
      else soundEngine.stopBgm();
      $('#settings').onclick();
    }, 'secondary'],
    [vibrationOn ? 'Vibration: ON' : 'Vibration: OFF', () => {
      vibrationOn = !vibrationOn;
      localStorage.setItem('bj-vibrate', vibrationOn ? 'on' : 'off');
      $('#settings').onclick();
    }, 'secondary'],
    ['Restart Level', () => { closeModal(); start(); }, 'secondary']
  ]);
};

// ---------------- Window Resize ----------------
function resize() {
  const aspect = innerWidth / innerHeight;
  const span = Math.max(aspect > 1.1 ? 17.6 : 16.6, 9.4 / aspect);
  const distance = span / (2 * Math.tan(camera.fov / 2));
  camera.position.copyFrom(cameraTarget.add(cameraDirection.scale(distance)));
  camera.setTarget(cameraTarget);
  camera.orthoTop = span / 2;
  camera.orthoBottom = -span / 2;
  camera.orthoLeft = -span * aspect / 2;
  camera.orthoRight = span * aspect / 2;
  engine.resize();
  scene.updateTransformMatrix(true);
  positionControls();

  const projectY = z => screenPosition(new B.Vector3(0, 0, z)).y;
  $('#hint').style.top = `${projectY(1.2)}px`;
  $('#slots-label').style.top = `${projectY(2.20) - innerHeight / span * 0.58}px`;
}
window.addEventListener('resize', resize);

// ---------------- Main Render & Animation Loop ----------------
function frame(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.04);
  lastTime = time;

  if (!paused) {
    tick += dt;
    if (tick > 0.18) {
      tick = 0;
      pack();
    }

    // Conveyor Rollers & Belts (Only rolls when cans are actively moving!)
    for (const lane of lanes) {
      let isLaneMoving = false;
      for (const canItem of lane.cans) {
        if (canItem.target) {
          const dist = Math.abs(canItem.mesh.position.z - canItem.target.z);
          if (dist > 0.015) {
            isLaneMoving = true;
          }
          B.Vector3.LerpToRef(canItem.mesh.position, canItem.target, Math.min(1, dt * 16), canItem.mesh.position);
        }
      }

      if (isLaneMoving) {
        lane.beltSpeed = Math.min(3.4, (lane.beltSpeed || 0) + dt * 22);
      } else {
        lane.beltSpeed = Math.max(0, (lane.beltSpeed || 0) - dt * 15);
      }

      if (lane.beltSpeed > 0.001) {
        for (const roller of lane.rollers) {
          roller.position.z += lane.beltSpeed * dt;
          if (roller.position.z > 0.69) {
            roller.position.z -= 30 * 0.23;
          }
        }
      }
    }

    // Boxes Animation
    for (const box of boxes) {
      if (box.move) {
        box.move.t = Math.min(1, box.move.t + dt / 0.36);
        const t = box.move.t;
        const e = t * t * (3 - 2 * t);
        B.Vector3.LerpToRef(box.move.from, box.target, e, box.mesh.position);
        box.mesh.position.y += 4 * t * (1 - t) * 1.05;
        box.mesh.rotation.x = Math.sin(t * Math.PI) * -0.18;
        if (t === 1) {
          box.move = null;
          box.mesh.rotation.x = 0;
          box.bounce = 0.85;
          soundEngine.playBoxSend();
        }
      } else if (box.target) {
        B.Vector3.LerpToRef(box.mesh.position, box.target, Math.min(1, dt * 16), box.mesh.position);
        if (box.status === 'queue') box.mesh.position.y = box.target.y;
      }

      if (box.status === 'queue' && box.wantsOpen && (box.openAmount || 0) < 1 && !box.move &&
        Math.hypot(box.mesh.position.x - box.target.x, box.mesh.position.z - box.target.z) < 0.04) {
        box.openAmount = Math.min(1, (box.openAmount || 0) + dt / 0.32);
        poseQueuedFlaps(box);
      }

      // Wobble / Shake on full rejection
      if (box.shake > 0) {
        box.shake = Math.max(0, box.shake - dt * 4.5);
        box.mesh.position.x = (box.target?.x || box.mesh.position.x) + Math.sin(box.shake * Math.PI * 6) * 0.12;
        box.mesh.rotation.z = Math.sin(box.shake * Math.PI * 6) * 0.10;
      }

      box.bounce = Math.max(0, box.bounce - dt * 4);
      const squash = Math.sin(box.bounce * Math.PI * 2) * box.bounce * 0.12;
      box.mesh.scaling.set(1 + squash, 1 - squash, 1 + squash);

      // Flap closing & taping sequence
      if (box.status === 'closing') {
        box.closeTime += dt;
        for (const flap of box.mesh.metadata.flaps) {
          const t = B.Scalar.Clamp((box.closeTime - 0.02 - flap.delay) / 0.22, 0, 1);
          const e = t * t * (3 - 2 * t);
          flap.hinge.rotation[flap.axis] = B.Scalar.Lerp(flap.open, flap.closed, e);
        }
        if (box.closeTime > 0.15 && !box.flapAudioPlayed) {
          box.flapAudioPlayed = true;
          soundEngine.playFlapClose();
        }
        if (box.closeTime > 0.32) {
          box.mesh.metadata.tape.setEnabled(true);
          box.mesh.metadata.tape.scaling.z = Math.min(1, (box.closeTime - 0.32) / 0.12);
          if (!box.tapeAudioPlayed) {
            box.tapeAudioPlayed = true;
            soundEngine.playTapeZip();
          }
        }
        if (box.closeTime > 0.54) {
          box.status = 'vanishing';
          box.vanishTime = 0;
          burstConfetti(box.mesh.position, box.color);

          // Combo tracking
          const now = performance.now();
          if (now - lastPackTime < 4500) combo++;
          else combo = 1;
          lastPackTime = now;

          soundEngine.playBoxPacked(combo);
          haptic([30, 40, 40]);

          const bonus = combo > 1 ? ` (+${combo * 2})` : '';
          spawnFloatingText(box.mesh.position, combo > 1 ? `COMBO x${combo}!${bonus}` : '+5 Packed!', combo > 1);
          coins += 5;
          $('#coins').textContent = coins;
          localStorage.setItem('bj-coins', coins);
        }
      }

      if (box.status === 'vanishing') {
        box.vanishTime += dt;
        const pop = Math.sin(Math.min(1, box.vanishTime / 0.10) * Math.PI) * 0.14;
        const t = B.Scalar.Clamp((box.vanishTime - 0.10) / 0.12, 0, 1);
        const scale = (1 + pop) * (1 - t * t);
        box.mesh.scaling.setAll(Math.max(0.001, scale));
        if (t === 1) {
          box.mesh.setEnabled(false);
          box.status = 'done';
          waiting = waiting.filter(b => b !== box);
          update();
        }
      }
    }

    // Flights (Cans Flying from Conveyor to Box)
    for (let i = flights.length - 1; i >= 0; i--) {
      const flight = flights[i];
      flight.t += dt * 3.4;
      const t = Math.min(flight.t, 1);
      const ease = t * t * (3 - 2 * t);

      const local = new B.Vector3((flight.index % 2 - 0.5) * 0.40, 0.13, (Math.floor(flight.index / 2) - 0.5) * 0.40);
      flight.box.mesh.computeWorldMatrix(true);
      B.Vector3.TransformCoordinatesToRef(local, flight.box.mesh.getWorldMatrix(), flight.to);
      B.Vector3.LerpToRef(flight.from, flight.to, ease, flight.mesh.position);

      flight.mesh.position.y += Math.sin(t * Math.PI) * (1.10 + flight.index * 0.045);
      flight.mesh.rotation.z = Math.sin(t * Math.PI) * 0.14;
      flight.mesh.rotation.x = Math.sin(t * Math.PI) * -0.22;

      const flightScale = 1 - t * 0.32;
      const stretch = Math.sin(t * Math.PI) * 0.14;
      flight.mesh.scaling.set(flightScale * (1 - stretch * 0.5), flightScale * (1 + stretch), flightScale * (1 - stretch * 0.5));

      if (t >= 1) {
        flights.splice(i, 1);
        const box = flight.box;
        flight.mesh.rotation.set(0, 0, 0);
        flight.mesh.parent = box.mesh;
        flight.mesh.position.copyFrom(local);
        flight.mesh.scaling.setAll(0.68);
        flight.mesh.metadata.landedAt = performance.now();

        box.count++;
        box.bounce = 0.85;
        burstConfetti(box.mesh.position, box.color, 5);
        pulse($('.progress-track'), 1.04);
        packed++;
        updateBoxBadge(box);

        soundEngine.playCanLand(box.count);
        haptic(10);

        if (box.count === boxCapacity) {
          box.status = 'closing';
          box.closeTime = 0;
          box.target = null;
          box.move = null;
        }
        update();
      }
    }

    // Can landing squash-bounce
    for (const box of boxes) {
      for (const piece of box.mesh.getChildren()) {
        if (!piece.metadata?.landedAt) continue;
        const pt = Math.min(1, (time - piece.metadata.landedAt) / 180);
        const bounce = Math.sin(pt * Math.PI) * 0.10 * (1 - pt);
        piece.position.y = 0.13 + bounce;
        piece.scaling.set(0.68 + bounce * 0.35, 0.68 - bounce * 0.5, 0.68 + bounce * 0.35);
        if (pt === 1) delete piece.metadata.landedAt;
      }
    }

    // Particle Simulation
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.v.y -= dt * 5.2;
      p.mesh.position.addInPlace(p.v.scale(dt));
      p.mesh.rotation.addInPlace(p.rot.scale(dt));
      p.mesh.scaling.setAll(Math.max(0.001, Math.min(1, p.life / 0.16)));
      if (p.life <= 0) {
        p.mesh.dispose(false, false);
        particles.splice(i, 1);
      }
    }

    // Idle Hint Guide
    if (!paused && !ended && performance.now() - lastActionTime > 4500) {
      const frontColors = lanes.map(l => l.cans[0]?.color).filter(c => c !== undefined);
      const hintBox = boxes.find(b => b.status === 'queue' && b.wantsOpen && (b.openAmount || 0) >= 0.95 && frontColors.includes(b.color));
      if (hintBox && !hintBox.move) {
        hintBox.bounce = 0.55;
      }
      lastActionTime = performance.now() - 2500;
    }

    // Level Completion Check
    if (packed === total && !ended && !boxes.some(b => b.status === 'closing' || b.status === 'vanishing')) {
      ended = true;
      const starsEarned = boostersUsedThisLevel === 0 ? 3 : boostersUsedThisLevel === 1 ? 2 : 1;
      const reward = 20 + starsEarned * 5;
      coins += reward;
      localStorage.setItem('bj-coins', coins);

      soundEngine.playVictory();
      haptic([50, 60, 70, 80]);

      modal('Level Complete!', `Packed all cans crisp and fresh!\nEarned +${reward} coins!`, '★', [
        ['Next Level →', () => {
          level++;
          localStorage.setItem('bj-level', level);
          start();
        }, 'accent'],
        ['Replay', start, 'secondary']
      ], starsEarned);
    }

    positionControls();
  }

  scene.render();
}

// ---------------- Initialize & Run ----------------
start();
engine.runRenderLoop(() => frame(performance.now()));
