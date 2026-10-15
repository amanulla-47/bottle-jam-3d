const B = window.BABYLON;
const $ = selector => document.querySelector(selector);
const colors = [0xec3348, 0x28d441, 0x299aef, 0xff9c28, 0x9752e1];
const names = ['red', 'green', 'blue', 'orange', 'purple'];
const boxCapacity=4;
const visibleCansPerLane = 7, canSpacing = 1.03;
const engine = new B.Engine($('#scene'), true, {preserveDrawingBuffer:true, stencil:true});
engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio, 2));
const scene = new B.Scene(engine); scene.useRightHandedSystem = true;
scene.clearColor = new B.Color4(.64,.76,.96,1);
const camera = new B.FreeCamera('game-camera', new B.Vector3(0,15.5,19), scene);
const cameraTarget=new B.Vector3(0,0,.35);
const cameraDirection=new B.Vector3(0,21,18).normalize();
camera.setTarget(cameraTarget); camera.mode=B.Camera.PERSPECTIVE_CAMERA;camera.fov=.32;
camera.minZ = .1; camera.maxZ = 100;
function color(value) { return typeof value === 'number' ? B.Color3.FromHexString('#'+value.toString(16).padStart(6,'0')) : value; }
function mix(a,b,t) { return B.Color3.Lerp(color(a),color(b),t); }
const hemi = new B.HemisphericLight('sky', new B.Vector3(0,1,0), scene);
hemi.diffuse=color(0xfff8ee); hemi.groundColor=color(0xc5d3df); hemi.intensity=.68;
const sun = new B.DirectionalLight('sun', new B.Vector3(4,-10,-7), scene);
sun.position.set(-4,10,7); sun.diffuse=color(0xfff5e7); sun.intensity=.38;
const shadows = new B.ShadowGenerator(2048,sun); shadows.usePercentageCloserFiltering=true; shadows.filteringQuality=B.ShadowGenerator.QUALITY_MEDIUM; shadows.bias=.003; shadows.normalBias=.06; shadows.setDarkness(.30);
const fill = new B.DirectionalLight('fill', new B.Vector3(-6,-5,4),scene); fill.diffuse=color(0xdedcff);fill.intensity=.18;
const pieceLight = new B.DirectionalLight('pieces',new B.Vector3(2,-4,-8),scene);pieceLight.intensity=.20;
const world = new B.TransformNode('factory',scene);
const materials = new Map(), geometries = new Map();
function mat(value, roughness=.34) {
 const c=color(value),key=c.toHexString()+':'+roughness;
 if(!materials.has(key)){const m=new B.StandardMaterial(key,scene);m.diffuseColor=c;m.emissiveColor=c.scale(.035);m.specularColor=new B.Color3(.12,.12,.12);m.specularPower=48*(1-roughness)+8;m.backFaceCulling=true;materials.set(key,m);}
 return materials.get(key);
}
function mesh(geometry,material,parent,x=0,y=0,z=0){const o=new B.Mesh('piece',scene);geometry.applyToMesh(o);o.material=material;o.parent=parent;o.position.set(x,y,z);o.receiveShadows=true;shadows.addShadowCaster(o);return o;}
function roundedGeometry(w,h,d,r){
 const key=[w,h,d,r].join(',');if(geometries.has(key))return geometries.get(key);
 const positions=[],indices=[],uvs=[],normals=[],half=[w/2,h/2,d/2];
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const u=(axis+1)%3,v=(axis+2)%3,base=positions.length/3,N=8;
  for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){
   const p=[0,0,0];p[axis]=sign*half[axis];p[u]=(i/N*2-1)*half[u];p[v]=(j/N*2-1)*half[v];
   const q=p.map((a,k)=>Math.max(-half[k]+r,Math.min(half[k]-r,a))),delta=p.map((a,k)=>a-q[k]),len=Math.hypot(...delta)||1;
   positions.push(...q.map((a,k)=>a+delta[k]/len*r));normals.push(...delta.map(a=>a/len));uvs.push(i/N,j/N);
  }
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){let a=base+j*(N+1)+i,b=a+1,c=a+N+1,e=c+1;if(sign>0)indices.push(a,c,b,b,c,e);else indices.push(a,b,c,b,e,c);}
 }
 const data=new B.VertexData();Object.assign(data,{positions,indices,normals,uvs});geometries.set(key,data);return data;
}
function cube(w,h,d,c,x=0,y=0,z=0,parent=world,r=.08){return mesh(roundedGeometry(w,h,d,Math.min(r,w/2,h/2,d/2)),mat(c),parent,x,y,z);}
const sphereGeo=B.VertexData.CreateSphere({diameter:2,segments:16});
function orb(r,c,x,y,z,parent){const o=mesh(sphereGeo,mat(c),parent,x,y,z);o.scaling.setAll(r);shadows.removeShadowCaster(o);return o;}
function cylinder(r,h,c,x,y,z,parent=world){const key=`cylinder:${r}:${h}`;if(!geometries.has(key))geometries.set(key,B.VertexData.CreateCylinder({diameter:r*2,height:h,tessellation:32}));return mesh(geometries.get(key),mat(c),parent,x,y,z);}
function extract(o){const data=B.VertexData.ExtractFromMesh(o);o.dispose();return data;}
function torus(r,t,c,x,y,z,parent){const key=`torus:${r}:${t}`;if(!geometries.has(key)){
 const o=B.MeshBuilder.CreateTorus('template',{diameter:r*2,thickness:t*2,tessellation:32},scene);o.rotation.x=Math.PI/2;o.bakeCurrentTransformIntoVertices();geometries.set(key,extract(o));}
 return mesh(geometries.get(key),mat(c),parent,x,y,z);
}
function face(parent,y,z,size=1){
 for(const side of [-1,1]){const eye=orb(.031*size,0x45435f,side*.072*size,y+.025*size,z,parent);eye.scaling.z*=.4;
 orb(.009*size,0xffffff,side*.072*size-.007*size,y+.038*size,z+.013*size,parent);
 const cheek=orb(.035*size,0xffa7b4,side*.123*size,y-.025*size,z-.005*size,parent);cheek.scaling.set(.035*size,.018*size,.009*size);}
 const key=`smile:${y}:${z}:${size}`;if(!geometries.has(key)){const path=[];for(let i=0;i<=12;i++){const t=i/12;path.push(new B.Vector3((t*2-1)*.032*size,y-.013*size-2*t*(1-t)*.05*size,z+2*t*(1-t)*.007));}geometries.set(key,extract(B.MeshBuilder.CreateTube('smile',{path,radius:.009*size,tessellation:6},scene)));}
 mesh(geometries.get(key),mat(0x45435f),parent);
}
const canProfile = [[.17, 0], [.205, .012], [.225, .045], [.234, .10], [.234, .48], [.223, .55], [.196, .575]];
const canGeometry=extract(B.MeshBuilder.CreateLathe('can-template',{shape:canProfile.map(([r,y])=>new B.Vector3(r,y,0)),tessellation:32,cap:B.Mesh.NO_CAP,sideOrientation:B.Mesh.FRONTSIDE},scene));
const backdropTexture=new B.DynamicTexture('backdrop',{width:512,height:512},scene,false);
const backdropContext=backdropTexture.getContext();const gradient=backdropContext.createRadialGradient(256,240,20,256,256,355);
gradient.addColorStop(0,'#c5dbff');gradient.addColorStop(.48,'#b7cff7');gradient.addColorStop(1,'#91ace0');backdropContext.fillStyle=gradient;backdropContext.fillRect(0,0,512,512);backdropTexture.update();
const backdropMaterial=new B.StandardMaterial('backdrop',scene);backdropMaterial.emissiveTexture=backdropTexture;backdropMaterial.disableLighting=true;backdropMaterial.specularColor=B.Color3.Black();backdropMaterial.backFaceCulling=false;
const backdropGeometry=B.VertexData.CreatePlane({width:60,height:60});
function screenPosition(p){return B.Vector3.Project(p,B.Matrix.Identity(),scene.getTransformMatrix(),new B.Viewport(0,0,innerWidth,innerHeight));}
function can(color) {
  const root = new B.TransformNode('can',scene); root.metadata={};
  const group = new B.TransformNode('can-model',scene);group.parent=root;group.scaling.y=1.30;
  mesh(canGeometry, mat(colors[color], .22), group, 0, .035, 0);
  cylinder(.196, .033, 0xf8eee9, 0, .616, 0, group);
  const rim = torus(.193, .016, 0xffffff, 0, .638, 0, group);
  rim.rotation.x = Math.PI / 2;
  cylinder(.164, .008, mix(colors[color],0xffffff,.12), 0, .637, 0, group);
  const tab = torus(.051, .017, 0xfaffff, 0, .648, .012, group);
  tab.rotation.x = Math.PI / 2;
  tab.scaling.y = 1.35;
  const bottomRim = torus(.195, .018, mix(colors[color],0xffffff,.18), 0, .055, 0, group);
  bottomRim.rotation.x = Math.PI / 2;
  pieceLight.includedOnlyMeshes.push(...group.getChildMeshes());
  return root;
}
function badge(c,text){
 const texture=new B.DynamicTexture('count',{width:256,height:128},scene,false);texture.hasAlpha=true;
 const ctx=texture.getContext();ctx.font='900 66px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=c;ctx.clearRect(0,0,256,128);ctx.fillText(text,128,70);texture.update();
 const material=new B.StandardMaterial('badge',scene);material.diffuseTexture=texture;material.emissiveColor=B.Color3.White();material.disableLighting=true;material.useAlphaFromDiffuseTexture=true;material.backFaceCulling=false;
 return {texture,ctx,material};
}
function carton(color) {
  const group = new B.TransformNode('group',scene), c = colors[color]; group.metadata={};
  const inside = mix(c,0x64596f,.26);
  // Equal outside dimensions create a square carton with a taller rim.
  cube(1.10,.10,1.10,c,0,.07,0,group);
  cube(1.10,.68,.14,c,0,.46,.48,group,.065);
  cube(1.10,.68,.14,c,0,.46,-.48,group,.065);
  cube(.14,.68,.96,c,-.48,.46,0,group,.065);
  cube(.14,.68,.96,c,.48,.46,0,group,.065);
  cube(.90,.02,.90,inside,0,.13,0,group);
  const flaps=[];
  for(const side of [-1,1]){
    const hinge=new B.TransformNode('side-flap',scene);hinge.position.set(side*.50,.80,0);hinge.parent=group;
    cube(.50,.045,.99,c,side*.25,0,0,hinge,.018);
    hinge.rotation.z=-side*1.12;
    flaps.push({hinge,axis:'z',open:-side*1.12,closed:side*Math.PI,delay:0});
  }
  for(const side of [-1,1]){
    const hinge=new B.TransformNode('lid-flap',scene);hinge.position.set(0,side<0?.825:.84,side*.50);hinge.parent=group;
    cube(1.05,.045,.52,c,0,0,side*.26,hinge,.018);
    hinge.rotation.x=side*1.25;
    flaps.push({hinge,axis:'x',open:side*1.25,closed:-side*Math.PI,delay:.10});
  }
  const tape=cube(.16,.018,1.05,0xffe6ac,0,.875,0,group,.008);tape.setEnabled(false);
  group.metadata.flaps=flaps;group.metadata.tape=tape;
  const counter = badge('#655674', '0 / 4');
  if (!geometries.has('badge')) geometries.set('badge', B.VertexData.CreatePlane({width:.38,height:.22}));
  const countLabel=mesh(geometries.get('badge'), counter.material, group, 0, .46, .567);
  shadows.removeShadowCaster(countLabel);
  group.metadata.badge = counter;

  pieceLight.includedOnlyMeshes.push(...group.getChildMeshes());
  return group;
}
let level = Number(localStorage.getItem('bj-level')) || 1;
let coins = Number(localStorage.getItem('bj-coins')) || 100;
let lanes = [], boxes = [], waiting = [], flights = [], particles = [], slots = [];
let packed = 0, total = 0, paused = false, ended = false, slotMax = 4;
let boosts = {}, lastTime = 0, tick = 0, sound = localStorage.getItem('bj-sound') !== 'off';
let audio, levelGeneration = 0, jamAcknowledged = false;
function beep(freq = 500) {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    if(audio.state==='suspended') void audio.resume();
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = 'sine'; oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.frequency.setValueAtTime(freq, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(freq * .8, audio.currentTime + .12);
    gain.gain.setValueAtTime(.035, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .18);
    oscillator.start(); oscillator.stop(audio.currentTime + .18);
  } catch { /* Audio is optional on browsers that restrict playback. */ }
}
function toast(text) {
  $('#toast').textContent = text; $('#toast').classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('show'), 2100);
}
function slotX(i) { return (i - (slotMax - 1) / 2) * 1.738; }
function queueColumns(){return Math.min(4,lanes.length);}
function queueX(i) { return slotX(i + (slotMax - queueColumns()) / 2); }
function start() {
  levelGeneration++;
  boxes.forEach(b => { b.mesh.metadata.badge.texture.dispose(); b.mesh.metadata.badge.material.dispose(); });
  world.getChildren().forEach(node=>node.dispose(false,false)); pieceLight.includedOnlyMeshes=[]; lanes = []; boxes = []; waiting = []; flights = []; particles = []; slots = [];
  packed = 0; slotMax = 4; boosts = { undo: 3, shuffle: 3, extra: 1 };
  ended = false; paused = false; tick = 0; jamAcknowledged = false;
  $('#modal').classList.add('hidden'); $('#hint').textContent = '';
  const n = Math.min(5,2+Math.floor((level-1)/3)), rows = boxCapacity*3;
  total = n * rows;
  const floor = mesh(backdropGeometry, backdropMaterial, world, 0, -.52, -.5);
  floor.rotation.x = -Math.PI / 2; shadows.removeShadowCaster(floor);
  // Separate blue conveyor frames mirror the clean reference layout.
  const width = n * .84 + .42;
  for (let l = 0; l < n; l++) {
    const x = (l - (n - 1) / 2) * .84;
    cube(.76, .10, 7.12, 0x526789, x, .07, -2.97, world, .04);
    for (let j = 0; j < 29; j++) cube(.69, .021, .035, 0x5d7293, x, .13, -6.37 + j * .24, world, .01);
    cube(.035, .09, 7.19, 0x91b7e8, x - .39, .15, -2.97, world, .017);
    cube(.035, .09, 7.19, 0x91b7e8, x + .39, .15, -2.97, world, .017);
    // The roof and side walls conceal a can until it crosses the output opening.
    cube(.79,.16,1.20,0x8cbceb,x,1.20,-6.96,world,.055);
    cube(.11,1.02,1.20,0x83b3e3,x-.34,.61,-6.96,world,.025);
    cube(.11,1.02,1.20,0x83b3e3,x+.34,.61,-6.96,world,.025);
    cube(.79,1.02,.08,0x42668e,x,.61,-7.54,world,.025);
    cube(.65,.10,.06,0xb9def9,x,1.10,-6.35,world,.02);
    const indicator=orb(.028,0xb9f6d3,x+.24,1.20,-6.335,world);
    shadows.removeShadowCaster(indicator);
    const arr = [];
    for (let j = 0; j < rows; j++) {
      const color = (l + Math.floor(j / boxCapacity) + level - 1) % Math.min(n, 5);
      const object = can(color);
      object.position.set(x, .15, .35 - j * canSpacing);
      object.setEnabled(j < visibleCansPerLane);
      object.parent=world; arr.push({ color, mesh: object, visible:j<visibleCansPerLane });
    }
    lanes.push({ x, cans: arr });
  }
  for (let layer = 0; layer < 3; layer++) {
    for (let l = 0; l < n; l++) {
      const color = (l + layer + level - 1) % Math.min(n, 5);
      const object = carton(color); object.parent=world;
      boxes.push({ color, mesh: object, count: 0, reserved: 0, id: layer * n + l, column:l%Math.min(4,n), queueVisible:true, status: 'queue', bounce: 0 });
    }
  }
  // A shallow packing shelf and white divider leave the cans and cartons in focus.
  cube(40,.10,6.3,0x9dc7ef,0,-.23,6.70,world,.045);
  cube(40,.055,.12,0xe9f4ff,0,-.12,3.55,world,.025);
  cube(40,.055,.10,0x75a8de,0,-.12,4.974,world,.025);
  makeSlots(); layoutQueue(true); update(); resize();
}
function makeSlots() {
  slots.forEach(object => object.dispose(false,false)); slots = [];
  for (let i = 0; i < slotMax; i++) {
    slots.push(cube(1.12, .035, 1.06, 0xeaf5ff, slotX(i), -.025, 2.20, world, .04));
    slots.push(cube(.99, .025, .92, 0x7395c2, slotX(i), .003, 2.20, world, .022));
  }
}
const visibleBoxRows=3,boxQueueStart=4.05,boxRowSpacing=1.848;
function queuedColumn(column){return boxes.filter(b=>b.status==='queue'&&b.column===column);}
function layoutQueue(instant=false){
  for(let column=0;column<queueColumns();column++) queuedColumn(column).forEach((b,row)=>{
    b.target=new B.Vector3(queueX(column),.015,boxQueueStart+row*boxRowSpacing);
    b.wantsOpen=row===0;
    if(instant||!b.wantsOpen){b.openAmount=b.wantsOpen?1:0;b.openTime=0;poseQueuedFlaps(b);}
    const visible=row<visibleBoxRows;
    if(instant) b.mesh.position.copyFrom(b.target);
    else if(visible&&!b.queueVisible) b.mesh.position.set(queueX(column),.015,boxQueueStart+visibleBoxRows*boxRowSpacing);
    b.mesh.setEnabled(visible);b.queueVisible=visible;
  });
  rebuildControls();
}
function poseQueuedFlaps(box){
  for(const flap of box.mesh.metadata.flaps){
    const progress=B.Scalar.Clamp(((box.openAmount||0)-(flap.axis==='z'?.22:0))/.78,0,1);
    const ease=progress*progress*(3-2*progress);
    flap.hinge.rotation[flap.axis]=B.Scalar.Lerp(flap.closed,flap.open,ease);
  }
}
function rebuildControls(){
  const root=$('#box-controls');root.replaceChildren();
  for(let column=0;column<queueColumns();column++){
    const b=queuedColumn(column)[0];if(!b)continue;
    const button=document.createElement('button');button.className='box-hit';
    button.setAttribute('aria-label',`Pack ${names[b.color]} box`);button.dataset.id=b.id;
    button.onclick=()=>sendBox(b);
    root.append(button);
  }
  positionControls();
}
function positionControls() {
  const scale = innerHeight / (camera.orthoTop - camera.orthoBottom);
  document.querySelectorAll('.box-hit').forEach(button => {
    const box = boxes.find(b => b.id == button.dataset.id);
    if (!box) return;
    button.disabled=box.openAmount<.999;
    const p = screenPosition(box.mesh.position.add(new B.Vector3(0,.40,0)));
    button.style.left = `${p.x - scale * .65}px`;
    button.style.top = `${p.y - scale * .48}px`;
    button.style.width = `${scale * 1.3}px`; button.style.height = `${scale * 1.1}px`;
  });
}
function sendBox(box) {
  if (paused || ended || box.status !== 'queue' || box.openAmount<.999) return;
  if (waiting.length >= slotMax) { toast('A little jam! Try a booster.'); beep(180); return; }
  const slot = Array.from({ length: slotMax }, (_, i) => i).find(i => !waiting.some(b => b.slot === i));
  jamAcknowledged = false;
  box.slot = slot; box.status = 'waiting'; box.bounce = 1;
  box.target = new B.Vector3(slotX(slot), .07, 2.20);
  box.move = { from: box.mesh.position.clone(), to: box.target.clone(), t: 0 }; waiting.push(box);
  layoutQueue(); beep(540); $('#hint').textContent = '';
  update(); tick = .5;
}
function pack() {
  if (ended) return;
  for (const lane of lanes) {
    const front = lane.cans[0]; if (!front) continue;
    const box = waiting.find(b => b.color === front.color && b.reserved < boxCapacity && !b.move);
    if (!box) continue;
    lane.cans.shift(); const index = box.reserved++;
    flights.push({ mesh: front.mesh, from: front.mesh.position.clone(), to: new B.Vector3(), t: 0, index, box });
    lane.cans.forEach((can, j) => {
      can.target = new B.Vector3(lane.x, .15, .35 - j * canSpacing);
      const visible=j<visibleCansPerLane;
      if(visible&&!can.visible)can.mesh.position.set(lane.x,.15,-6.98);
      can.visible=visible;can.mesh.setEnabled(visible);
    });
  }
  checkLoss();
}
function checkLoss() {
  if (!jamAcknowledged && waiting.length === slotMax && !flights.length && !waiting.some(b => b.reserved === boxCapacity) &&
    !lanes.some(l => l.cans[0] && waiting.some(b => b.color === l.cans[0].color && b.reserved < boxCapacity))) {
    ended = true; jamAcknowledged = true;
    modal('A little bottle jam!', 'These boxes need colors hiding further up the belt. Try a booster or give it another go.', '♡', [
      ['Try again', start], ['Use a booster', () => { ended = false; closeModal(); }]
    ]);
  }
}
function update() {
  $('#level').textContent = level; $('#coins').textContent = coins;
  $('#counter').textContent = `${packed} / ${total} cans`;
  $('#progress').style.width = `${packed / total * 100}%`;
  $('.progress').setAttribute('aria-valuenow', Math.round(packed / total * 100));
  $('#slots-count').textContent = `${waiting.length} / ${slotMax}`;
  for (const key in boosts) {
    $(`#${key} small`).textContent = boosts[key];
    $(`#${key}`).disabled = boosts[key] === 0;
  }
  localStorage.setItem('bj-coins', coins);
}
function updateBoxBadge(box) {
  const { ctx, texture } = box.mesh.metadata.badge;
  ctx.clearRect(0, 0, 256, 128); ctx.fillText(`${box.count} / ${boxCapacity}`, 128, 70); texture.update();
}
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function pulse(element, amount=1.12) {
  if(reducedMotion) return;
  element.animate([{scale:'1'},{scale:String(amount),offset:.35},{scale:'1'}],{duration:220,easing:'ease-out'});
}
function burst(position, color=0, count=14) {
  if(reducedMotion) return;
  for(let i=0;i<count;i++) {
    const angle=i/count*Math.PI*2, speed=.7+Math.random()*.9;
    const object=cube(.055,.035,.055,i%3===0?0xffffff:colors[color],position.x,position.y+.65,position.z,world,.01);
    shadows.removeShadowCaster(object);
    particles.push({mesh:object,v:new B.Vector3(Math.cos(angle)*speed,1.3+Math.random(),Math.sin(angle)*speed),life:.48});
  }
}
function chime() {
  if(!sound) return;
  [784,988,1175].forEach((note,i)=>setTimeout(()=>beep(note),i*55));
}
function modal(title, text, icon, actions) {
  paused = true; $('#modal-title').textContent = title; $('#modal-text').textContent = text;
  $('#modal-icon').textContent = icon; $('#modal-actions').replaceChildren();
  actions.forEach(([label, action]) => {
    const button = document.createElement('button'); button.textContent = label; button.onclick = action; $('#modal-actions').append(button);
  });
  $('#modal').classList.remove('hidden');
}
function closeModal() { paused = false; $('#modal').classList.add('hidden'); }
$('#settings').onclick = () => modal('Tea break?', 'Fill each box with four cans of the same color. Leave a little room for your next match.', '☁', [
  ['Keep playing', closeModal],
  [sound ? 'Sound is on ♫' : 'Sound is off', () => { sound = !sound; localStorage.setItem('bj-sound', sound ? 'on' : 'off'); $('#settings').onclick(); }],
  ['Restart level', start]
]);
$('#undo').onclick = () => {
  if (paused || !boosts.undo) return;
  const box = [...waiting].reverse().find(b => !b.reserved);
  if (!box) { toast('Only an empty box can come back'); return; }
  jamAcknowledged = false; boosts.undo--; waiting = waiting.filter(b => b !== box); box.status = 'queue';
  boxes.splice(boxes.indexOf(box), 1); boxes.unshift(box); layoutQueue(); update(); toast('Back to the shelf!');
};
$('#shuffle').onclick = () => {
  if (paused || !boosts.shuffle) return;
  const queue = boxes.filter(b => b.status === 'queue');
  if (queue.length < 2) { toast('No boxes left to shuffle'); return; }
  boosts.shuffle--;
  // Prioritize currently exposed colors with a stable order for equal matches.
  const front = lanes.map(lane => lane.cans[0]?.color);
  queue.sort((a, b) => Number(front.includes(b.color)) - Number(front.includes(a.color)));
  boxes = [...boxes.filter(b => b.status !== 'queue'), ...queue];
  layoutQueue(); update(); toast('Fresh matches coming up!'); beep(650);
};
$('#extra').onclick = () => {
  if (paused || !boosts.extra) return;
  jamAcknowledged = false; boosts.extra--; slotMax++; makeSlots(); layoutQueue();
  waiting.forEach(box => { if(box.target)box.target.x = slotX(box.slot); });
  update(); toast('A little more breathing room'); beep(750);
};
function resize() {
  const aspect = innerWidth / innerHeight;
  const span = Math.max(aspect > 1.1 ? 22.0 : 21.0, 10.3 / aspect);
  const distance=span/(2*Math.tan(camera.fov/2));
  camera.position.copyFrom(cameraTarget.add(cameraDirection.scale(distance)));camera.setTarget(cameraTarget);
  camera.orthoTop = span / 2; camera.orthoBottom = -span / 2;
  camera.orthoLeft = -span * aspect / 2; camera.orthoRight = span * aspect / 2;
  engine.resize(); scene.updateTransformMatrix(true); positionControls();
  const projectY = z => screenPosition(new B.Vector3(0,0,z)).y;
  $('#hint').style.top = `${projectY(1.2)}px`;
  $('#slots-label').style.top = `${projectY(2.20) - innerHeight / span * .58}px`;
}
window.addEventListener('resize', resize);
function frame(time) {
  
  const dt = Math.min((time - lastTime) / 1000, .04); lastTime = time;
  if (!paused) {
    tick += dt;
    if (tick > .19) { tick = 0; pack(); }
    for (const lane of lanes) for (const can of lane.cans) if (can.target) B.Vector3.LerpToRef(can.mesh.position,can.target,Math.min(1,dt*17),can.mesh.position);
    for (const box of boxes) {
      if (box.move) {
        box.move.t = Math.min(1, box.move.t + dt / .38);
        const t = box.move.t, e = t * t * (3 - 2 * t);
        B.Vector3.LerpToRef(box.move.from,box.target,e,box.mesh.position);
        box.mesh.position.y += 4*t*(1-t)*1.05;
        box.mesh.rotation.x = Math.sin(t * Math.PI) * -.18;
        if (t === 1) { box.move = null; box.mesh.rotation.x = 0; box.bounce = .85; beep(310); }
      } else if (box.target) {
        B.Vector3.LerpToRef(box.mesh.position,box.target,Math.min(1,dt*16),box.mesh.position);
        if (box.status === 'queue') box.mesh.position.y = box.target.y;
      }
      if(box.status==='queue'&&box.wantsOpen&&box.openAmount<1&&!box.move&&Math.hypot(box.mesh.position.x-box.target.x,box.mesh.position.z-box.target.z)<.035){
        box.openAmount=Math.min(1,(box.openAmount||0)+dt/.32);poseQueuedFlaps(box);
      }
      box.bounce = Math.max(0, box.bounce - dt * 4);
      const squash = Math.sin(box.bounce * Math.PI * 2) * box.bounce * .12;
      box.mesh.scaling.set(1 + squash, 1 - squash, 1 + squash);
      box.mesh.rotation.z = 0;
      if (box.status === 'closing') {
        box.closeTime += dt;
        for (const flap of box.mesh.metadata.flaps) {
          const t = B.Scalar.Clamp((box.closeTime - .025 - flap.delay) / .23, 0, 1);
          const e = t * t * (3 - 2 * t);
          flap.hinge.rotation[flap.axis] = B.Scalar.Lerp(flap.open, flap.closed, e);
        }
        if (box.closeTime > .37) {
          box.mesh.metadata.tape.setEnabled(true);
          box.mesh.metadata.tape.scaling.z = Math.min(1, (box.closeTime - .37) / .10);
        }
        if (box.closeTime > .57) {
          box.status = 'vanishing'; box.vanishTime = 0;
          burst(box.mesh.position,box.color); chime();
        }
      }
      if (box.status === 'vanishing') {
        box.vanishTime += dt;
        // A sealed carton gives a quick celebratory pop, then disappears in its slot.
        // Its position stays fixed throughout the completion animation.
        const pop = Math.sin(Math.min(1, box.vanishTime / .10) * Math.PI) * .12;
        const t = B.Scalar.Clamp((box.vanishTime - .10) / .12, 0, 1);
        const scale = (1 + pop) * (1 - t * t);
        box.mesh.scaling.setAll(Math.max(.001, scale));
        if (t === 1) {
          box.mesh.setEnabled(false); box.status = 'done';
          waiting = waiting.filter(b => b !== box); coins += 5; update(); pulse($('#coins'),1.2);
        }
      }
    }
    for (let i = flights.length - 1; i >= 0; i--) {
      const flight = flights[i]; flight.t += dt * 3.4;
      const t = Math.min(flight.t, 1), ease = t * t * (3 - 2 * t);
      // Target the actual moving carton so packing remains attached while slots shift.
      const local = new B.Vector3((flight.index % 2 - .5) * .40, .13, (Math.floor(flight.index / 2) - .5) * .40);
      flight.box.mesh.computeWorldMatrix(true); B.Vector3.TransformCoordinatesToRef(local,flight.box.mesh.getWorldMatrix(),flight.to);
      B.Vector3.LerpToRef(flight.from,flight.to,ease,flight.mesh.position);
      flight.mesh.position.y += Math.sin(t * Math.PI) * (1.05 + flight.index * .045);
      flight.mesh.rotation.z = Math.sin(t * Math.PI) * .13;
      flight.mesh.rotation.x = Math.sin(t * Math.PI) * -.22;
      const flightScale=1-t*.32, stretch=Math.sin(t*Math.PI)*.13;
      flight.mesh.scaling.set(flightScale*(1-stretch*.5),flightScale*(1+stretch),flightScale*(1-stretch*.5));
      if (t >= 1) {
        flights.splice(i, 1); const box = flight.box;
        flight.mesh.rotation.set(0,0,0); flight.mesh.parent=box.mesh;
        flight.mesh.position.copyFrom(local);flight.mesh.scaling.setAll(.68);
        flight.mesh.metadata.landedAt=performance.now();
        box.count++; box.bounce = .85; burst(box.mesh.position,box.color,4); pulse($('.progress'),1.035); packed++; updateBoxBadge(box); beep(500 + box.count * 65);
        if (box.count === boxCapacity) {
          box.status = 'closing'; box.closeTime = 0; box.target = null; box.move = null;
        }
        update();

      }
    }
    for (const box of boxes) for(const piece of box.mesh.getChildren()) {
      if(!piece.metadata?.landedAt) continue;
      const t=Math.min(1,(time-piece.metadata.landedAt)/180);
      const bounce=Math.sin(t*Math.PI)*.10*(1-t);
      piece.position.y=.13+bounce;piece.scaling.set(.68+bounce*.35,.68-bounce*.5,.68+bounce*.35);
      if(t===1) delete piece.metadata.landedAt;
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i]; particle.life -= dt; particle.v.y -= dt * 5;
      particle.mesh.position.addInPlace(particle.v.scale(dt)); particle.mesh.rotation.x += dt * 5;
      particle.mesh.rotation.z += dt * 3;
      particle.mesh.scaling.setAll(Math.max(.001,Math.min(1,particle.life/.16)));
      if (particle.life <= 0) { particle.mesh.dispose(false,false); particles.splice(i, 1); }
    }
    if (packed === total && !ended && !boxes.some(b => b.status === 'closing' || b.status === 'vanishing')) {
      ended = true;
      modal('Level complete!', `All cans packed. You earned ${total / boxCapacity * 5} coins!`, '★', [
        ['Next level →', () => { level++; localStorage.setItem('bj-level', level); start(); }], ['Play again', start]
      ]);
    }
    positionControls();
  }
  scene.render();
}
start(); engine.runRenderLoop(()=>frame(performance.now()));
