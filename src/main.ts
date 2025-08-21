import { createNoise2D } from './noise';
import type { Camera, Explosion, Hole, Missile, Player, Position, Raycast, Tracer, Tunnel } from './types';
import { WEAPONS } from './data';
import './styles.css';

// Constants.
const HALF_PI = Math.PI / 2;
const SEED = Math.random() * 100000;
const WORLD_SIZE = 4000;
const WORLD_SCALE = 0.00075;
const NOISE_AMPLITUDE = 600;
const AIR_RESISTANCE = 0.002;
const PLAYER_GRAVITY = 0.002;
const MISSILE_GRAVITY = 0.001;

// Noise function.
const simplex = createNoise2D();

// Viewport dimensions.
const vw = innerWidth;
const vh = innerHeight;
const ground = vh * 0.6;

// Keep track of the holes and tunnels in the terrain.
const holes: Hole[] = [];

// Initialise the svg size to match the viewport.
const svg = initSvg();

// Create the terrain layers.
const heights = initTerrain();

// ================================================================================================
// ======== EVENTS ================================================================================
// ================================================================================================

const keys = new Set<string>();
const mouse = { x: 0, y: 0 };

// Keep track of the mouse position.
addEventListener('mousemove', (event) => {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
});

// Fire targeted weapons on mouse click.
addEventListener('mousedown', () => {
  if (WEAPONS[activeWeapon].target) {
    fireWeapon();
  }
})

// Keep track of which keyboard buttons are pressed.
addEventListener('keydown', (event) => {
  keys.add(event.code);

  if (event.code === 'ShiftLeft') {
    activateNextPlayer();
  }

  if (event.code === 'ShiftRight') {
    activateNextTeam();
  }
});

// Keep track of which keyboard buttons are released.
addEventListener('keyup', (event) => {
  keys.delete(event.code);
});

// ================================================================================================
// ======== GAME LOOP =============================================================================
// ================================================================================================

// Start the main game loop.
let time = 0;
requestAnimationFrame(tick);

/**
 * Update the game state (and push render changes to the DOM).
 */
function tick(t: number): void {
  requestAnimationFrame(tick);

  const delta = t - time;
  time = t;

  updatePlayers(delta);
  updateCrosshairs(delta);
  updatePowerbar(delta);
  updateExplosions(delta);
  updateTracers(delta);
  updateWeapons();
  updateMissiles(delta);
  updateCamera(delta);
  updateWind();
}

// ================================================================================================
// ======== ENVIRONMENT ===========================================================================
// ================================================================================================

const windleft = document.getElementById('windleft')!;
const windright = document.getElementById('windright')!;

let windSpeed = 0;

/**
 * Randomise the wind speed, called at the beginning of each turn.
 */
function randomiseWind() {
  const dir = Math.random() < 0.5 ? 1 : -1;
  windSpeed = clamp(Math.pow(Math.random(), 1.8) + 0.1, 0.1, 0.9) * dir;
}

/**
 * Update the UI to show the current wind direction.
 */
function updateWind() {
  windleft.style.width = clamp((1 + windSpeed) * 200, 0, 200) + 'px';
  windright.style.width = clamp((1 - windSpeed) * 200, 0, 200) + 'px';
}

// ================================================================================================
// ======== PLAYERS ===============================================================================
// ================================================================================================

// Various player and UI element.
const playersContainer = document.getElementById('players')!;
const crosshairs = document.getElementById('crosshairs')!;
const powerbar = document.getElementById('powerbar')!;
const powerbarMask = document.getElementById('powerbar-power')!;

// Create a series of players, 4 for each team.
const players: Player[] = initPlayers();
let activePlayer = 0;
let activeTeam = 0;

/**
 * Initial two teams of players, four on each team.
 */
function initPlayers(): Player[] {
  const players: Player[] = [];

  for (let i = 0; i < 8; i++) {
    players.push(initPlayer(i));
  }

  return players;
}

/**
 * Initialise the player sprite, setting the position based on the terrain heights.
 */
function initPlayer(i: number): Player {
  const team = i % 2;
  const x1 = rng(i * 200, i * 200 + 200);
  const x =  team === 0 ? 100 + x1 : WORLD_SIZE - 100 - x1;
  const y = getTerrainHeight(x);
  const dir = Math.random() > 0.5 ? 1 : -1;

  const el = elemSVG('rect');
  transform(el, x, y - 10, 0);
  attrNS(el, 'x', '-10')
  attrNS(el, 'y', '-10');
  attrNS(el, 'width', '20');
  attrNS(el, 'height', '20');
  attrNS(el, 'rx', '2');
  attrNS(el, 'fill', team === 0 ? '#f0f' : '#0ff');
  attrNS(el, 'stroke', '#000');
  attrNS(el, 'stroke-width', '2');
  playersContainer.appendChild(el);

  return { x, y, dx: 0, dy: 0, r: 0, vr: 0, aim: 0, dir, power: 0, team, el };
}

/**
 * Update all of the players, ensuring they move as expected and all collision checks are applied.
 * For the active player, use the keyboard input to move the player too.
 */
function updatePlayers(delta: number) {
  for (let i = 0; i < players.length; i++) {
    updatePlayer(players[i], i === activePlayer, delta);
  }
}

/**
 * Update the velocity and position of a player, then check for collisions. Apply forces based on
 * user inputs, such as the arrow keys being pressed, but only if the player if the active one.
 */
function updatePlayer(player: Player, active: boolean, delta: number) {
  // Keyboard input.
  const horizontal = active ? +keys.has('KeyD') - +keys.has('KeyA') : 0;
  const jumping = active ? keys.has('Space') && player.onGround : false;

  player.r = active && keys.has('KeyJ') ? 1 : 0;

  // Update the velocity.
  player.dx = player.dx + (player.onGround ? horizontal * 0.1 : 0);
  player.dy = player.dy + (jumping ? -0.5 : 0);

  // Prevent the player from picking up too much speed when walking.
  if (player.onGround && !player.ragdoll) {
    player.dx = clamp(player.dx, -0.125, 0.125);
  }

  // Boost the player forwards when they jump.
  if (jumping) {
    player.dx += horizontal * 0.1;
  }

  // Apply ground friction.
  if (!jumping && player.onGround) {
    player.dx *= 0.5;
  }

  // Apply gravity.
  player.dy += delta * PLAYER_GRAVITY;

  // Update the position.
  player.x += player.dx * delta;
  player.y += player.dy * delta;

  // Reduce the angular velocity;
  player.vr = lerp(player.vr, 0, 0.01);
  player.r += player.vr * delta;

  // Align the player the correct way each time they bounce.
  if (player.onGround) {
    player.r = 0;
  }

  // Prevent micro-rotations.
  if (player.vr < 1) {
    player.vr = 0;
    player.ragdoll = false;
  }

  // Set the players direction based on the input.
  player.dir = horizontal === 0 ? player.dir : horizontal > 0 ? 1 : -1;

  // Check for collisions, and adjust the player as necessary.
  if (checkCollision(player.x, player.y)) {
    const dist = raycastUp(player.x, player.y);

    if (dist !== Infinity && dist > 0) {
      player.y -= dist;
      player.onGround = true;

      // The player should bounce when they have been blasted, rather than jumping.
      if (player.ragdoll) {
        player.dy = 0 - (player.dy * 0.5);
      } else {
        player.dy = 0;
      }
    }
  } else {
    player.onGround = false;
  }

  // Render the changes into the DOM.
  transform(player.el, player.x, player.y - 10, player.r);
}

/**
 * Update the position of the crosshairs based on the players position and the aim angle. Adjust 
 * the aim angle based on user inputs, such as the up/down arrow keys.
 */
function updateCrosshairs(delta: number) {
  if (WEAPONS[activeWeapon].aim) {
    const player = players[activePlayer];

    const vertical = +keys.has('KeyS') - +keys.has('KeyW');
    player.aim = clamp(player.aim + (vertical * delta * 0.001), -HALF_PI, HALF_PI);

    const [x, y] = rpos(player, 0, -10, 100);

    transform(crosshairs, x, y);
    transform(powerbar, player.x, player.y, player.aim);
    crosshairs.style.visibility = 'visible';
  } else {
    crosshairs.style.visibility = 'hidden';
  }
}

/**
 * Show the power meter when the user is firing a powered weapon. Adjust the power based on the
 * user's input.
 */
function updatePowerbar(delta: number) {
  const p = players[activePlayer];
  const w = WEAPONS[activeWeapon]

  if (!p.hasFired && w.aim) {
    const isFireKeyDown = keys.has('KeyP');

    if (w.power) {
      if (isFireKeyDown) {
        p.power = clamp(p.power + delta * 0.001, 0, 1);
      } else if (p.power > 0) {
        fireWeapon();
        p.hasFired = true;
        p.power = 0;
      }
    } else if (isFireKeyDown) {
      fireWeapon();
      p.hasFired = true;
    }
  }

  const [x, y] = rpos(p, 0, -10, 10);
  const width = p.power * 80;

  const angle = p.dir === 1
    ? p.aim * 180 / Math.PI
    : 180 - p.aim * 180 / Math.PI;

  transform(powerbar, x, y, angle);
  attrNS(powerbarMask, 'width', '' + width);
}

/**
 * Switch to the next player for the current team.
 */
function activateNextPlayer() {
  activePlayer = (activePlayer + 2) % players.length;
  unlockCamera();
}

/**
 * Switch to the next team, and select a random player from it.
 */
function activateNextTeam() {
  activeTeam = 1 - activeTeam;
  activePlayer = rng(0, 4) * 2 + activeTeam;
  activeWeapon = 0;
  unlockCamera();
  randomiseWind();
  resetPlayers();
}

/**
 * Reset all play flags, so that they can fire again.
 */
function resetPlayers() {
  for (const player of players) {
    player.hasFired = false;
  }
}

// ================================================================================================
// ======== EXPLOSIONS ============================================================================
// ================================================================================================

// List of active explosions.
const explosions: Explosion[] = [];

/*
 * Update the appearance of all active explosions, and remove the ones that have finished.
 */
function updateExplosions(delta: number) {
  let i = explosions.length;

  while (i--) {
    const e = explosions[i];

    e.ttl -= delta;
    e.el.style.opacity = e.ttl > 400 ? '1' : '' + (e.ttl / 400);
    e.el.style.setProperty('--s', '' + (((500 - e.ttl) / 2000) + 1));

    if (e.ttl <= 0) {
      e.el.remove();
      explosions.splice(i, 1);
    }
  }
}

/**
 * Add a new explosion effect.
 */
function addExplosion(x: number, y: number, r: number) {
  const el = document.getElementById('explosion')!.cloneNode(true) as HTMLElement;

  el.style.setProperty('--x', `${x}px`);
  el.style.setProperty('--y', `${y}px`);
  el.style.setProperty('--d', `${r * 2}px`);
  el.style.display = 'block';

  world.append(el);

  explosions.push({ x, y, el, ttl: 500 });
}

// ================================================================================================
// ======== WEAPONS ===============================================================================
// ================================================================================================

// Element that displays the name of the weapon.
const weaponLabel = document.getElementById('weapon')!;

// ID of the current active weapon.
let activeWeapon = 0;

/**
 * Update the UI, showing which weapon is selected.
 */
function updateWeapons() {
  for (const weapon of WEAPONS) {
    if (keys.has(weapon.key)) {
      activeWeapon = weapon.id;
    }
  }

  weaponLabel.innerText = WEAPONS[activeWeapon].label;
}

/**
 * Fire the active weapon.
 */
function fireWeapon() {
  switch (activeWeapon) {
    case 0: return fireBazooka();
    case 1: return fireShotgun();
    case 2: return fireUzi();
    case 3: return fireAirStrike();
  }
}

// ================================================================================================
// ======== WEAPON: BAZOOKA =======================================================================
// ================================================================================================

// Keep track of missiles.
const missiles: Missile[] = [];

/**
 * Update the velocity and position of any live missiles, then check for collisions. If a missile
 * collides with the terrain, create a blast, and remove it.
 */
function updateMissiles(delta: number) {
  let i = missiles.length;

  while (i--) {
    const m = missiles[i];

    // Apply gravity.
    m.dy += delta * MISSILE_GRAVITY;

    // Apply air resistance.
    m.dx *= 1 - AIR_RESISTANCE;
    m.dy *= 1 - AIR_RESISTANCE;

    // Apply wind factor.
    if (m.wind) {
      m.dx += windSpeed * 0.015;
    }

    // Update the position.
    m.x += m.dx * delta;
    m.y += m.dy * delta;

    // Angle of movement.
    const angle = Math.atan2(m.dy, m.dx) * 180 / Math.PI;

    // Render the changes into the DOM.
    transform(m.el, m.x, m.y, angle);

    // Check for collisions.
    if (checkCollision(m.x, m.y)) {
      explodeMissile(i);
    }
  }
}

/**
 * When the missile explodes, it creates a blast in the terrain, and it removed from the list and
 * from the DOM. Then, after a couple of seconds, the turn ends and we switch to the next team.
 */
function explodeMissile(i: number) {
  const m = missiles[i];

  addBlast(m.x, m.y, m.power);

  m.el.remove();
  missiles.splice(i, 1);

  if (missiles.length === 0) {
    setTimeout(() => {
      activateNextTeam();
      unlockCamera();
    }, 2000);
  }
}

/**
 * Launch a missile from the player's position, in the direction they are aiming, and with the
 * correct amount of power based on how long they held down the power button.
 */
function fireBazooka() {
  const player = players[activePlayer];

  const el = document.getElementById('missile')!.cloneNode(true) as Element;
  svg.appendChild(el);

  const x = player.x;
  const y = player.y - 10;

  const dx = Math.cos(player.aim) * player.power * 2 * player.dir;
  const dy = Math.sin(player.aim) * player.power * 2;

  const power = rng(60, 70);

  const missile: Missile = { x, y, dx, dy, power, el, wind: true };
  missiles.push(missile);
  lockCamera(missile);
}

/**
 * Drop a series of 5 missiles from the sky on a given location.
 */
async function fireAirStrike() {
  const p = players[activePlayer];
  const x = mouse.x + camera.x - vw / 2;
  const dx = p.x < x ? 0.2 : -0.2;
  const offset = p.x < x ? -150 : 150;

  lockCamera({ x, y: 0 });

  for (let i = 0; i < 5; i++) {
    await fireAirStrikeRound(x + ((i - 2.5) * 50) + offset, dx);
  }
}

/**
 * Drop a single missle from the sky.
 */
async function fireAirStrikeRound(x: number, dx: number): Promise<void> {
  return new Promise((resolve) => {
    const el = document.getElementById('missile')!.cloneNode(true) as Element;
    svg.appendChild(el);

    const dy = 0.2;

    const power = rng(40, 45);
    
    setTimeout(() => {
      const missile: Missile = { x, y: 0, dx, dy, power, el, wind: false };
      missiles.push(missile);
      resolve();
    }, 150);
  });
}

// ================================================================================================
// ======== WEAPON: SHOTGUN + UZI =================================================================
// ================================================================================================

// List of active tracer lines.
const tracers: Tracer[] = [];

/**
 * Update all tracer lines, and remove them once done with.
 */
function updateTracers(delta: number) {
  let i = tracers.length;

  while (i--) {
    const t = tracers[i];

    t.ttl -= delta;
    t.el.style.opacity = '' + (t.ttl / 50);

    if (t.ttl <= 0) {
      t.el.remove();
      tracers.splice(i, 1);
    }
  }
}

/**
 * Add a new tracer line, for a fired round.
 */
function addTracer(x1: number, y1: number, x2: number, y2: number) {
  const el = document.getElementById('tracer')!.cloneNode(true) as SVGLineElement;
  attrNS(el, 'x1', '' + x1);
  attrNS(el, 'y1', '' + y1);
  attrNS(el, 'x2', '' + x2);
  attrNS(el, 'y2', '' + y2);
  svg.appendChild(el);

  tracers.push({ el, ttl: 50 });
}

/**
 * Fire the shotgun, consisting of 2 high-powered rounds.
 */
function fireShotgun() {
  fireGun(1, [40, 45], 0.05, 1000);
}

/**
 * Fire the uzi, consisting of 10 low-powered rounds that sprad out more.
 */
function fireUzi() {
  fireGun(10, [15, 20], 0.1, 50);
}

/**
 * Fire a generic gun.
 */
async function fireGun(rounds: number, power: [number, number], spread: number, delay: number) {
  const player = players[activePlayer];

  const x = player.x;
  const y = player.y - 10;
  const angle = player.dir === 1 ? player.aim : Math.PI - player.aim;

  for (let i = 0; i < rounds; i++) {
    await fireRound(x, y, angle, power, spread, delay, i === 0);
  }

  setTimeout(() => {
    activateNextTeam();
    unlockCamera();
  }, 2000);
}

/**
 * Fire a single gun round.
 */
async function fireRound(x: number, y: number, angle: number, power: [number, number], spread: number, delay: number, lock: boolean): Promise<void> {
  return new Promise((resolve) => {
    const r = (Math.random() * spread * 2) - spread;
    const nx = Math.cos(angle + r);
    const ny = Math.sin(angle + r);
    const dist = raycastBrute(x, y, nx, ny);
  
    if (dist !== Infinity) {
      const tx = x + nx * dist;
      const ty = y + ny * dist;
  
      if (lock) {
        lockCamera({ x: tx, y: ty });
      }
  
      setTimeout(() => {
        addTracer(x, y, tx, ty);
        addBlast(tx, ty, rng(power[0], power[1]), activePlayer);
        resolve();
      }, lock ? 1000 : delay);
    } else {
      // TODO: Still play the firing animation.
      resolve();
    }
  });
}

// ================================================================================================
// ======== CAMERA ================================================================================
// ================================================================================================

// Viewport element, inside of which the svg is scrolled.
const viewport = document.getElementById('viewport')!;
const world = document.getElementById('world')!;

// Camera position, and object that it's locked to.
const camera: Camera = { x: players[0].x, to: players[0], free: false };

/**
 * Update the camera position, to track an object in the world.
 */
function updateCamera(delta: number) {
  const horizontal = +keys.has('ArrowRight') - +keys.has('ArrowLeft');

  const min = vw / 2;
  const max = WORLD_SIZE - min;

  // Allow free movement of the camera.
  if (horizontal !== 0) {
    if (!camera.free) {
      camera.free = true;
      camera.to = { x: camera.to.x, y: camera.to.y };
    }

    camera.to.x += horizontal * delta * 0.5;
    camera.to.x = clamp(camera.to.x, min, max);
  }

  console.log(camera.x, camera.to.x, min, max);

  camera.x = lerp(camera.x, clamp(camera.to.x, min, max), 0.0075 * delta);

  const cx = 0 - clamp(camera.x, min, max) + (vw / 2);

  viewport.style.setProperty('--cx', `${cx}px`);
}

/**
 * Lock the camera to the position of the given object.
 */
function lockCamera(to: Position) {
  camera.free = false;
  camera.to = to;
}

/**
 * Unlock the camera, so that it can revert back to following the player.
 */
function unlockCamera() {
  camera.free = false;
  camera.to = players[activePlayer];
}

// ================================================================================================
// ======== COLLISIONS ============================================================================
// ================================================================================================

/**
 * Check to see if a given point is inside of some terrain, taking into account the holes that have
 * been created by explosions.
 */
function checkCollision(x: number, y: number): boolean {
  // Check if the point is above the ground.
  if (y < getTerrainHeight(x)) {
    return false;
  }

  // Check if the point is over a hole.
  for (const hole of holes) {
    if (insideCircle(x, y, hole.x, hole.y, hole.r2)) {
      return false;
    }
  }

  return true;
}

/**
 * Cast a ray directly upwards, to find the distance to the nearest hole, or to the surface. This
 * will give us the distance back to the 'floor' for when the player falls through it.
 */
function raycastUp(x: number, y: number): number {
  let dist = Infinity;

  if (checkCollision(x, y)) {
    // Ray cast directly upwards.
    const ray: Raycast = { x, y, nx: 0, ny: -1 };

    // Distance to the nearest hole.
    let i = holes.length;
    while (i > 0) {
      i--;
      dist = Math.min(dist, distToHole(ray, holes[i]));
    }

    // Distance to the surface, if it hit no holes.
    dist = Math.min(dist, y - getTerrainHeight(x));
  }

  return dist;
}

/**
 * Walk along a line given direction, continuously checking for collisions until something solid
 * is encountered, or the edges of the world are reached.
 */
function raycastBrute(x: number, y: number, nx: number, ny: number): number {
  let dist = 1;
  let ix = x + nx;
  let iy = y + ny;

  while (true) {
    dist++;
    ix += nx;
    iy += ny;

    if (ix < 0 || ix > WORLD_SIZE || iy < 0 || iy > vh) {
      dist = Infinity;
      break;
    }

    if (checkCollision(ix, iy)) {
      break;
    }
  }

  return dist;
}

/**
 * Calculate the distance along a line (defined by the raycast) to the nearest intersection point
 * with a hole (blast).
 */
function distToHole(ray: Raycast, hole: Hole, inner = false): number {
  const vcx = ray.x - hole.x;
  const vcy = ray.y - hole.y;

  const v = -2 * (vcx * ray.nx + vcy * ray.ny);
  const dist = v - (Math.sqrt(v * v - 4 * (vcx * vcx + vcy * vcy - hole.r2)) * (inner ? -1 : 1));

  return isNaN(dist) || dist < 0 ? Infinity : dist / 2;
}

/**
 * Determine if a given point is inside of a polygon.
 */
// function insidePolygon(x: number, y: number, vs: Vertex[]): boolean {
//   let inside = false;

//   for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
//     const [xi, yi] = vs[i];
//     const [xj, yj] = vs[j];

//     const intersect = ((yi > y) !== (yj > y))
//       && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

//     if (intersect) {
//       inside = !inside;
//     }
//   }

//   return inside;
// }

/**
 * Determine if a given point is inside of a circle.
 */
function insideCircle(x: number, y: number, cx: number, cy: number, r2: number): boolean {
  return sqdist(x, y, cx, cy) < r2;
}

// ================================================================================================
// ======== TERRAIN ===============================================================================
// ================================================================================================

// Setup the mask layers.
// const maskBackground = initMask('background');
const maskSoilLight = initMask('soil-light');
const maskSoilDark = initMask('soil-dark');
const maskGrassLight = initMask('grass-light');
const maskGrassDark = initMask('grass-dark');

// Randomise the seed of the soil texture.
initSoilTexture();

/**
 * Initialise all of the terrain layers.
 * Generate noise-based heights for the terrain across the x-axis.
 */
function initTerrain() {
  const heights: number[] = [];

  for (let i = 0; i < WORLD_SIZE + 10; i += 10) {
    heights.push(noise(i, 5, WORLD_SCALE, 0.4) * NOISE_AMPLITUDE);
  }

  initTerrainLayer('background', 10, heights);
  initTerrainLayer('grass-light', 0, heights);
  initTerrainLayer('grass-dark', 0, heights);
  initTerrainLayer('soil-light', 35, heights);
  initTerrainLayer('soil-dark', 20, heights);
  initSky();

  return heights;
}

/**
 * Initialise a terrain layer.
 */
function initTerrainLayer(id: string, offset: number, heights: number[]): HTMLElement {
  // Ground position.
  const g = ground + offset;

  // Start on the left.
  let d = `M0,${g + heights[0]} `;

  // Create points along the x-axis.
  for (let i = 1; i < heights.length; i++) {
    d += `L${i * 10},${g + heights[i]} `;
  }

  // Bring the shape back round the start.
  d += `L${WORLD_SIZE},${vh + 10} L-10,${vh + 10} Z`;

  const layer = document.getElementById(id)!;
  attr(layer, 'd', d);
  return layer;
}

/**
 * Initialise a mask layer.
 */
function initMask(id: string): HTMLElement {
  const layer = document.getElementById('mask-' + id)!;
  const path = elemSVG('path');
  attrNS(path, 'd', `M-10,0 L${WORLD_SIZE},0 L${WORLD_SIZE},${vh + 10} L-10,${vh + 10} Z`);
  attrNS(path, 'fill', 'white');
  layer.appendChild(path);
  return layer;
}

/**
 * Initialise the soil texture, by setting the 'seed' attribute on the turbulence filter element.
 */
function initSoilTexture() {
  attrNS(document.getElementById('soil-noise')!, 'seed', '' + SEED);
}

/**
 * Initialise the background sky layer.
 */
function initSky() {
  attr(document.getElementById('sky')!, 'd', `M0,0 L${WORLD_SIZE},0 L${WORLD_SIZE},${vh} L0,${vh} Z`);
}

/**
 * Get the height of the terrain at a given point, which is used for collision checks and also when
 * raycasting.
 */
function getTerrainHeight(x: number): number {
  const j = Math.floor(x / 10);
  const g1 = ground + heights[j];
  const g2 = ground + heights[j + 1];
  const k = (x / 10) - j;
  return lerp(g1, g2, k) + 2;
}

/**
 * Punch a hole through the various layer of terrain.
 */
function addBlast(x: number, y: number, r: number, ignorePlayer?: number) {
  // addHole(maskBackground, x, y, r - 20);
  addHole(maskSoilLight, x, y, r + 10);
  addHole(maskSoilDark, x, y, r);
  addHole(maskGrassLight, x, y, r + 10);
  addHole(maskGrassDark, x, y, r);

  addExplosion(x, y, r * 0.9);

  holes.push({ x, y, r, r2: r * r });

  const r2 = Math.pow(r * 1.5, 2);

  for (let i = 0; i < players.length; i++) {
    if (ignorePlayer === i) {
      continue;
    }

    const p = players[i];
    const d2 = sqdist(x, y, p.x, p.y);

    if (d2 < r2) {
      const power = Math.log2((1 - (d2 / r2)) * r);
      const angle = Math.atan2(p.y - y, p.x - x);

      p.ragdoll = true;
      p.dx = Math.cos(angle) * power * 0.2;
      p.dy = Math.sin(angle) * power * 0.2 - 0.5;
      p.vr = Math.max(10, power * 10 * p.dir);
    }
  }
}

/**
 * Punch a hole through a single layer of terrain.
 */
function addHole(layer: HTMLElement, x: number, y: number, r: number) {
  const circle = elemSVG('circle');
  attrNS(circle, 'cx', '' + x);
  attrNS(circle, 'cy', '' + y);
  attrNS(circle, 'r', '' + r);
  attrNS(circle, 'fill', 'black');
  attrNS(circle, 'filter', 'url(#wobble)');
  layer.appendChild(circle);
}

// ================================================================================================
// ======== INITIALISATION ========================================================================
// ================================================================================================

/**
 * Initialise the primary SVG wrapper.
 */
function initSvg(): HTMLElement {
  const svg = document.getElementById('svg')!;
  attr(svg, 'width', '' + WORLD_SIZE);
  attr(svg, 'height', '' + vh);
  return svg;
}

// ================================================================================================
// ======== UTILITIES =============================================================================
// ================================================================================================

/**
 * Generate a random integer between "a" (inclusive) and "b" (exclusive).
 */
function rng(a: number, b: number): number {
  return Math.floor(a + (Math.random() * (b - a)));
}

/**
 * Calculate the squared distance between 2 points.
 */
function sqdist(x1: number, y1: number, x2: number, y2: number): number {
  return ((x1 - x2) * (x1 - x2)) + ((y1 - y2) * (y1 - y2));
}

/**
 * Linear interpolation between two values.
 */
function lerp(x: number, y: number, a: number): number {
  return x * (1 - a) + y * a;
}

/**
 * Clamp a number to within a given range.
 */
function clamp(a: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, a));
}

/**
 * Generate a simplex-based noise value.
 */
function noise(x: number, iterations: number, scale: number, persistence: number): number {
  let result = 0;
  let amplitude = 1;
  let frequency = scale;
  let max = 0;

  for (let i = 0; i < iterations; i++) {
    result += simplex((x + 1000) * frequency, 0) * amplitude;
    max += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return result / max;
}

/**
 * Calculate a position relative to the player, based on the direction and aim.
 */
function rpos(p: Player, ox: number, oy: number, dist: number): [number, number] {
  return [
    p.x + ox + Math.cos(p.aim) * dist * p.dir,
    p.y + oy + Math.sin(p.aim) * dist,
  ];
}

// ================================================================================================
// ======== DOM STUFF =============================================================================
// ================================================================================================

/**
 * Set an attribute on an element.
 */
function attr(element: Element, name: string, value: string) {
  element.setAttribute(name, value);
}

/**
 * Set an attribute on aa namespaced (SVG) element.
 */
function attrNS(element: Element, name: string, value: string) {
  element.setAttributeNS(null, name, value);
}

/**
 * Create a new SVG element.
 */
function elemSVG(tag: string): SVGElement {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

/**
 * 
 */
function transform(el: Element, x: number, y: number, angle: number = 0) {
  attr(el, 'transform', `translate(${x} ${y}) rotate(${angle})`);
}