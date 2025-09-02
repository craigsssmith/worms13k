import { createNoise2D } from './noise';
import type { Camera, Dynamite, Explosion, Grenade, Hole, Missile, Player, Position, Raycast, Tracer, Tunnel, Vector } from './types';
import { ANIMATIONS, WEAPONS } from './data';
import { zzfx } from './zzfx';
import './styles.css';

// Shortcuts.
const docElemById = document.getElementById.bind(document);

// Elements.
const ID_PLAYERS = 'players';
const ID_CROSSHAIRS = 'crosshairs';
const ID_POWERBAR = 'pb';
const ID_POWERBAR_MASK = 'pb-mask';

// Constants.
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
const HALF_PI = Math.PI / 2;
// const SEED = Math.random() * 100000;
const WORLD_SIZE = 8000;
const OCEAN_SIZE = 10000;
const WORLD_SCALE = 0.00075;
const NOISE_AMPLITUDE = 1000;
const AIR_RESISTANCE = 0.002;
const PLAYER_GRAVITY = 0.002;
const MISSILE_GRAVITY = 0.001;

// Noise function.
const simplex = createNoise2D();

// Viewport dimensions.
const vw = innerWidth;
const vh = innerHeight;
const ground = vh * 1.5;

// Viewport element, inside of which the svg is scrolled.
const viewport = docElemById('viewport')!;
const world = docElemById('world')!;
const particles = docElemById('particles')!;
const glyph = docElemById('glyph')! as HTMLElement;

// Keep track of the holes and tunnels in the terrain.
const holes: Hole[] = [];

// Initialise the svg size to match the viewport.
const svg = initSvg();

// Create the terrain layers.
const heights: number[] = [];

// Mask layers, for terrain destruction.
let masks: HTMLElement[] = [];

// Has the game started.
let started = false;

// Various player and UI element.
const playersContainer = docElemById(ID_PLAYERS)!;
const crosshairs = docElemById(ID_CROSSHAIRS)!;
const powerbar = docElemById(ID_POWERBAR)!;
const powerbarMask = docElemById(ID_POWERBAR_MASK)!;
const windleft = docElemById('windleft')!;
const windright = docElemById('windright')!;
const weaponLabel = docElemById('weaponLabel')!;
const weapons = docElemById('weapons')!;
const objects = docElemById('objects')!;

// Create a series of players, 4 for each team.
const players: Player[] = [];
let activePlayer = 0;
let activeTeam = 0;
let activeWeapon = 0;

// Current wind state.
let windSpeed = 0;

// Various game objects.
const explosions: Explosion[] = [];
const missiles: Missile[] = [];
const tracers: Tracer[] = [];
const dynamites: Dynamite[] = [];
const grenades: Grenade[] = [];

// Camera position, and object that it's locked to.
const camera: Camera = {
  x: 0,
  to: { x: 0, y: 0 },
  free: false,
  ttl: 0,
};

// Initialise everything required for the title screen.
setTimeout(initGame);

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
addEventListener('mousedown', (event) => {
  if (WEAPONS[activeWeapon].target && event.clientY > 100) {
    fireWeapon();
  }
})

// Keep track of which keyboard buttons are pressed.
addEventListener('keydown', (event) => {
  if (started) {
    keys.add(event.code);
    keys.add(event.key);
  }

  switch (event.code) {
    case 'ShiftLeft':
      return activateNextPlayer();
    case 'ShiftRight':
      return activateNextTeam();
    case 'Space':
      return startGame();
  }
});

// Keep track of which keyboard buttons are released.
addEventListener('keyup', (event) => {
  keys.delete(event.code);
  keys.delete(event.key);
});

// Reload the 
addEventListener('resize', () => {
  location.reload();
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
  updateWeaponSelection();
  updateMissiles(delta);
  updateDynamites(delta);
  updateGrenades(delta);
  updateCamera(delta);
  updateWind();
}

/**
 * 
 */
function initGame(): void {
  initTerrain(true);
  initWeaponsUI();
}

/**
 * 
 */
function startGame(): void {
  if (!started) {
    initHeights();
    initTerrain(false);
    initPlayers();
    unlockCamera();
    document.body.classList.add('started');
    started = true;
  }
}

// ================================================================================================
// ======== ENVIRONMENT ===========================================================================
// ================================================================================================

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

/**
 * Initial two teams of players, four on each team.
 */
function initPlayers() {
  for (let i = 0; i < 8; i++) {
    const p = initPlayer(i);
    players.push(p);
    updatePlayerHealth(p);
  }
}

/**
 * Initialise the player sprite, setting the position based on the terrain heights.
 */
function initPlayer(i: number): Player {
  let x = -1;
  while (x === -1) {
    const cx = Math.random() * (WORLD_SIZE - 500) + 250;
    if (getTerrainHeight(cx) < vh - 110) {
      x = cx;
    }
  }

  const y = getTerrainHeight(x);
  const dir = Math.random() > 0.5 ? 1 : -1;

  const el1 = docElemById('player')!.cloneNode(true) as Element;
  playersContainer.appendChild(el1);

  const el2 = docElemById('hp')!.cloneNode(true) as HTMLElement;
  el2.style.setProperty('--c', i % 2 === 0 ? '#f0f' : '#0ff');
  world.append(el2);

  return { i, x, y, hp: 100, dx: 0, dy: 0, r: 0, vr: 0, aim: 0, dir, power: 0, team: i % 2, el1, el2, anim: 0 };
}

/**
 * Update all of the players, ensuring they move as expected and all collision checks are applied.
 * For the active player, use the keyboard input to move the player too.
 */
function updatePlayers(delta: number) {
  let i = players.length;

  for (let i = 0; i < players.length; i++) {
    updatePlayer(players[i], i === activePlayer, delta);
  }
}

/**
 * Update the velocity and position of a player, then check for collisions. Apply forces based on
 * user inputs, such as the arrow keys being pressed, but only if the player if the active one.
 */
function updatePlayer(p: Player, active: boolean, delta: number) {
  if (!p.gone) {
    // Keyboard input.
    const horizontal = active ? +keys.has('KeyD') - +keys.has('KeyA') : 0;
    const jumping = active ? keys.has('Space') && p.onGround : false;

    p.r = active && keys.has('KeyJ') ? 1 : 0;

    // Update the velocity.
    p.dx = p.dx + (p.onGround ? horizontal * 0.1 : 0);
    p.dy = p.dy + (jumping ? -0.5 : 0);

    // Prevent the player from picking up too much speed when walking.
    if (p.onGround && !p.ragdoll) {
      p.dx = clamp(p.dx, -0.125, 0.125);
    }

    // Boost the player forwards when they jump.
    if (jumping) {
      p.dx += horizontal * 0.1;
    }

    // Apply ground friction.
    if (!jumping && p.onGround) {
      p.dx *= 0.5;
    }

    // Play a jumping sound effect.
    if (jumping && p.onGround) {
      // console.log(zzfx);
      sfx(SFX_JUMP);
    }

    // Apply gravity.
    p.dy += delta * PLAYER_GRAVITY;

    // Update the position.
    p.x += p.dx * delta;
    p.y += p.dy * delta;

    // Reduce the angular velocity;
    p.vr = lerp(p.vr, 0, 0.01);
    p.r += p.vr * delta;

    // Align the player the correct way each time they bounce.
    if (p.onGround) {
      p.r = 0;
    }

    // Prevent micro-rotations.
    if (p.vr < 1) {
      p.vr = 0;
    }

    // Set the players direction based on the input.
    p.dir = horizontal === 0 ? p.dir : horizontal > 0 ? 1 : -1;

    // Check for collisions, and adjust the player as necessary.
    if (checkCollision(p.x, p.y)) {
      const [dist] = raycastUp(p.x, p.y);

      if (dist !== Infinity && dist > 0) {
        p.y -= dist;
        p.onGround = true;

        // The player should bounce when they have been blasted, rather than jumping.
        if (p.ragdoll) {
          p.dy = 0 - (p.dy * 0.5);
        } else {
          p.dy = 0;
        }
      }
    } else {
      p.onGround = false;
    }

    // If the player falls into the ocean, mark them as dead and gone immediately.
    if (p.y >= vh - 100) {
      killPlayer(p, false, true);
    }

    // Render the changes into the DOM.
    const scale = 0.75;
    const x = p.x - (p.dir * 32 * scale);
    const sx = p.dir * scale;
    transform(p.el1, x, p.y - 60 * scale, [p.r, 32 * sx, 32 * scale], [sx, scale]);

    // Switch to a different animation.
    const anim = horizontal ? 1 : 0;
    if (p.anim !== anim) {
      p.anim = anim;
      p.frame = 0;
      p.adt = 0;
      updatePlayerAnimation(p);
    }

    // Update animation frame.
    p.adt = (p.adt || 0) + delta;
    if (p.adt > 250) {
      p.adt -= 250;
      p.frame = (p.frame || 0) + 1;
      updatePlayerAnimation(p);
    }

    // Display the player's health.
    (p.el2 as HTMLElement).style.setProperty('--x', `${p.x}px`);
    (p.el2 as HTMLElement).style.setProperty('--y', `${p.y - 60}px`);
  } else {
    (p.el2 as HTMLElement).style.setProperty('--x', `-100px`);
  }
}

/**
 * Draw the next animation frame.
 */
function updatePlayerAnimation(p: Player) {
  const anim = ANIMATIONS[p.anim || 0];
  p.frame = (p.frame || 0) % anim.length;

  const frame = anim[p.frame];
  const children = [...p.el1.children];
  attrNS(children[0], 'd', frame[0]);
  attrNS(children[1], 'cx', '' + frame[1]);
  attrNS(children[2], 'cx', '' + frame[2]);
}

/**
 * 
 */
function updatePlayerHealth(p: Player) {
  text(p.el2, '' + p.hp);

  if (p.hp < 1 && !p.dead) {
    killPlayer(p, true, false);
  }
}

/**
 * Update the position of the crosshairs based on the players position and the aim angle. Adjust 
 * the aim angle based on user inputs, such as the up/down arrow keys.
 */
function updateCrosshairs(delta: number) {
  if (WEAPONS[activeWeapon].aim) {
    const p = players[activePlayer];

    if (p) {
      const vertical = +keys.has('KeyS') - +keys.has('KeyW');
      p.aim = clamp(p.aim + (vertical * delta * 0.001), -HALF_PI, HALF_PI);

      const [x, y] = rpos(p, 0, -10, 100);

      transform(powerbar, p.x, p.y, [p.aim, 0, 0]);
      showCrosshairs(x, y); 
    } else {
      hideCrosshairs();
    }
  }
}

function showCrosshairs(x: number, y: number) {
  transform(crosshairs, x, y);
  crosshairs.style.visibility = 'visible';
}

function hideCrosshairs() {
  crosshairs.style.visibility = 'hidden';
}

/**
 * Show the power meter when the user is firing a powered weapon. Adjust the power based on the
 * user's input.
 */
function updatePowerbar(delta: number) {
  const p = players[activePlayer];
  const w = WEAPONS[activeWeapon];

  let width = 0;

  if (p) {
    if (!p.hasFired && (w.aim || w.place)) {
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
    width = p.power * 80;

    const angle = p.dir === 1
      ? p.aim * 180 / Math.PI
      : 180 - p.aim * 180 / Math.PI;

    transform(powerbar, x, y, [angle, 0, 0]);
  }

  attrNS(powerbarMask, 'width', '' + width);
}

/**
 * Switch to the next player for the current team.
 */
function activateNextPlayer() {
  do {
    activePlayer = (activePlayer + 2) % players.length;
  } while (players[activePlayer].dead);

  unlockCamera();
}

/**
 * 
 */
function activateRandomPlayer() {
  activePlayer = rng(0, 4) * 2 + activeTeam;
  activateNextPlayer();
}

/**
 * Switch to the next team, and select a random player from it.
 */
function activateNextTeam() {
  // Determine how many players just died on the last turn, and therefore are about to explode.
  let count = 0;
  for (const p of players) {
    if (p.dead && !p.gone) {
      count++;
    }
  }

  // Only move to the next team if there are no players about to explode.
  if (count === 0) {
    activeWeapon = 0;
    activeTeam = 1 - activeTeam;
    activateRandomPlayer();
    updateWeaponUI();
    unlockCamera();
    randomiseWind();
    resetPlayers();
  }
}

/**
 * Reset all play flags, so that they can fire again.
 */
function resetPlayers() {
  for (const player of players) {
    player.hasFired = false;
    player.ragdoll = false;
  }
}

/**
 * 
 */
function killPlayer(p: Player, explode: boolean, immediately: boolean) {
  // Note: this timeout has to be 2001, so that it only fires AFTER the standard timeouts that
  // fire after weapons have completed their sequences, which is 2000.
  const timeout = immediately ? 0 : 2001;

  p.dead = true;
  
  setTimeout(() => {
    p.gone = true;

    attrNS(p.el1, 'opacity', '0');
    (p.el2 as HTMLElement).style.display = 'none';

    if (explode) {
      addBlast(p.x, p.y - 10, rng(60, 70), 1);
      sfx(SFX_EXPLOSION);
    }

    lockCamera(p);

    if (!immediately) {
      setTimeout(() => {
        activateNextTeam();
      }, timeout);
    }
  }, timeout);
}

// ================================================================================================
// ======== EXPLOSIONS ============================================================================
// ================================================================================================

/*
 * Update the appearance of all active explosions, and remove the ones that have finished.
 */
function updateExplosions(delta: number) {
  let i = explosions.length;

  while (i--) {
    const e = explosions[i];

    e.ttl -= delta;
    attrNS(e.el, 'opacity', e.ttl > 400 ? '1' : '' + (e.ttl / 400));
    attrNS(e.el, 'r', '' + (e.r * (((500 - e.ttl) / 1000) + 1)));

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
  const el = docElemById('explosion')!.cloneNode(true) as Element;

  attrNS(el, 'cx', '' + x);
  attrNS(el, 'cy', '' + y);
  attrNS(el, 'r', '' + r);

  particles.append(el);

  explosions.push({ x, y, r, el, ttl: 500 });
}

/**
 * 
 */
function addSmoke(x: number, y: number) {
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * 0.4 * i;
    const d = Math.random() * 5 + 5;
    addExplosion(x + Math.sin(a) * d, y + Math.cos(a) * d, rng(6, 9));
  }
}

// ================================================================================================
// ======== WEAPONS ===============================================================================
// ================================================================================================

/**
 * 
 */
function initWeaponsUI() {
  for (let i = 0; i < WEAPONS.length; i++) {
    const el = document.createElement('div');
    el.className = 'weapon';
    el.innerHTML = `<svg>${WEAPONS[i].icon}</svg>`;

    el.addEventListener('mousedown', function() {
      activeWeapon = i;
      updateWeaponUI();
    });

    weapons.append(el);
  }

  updateWeaponUI();
}

/**
 * 
 */
function updateWeaponUI() {
  text(weaponLabel, WEAPONS[activeWeapon].label);

  for (let i = 0; i < WEAPONS.length; i++) {
    weapons.children.item(i)?.classList.toggle('active', i === activeWeapon);
  }
}

/**
 * Update the UI, showing which weapon is selected.
 */
function updateWeaponSelection() {
  for (const weapon of WEAPONS) {
    if (keys.has(weapon.key)) {
      activeWeapon = weapon.id;
      updateWeaponUI();
      hideCrosshairs();
      break;
    }
  }
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
    case 4: return placeDynamite();
    case 5: return fireGrenade();
    case 6: return fireHolyHandGrenade();
    case 7: return fireMinigun();
  }
}

// ================================================================================================
// ======== WEAPON: BAZOOKA =======================================================================
// ================================================================================================

/**
 * Update the velocity and position of any live missiles, then check for collisions. If a missile
 * collides with the terrain, create a blast, and remove it.
 */
function updateMissiles(delta: number) {
  let i = missiles.length;

  while (i--) {
    const m = missiles[i];
    m.dt = (m.dt || 0) + delta;

    if (m.dt >= 30) {
      m.dt -= 30;
      addSmoke(m.x, m.y);
    }

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
    if (m.el) {
      transform(m.el, m.x, m.y, [angle, 0, 0]);
    }

    // Check for collisions.
    // There is no player with index of '999', so this will check against all players.
    if (checkCollision(m.x, m.y, 999)) {
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

  addBlast(m.x, m.y, m.power, 1.2);
  sfx(SFX_EXPLOSION);

  m.el?.remove();
  missiles.splice(i, 1);

  if (missiles.length === 0) {
    hideCrosshairs();

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

  const el = docElemById('missile')!.cloneNode(true) as Element;
  objects.appendChild(el);

  const dx = Math.cos(player.aim) * player.power * 2 * player.dir;
  const dy = Math.sin(player.aim) * player.power * 2;

  const x = player.x + (dx * 10);
  const y = player.y - 10 + (dy * 10);

  const power = rng(60, 70);

  const missile: Missile = { x, y, dx, dy, power, el, wind: true };
  missiles.push(missile);
  lockCamera(missile);

  sfx(SFX_SHOOT);
}

/**
 * Drop a series of 5 missiles from the sky on a given location.
 */
async function fireAirStrike() {
  const p = players[activePlayer];
  const x = mouse.x + camera.x - vw / 2;
  const dir = p.x < x ? 1 : -1;

  const dx = 0.2 * dir;

  lockCamera({ x, y: 0 });
  showCrosshairs(x, mouse.y);

  setTimeout(async () => {
    for (let i = 0; i < 5; i++) {
      const offset = ((i - 2.5) * 50 - 150) * dir;
      await fireAirStrikeRound(x + offset, dx);
    }
  }, 1000);
}

/**
 * Drop a single missle from the sky.
 */
async function fireAirStrikeRound(x: number, dx: number): Promise<void> {
  return new Promise((resolve) => {
    const el = docElemById('missile')!.cloneNode(true) as Element;
    objects.appendChild(el);

    const dy = 0.2;

    const power = rng(55, 65);
    
    setTimeout(() => {
      const missile: Missile = { x, y: -50, dx, dy, power, el, wind: false };
      missiles.push(missile);
      resolve();
    }, 150);
  });
}

/**
 * 
 */
function fireCharge(x: number, y: number, dx: number, dy: number, power: number) {
  missiles.push({ x, y, dx, dy, power, wind: false });
}

// ================================================================================================
// ======== WEAPON: SHOTGUN + UZI =================================================================
// ================================================================================================

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
  const el = docElemById('tracer')!.cloneNode(true) as SVGLineElement;
  attrNS(el, 'x1', '' + x1);
  attrNS(el, 'y1', '' + y1);
  attrNS(el, 'x2', '' + x2);
  attrNS(el, 'y2', '' + y2);
  objects.appendChild(el);

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
  fireGun(8, [12, 16], 0.1, 50);
}

/**
 * Fire the uzi, consisting of 10 low-powered rounds that sprad out more.
 */
function fireMinigun() {
  fireGun(30, [16, 20], 0.125, 40);
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
    const player = players[activePlayer];

    const r = (Math.random() * spread * 2) - spread;
    const nx = Math.cos(angle + r);
    const ny = Math.sin(angle + r);
    const dist = raycastBrute(x, y, nx, ny, player.i);
  
    if (dist !== Infinity) {
      const tx = x + nx * dist;
      const ty = y + ny * dist;
  
      if (lock) {
        lockCamera({ x: tx, y: ty });
      }
  
      setTimeout(() => {
        addTracer(x, y, tx, ty);
        addBlast(tx, ty, rng(power[0], power[1]), 0.25, activePlayer);
        resolve();
      }, lock ? 1000 : delay);
    } else {
      // TODO: Still play the firing animation.
      resolve();
    }
  });
}

// ================================================================================================
// ======== WEAPON: DYNAMITE ======================================================================
// ================================================================================================

/**
 * Update all sticks of dynamite, reducing their ttl, making them flash accordingly.
 */
function updateDynamites(delta: number) {
  let i = dynamites.length;

  while (i--) {
    const d = dynamites[i];
    d.ttl -= delta;

    // Flash between red and white.
    d.el.classList.toggle('flash', d.ttl < 2000 && !!(~~(d.ttl / 250) % 2));

    if (d.ttl <= 0) {
      explodeDynamite(i);
    }
  }
}

/**
 * Place a stick of dynamite at the player's location, then give them time to run away!
 */
function placeDynamite() {
  const p = players[activePlayer];

  const el = docElemById('dynamite')!.cloneNode(true) as Element;
  objects.appendChild(el);

  const x = p.x;
  const y = p.y - 5;

  transform(el, x, y, [Math.random() * 10 - 5, 0, 0]);

  const d: Dynamite = { x, y, el, ttl: 5000 };
  dynamites.push(d);
}

/**
 * Explode the dynamite, remove it from the game, and create a blast crater.
 */
function explodeDynamite(i: number) {
  const d = dynamites[i];

  addBlast(d.x, d.y, rng(90, 100), 2.4);
  sfx(SFX_EXPLOSION);

  d.el.remove();
  dynamites.splice(i, 1);

  setTimeout(activateNextTeam, 2000);
}

// ================================================================================================
// ======== WEAPON: DYNAMITE ======================================================================
// ================================================================================================

/**
 * 
 */
function updateGrenades(delta: number) {
  let i = grenades.length;

  while (i--) {
    const g = grenades[i];
    g.ttl -= delta;

    // Apply gravity.
    g.dy += delta * MISSILE_GRAVITY;

    // Update the position.
    g.x += g.dx * delta;
    g.y += g.dy * delta;

    // Render the changes into the DOM.
    transform(g.el, g.x, g.y);

    // Flash between black and white.
    g.el.classList.toggle('flash', g.ttl < 2000 && !!(~~(g.ttl / 250) % 2));

    // Check for collisions.
    if (checkCollision(g.x, g.y + 8)) {

      // Small puff if it's big bounce.
      if (magnitude([g.dx, g.dy]) > 0.4) {
        addSmoke(g.x, g.y);
      }

      // Bring the grenade back up to the surface.
      const [dist, type, payload] = raycastUp(g.x, g.y + 8);
      if (dist !== Infinity && dist > 0) {
        g.y -= dist;
      }

      // Surface vector (to be determined, based on the raycast result type.
      let surface: Vector = [1, 0];

      // Bounce off the terrain (type = 0)
      if (type === 0) {
        const j = Math.floor(g.x / 10);
        const g1: Vector = [j * 10, ground + heights[j]];
        const g2: Vector = [(j + 1) * 10, ground + heights[j + 1]];
        surface = subtract(g2, g1);
      }

      // Bounce off the inside of a hole (type = 1)
      if (type === 1) {
        const h = payload as Hole;
        surface = perpendicular(subtract([g.x, g.y], [h.x, h.y]));
      }

      // Reflect the grenade vector in the surface normal.
      const bounce = invert(reflect([g.dx, g.dy], surface));

      // Reduce the vector magnitude, so it can't bounce forever.
      g.dx = bounce[0] * 0.6;
      g.dy = bounce[1] * 0.6;
    }

    // Explode the grenade when the fuse has run down.
    if (g.ttl <= 0) {
      explodeGrenade(i);
    }
  }
}

/**
 * 
 */
function fireGrenade(holy = false) {
  const p = players[activePlayer];

  const id = holy ? 'holy' : 'grenade';
  const el = docElemById(id)!.cloneNode(true) as Element;
  objects.appendChild(el);

  const x = p.x;
  const y = p.y - 10;

  const dx = Math.cos(p.aim) * p.power * 1.25 * p.dir;
  const dy = Math.sin(p.aim) * p.power * 1.25;

  const power = rng(45, 55) * (holy ? 4 : 1);

  transform(el, x, y);

  const g: Grenade = { x, y, dx, dy, el, holy, power, ttl: 5000 };
  grenades.push(g);

  lockCamera(g);
}

/**
 * 
 */
function fireHolyHandGrenade() {
  fireGrenade(true);
}

/**
 * 
 */
function explodeGrenade(i: number) {
  const g = grenades[i];

  addBlast(g.x, g.y, g.power, 1.2);
  sfx(SFX_EXPLOSION);

  g.el.remove();
  grenades.splice(i, 1);

  if (g.holy) {
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      fireCharge(g.x, g.y, Math.sin(angle) / 2, Math.cos(angle) / 1.2, rng(70, 90));
    }
  } else {
    setTimeout(activateNextTeam, 2000);
  }
}

// ================================================================================================
// ======== CAMERA ================================================================================
// ================================================================================================

/**
 * Update the camera position, to track an object in the world.
 */
function updateCamera(delta: number) {
  // Keyboard scrolling.
  let horizontal = +keys.has('ArrowRight') - +keys.has('ArrowLeft');

  // Mouse scrolling.
  if (mouse.x > vw - 100) {
    horizontal = 1;
  } else if (mouse.x < 100) {
    horizontal = -1;
  }

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

  camera.x = lerp(camera.x, clamp(camera.to.x, min, max), 0.0075 * delta);
  camera.ttl = Math.max(camera.ttl - delta, 0);

  const base = 0 - clamp(camera.x, min, max) + (vw / 2);
  const shake = Math.sin(camera.ttl / 15) * (camera.ttl / 20);
  
  const cx = base + shake;
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

/**
 * 
 */
function shakeCamera() {
  camera.ttl = 500;
}

// ================================================================================================
// ======== COLLISIONS ============================================================================
// ================================================================================================

/**
 * Check to see if a given point is inside of some terrain, taking into account the holes that have
 * been created by explosions.
 */
function checkCollision(x: number, y: number, includePlayers = -1): boolean {
  // Check for collisions with players, other than the specified player.
  if (includePlayers >= 0) {
    for (const p of players) {
      if (p.i !== includePlayers) {
        const d2 = Math.pow(x - p.x, 2) + Math.pow(y - (p.y - 10), 2);
        if (d2 <= 120) {
          return true;
        }
      }
    }
  }

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
function raycastUp(x: number, y: number): [number, number, any] {
  let dist = Infinity;
  let type = -1;
  let payload = null;

  if (checkCollision(x, y)) {
    // Ray cast directly upwards.
    const ray: Raycast = { x, y, nx: 0, ny: -1 };

    // Distance to the nearest hole.
    let i = holes.length;
    while (i > 0) {
      i--;
      const d = distToHole(ray, holes[i]);
      if (d < dist) {
        dist = d;
        type = 1;
        payload = holes[i];
      }
    }

    // Distance to the surface, if it hit no holes.
    const d = y - getTerrainHeight(x);
    if (d < dist) {
      dist = d;
      type = 0;
    }
  }

  return [dist, type, payload];
}

/**
 * Walk along a line given direction, continuously checking for collisions until something solid
 * is encountered, or the edges of the world are reached.
 */
function raycastBrute(x: number, y: number, nx: number, ny: number, includePlayers = -1): number {
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

    if (checkCollision(ix, iy, includePlayers)) {
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

/**
 * 
 */
function initHeights() {
  for (let i = 0; i < WORLD_SIZE + 10; i += 10) {
    const base = 0 - Math.sin(i / WORLD_SIZE * Math.PI);
    const aux = Math.abs(noise(i, 5, WORLD_SCALE, 0.4));
    heights.push((base * NOISE_AMPLITUDE) - (aux * NOISE_AMPLITUDE / 2));
  }
}

/**
 * Initialise all of the terrain layers.
 * Generate noise-based heights for the terrain across the x-axis.
 */
function initTerrain(home = false) {
  initMasks(home);
  initTerrainLayer('l0', home, 10);
  initTerrainLayer('l1', home, 0);
  initTerrainLayer('l2', home, 0);
  initTerrainLayer('l3', home, 20);
  initTerrainLayer('l4', home, 35);
  initTerrainLayer('l5', home, 35);
  initSky();

  if (home) {
    initWater('w6', 0);
    initWater('w5', 20);
    initWater('w4', 40);
    initWater('w3', 60);
    initWater('w2', 80);
    initWater('w1', 100);

    addHoles(800, vh - 720, 80);
    addHoles(190, vh - 550, 80);
    addHoles(1470, vh - 420, 80);
  }
}

/**
 * Initialise a terrain layer.
 */
function initTerrainLayer(id: string, home = false, offset: number): HTMLElement {
  const layer = docElemById(id)!;
  layer.innerHTML = '';

  if (home) {
    const d = `M-10,${vh - 800} L${WORLD_SIZE},${vh - 800} L${WORLD_SIZE},${vh + 10} L-10,${vh + 10} Z`;
    attr(layer, 'd', d);
  } else {
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
    attr(layer, 'd', d);
  }

  return layer;
}

/**
 * 
 */
function initMasks(home = false) {
  masks = [];
  masks.push(initMask('m0', home, 10));
  masks.push(initMask('m1', home, 0));
  masks.push(initMask('m2', home, 0));
  masks.push(initMask('m3', home, 15));
  masks.push(initMask('m4', home, 25));
}

/**
 * Initialise a mask layer.
 */
function initMask(id: string, home = false, offset: number): HTMLElement {
  const layer = docElemById(id)!;
  
  const path = elemSVG('path');
  attrNS(path, 'd', `M-10,0 L${WORLD_SIZE},0 L${WORLD_SIZE},${vh + 10} L-10,${vh + 10} Z`);
  attrNS(path, 'fill', home ? 'black' : 'white');
  layer.appendChild(path);

  if (home) {
    const logo1 = docElemById('logo')!.cloneNode(true) as HTMLElement;
    attrNS(logo1, 'transform', `translate(180, ${vh - 720 + offset}) scale(4.5)`);
    layer.appendChild(logo1);

    const logo2 = docElemById('logo')!.cloneNode(true) as HTMLElement;
    attrNS(logo2, 'transform', `translate(180, ${vh - 690}) scale(4.5)`);
    layer.appendChild(logo2);
  }

  return layer;
}

/**
 * Initialise the size of the water layers.
 */
function initWater(id: string, offset: number) {
  const rect = docElemById(id)!;
  attrNS(rect, 'x', '' + (-offset * 2.7 + rng(-40, 0)));
  attrNS(rect, 'y', '' + (vh - 100 - offset));
  attrNS(rect, 'width', '' + OCEAN_SIZE);
}

/**
 * Initialise the background sky layer.
 */
function initSky() {
  attr(docElemById('sky')!, 'd', `M0,0 L${WORLD_SIZE},0 L${WORLD_SIZE},${vh} L0,${vh} Z`);
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
function addBlast(x: number, y: number, r: number, kb: number, ignorePlayer?: number) {
  addHoles(x, y, r);
  addExplosion(x, y, r * 0.9);
  shakeCamera();

  holes.push({ x, y, r, r2: r * r });

  const r2 = Math.pow(r * 1.5, 2);

  for (let i = 0; i < players.length; i++) {
    const p = players[i];

    if (ignorePlayer === i || p.dead) {
      continue;
    }

    const d2 = sqdist(x, y, p.x, p.y);

    if (d2 < r2) {
      const damage = (1 - (d2 / r2)) * r / 2;
      const force = Math.log2((1 - (d2 / r2)) * r) / 2;
      const angle = Math.atan2(p.y - y, p.x - x);

      p.ragdoll = true;
      p.dx = kb * (Math.cos(angle) * force * 0.2);
      p.dy = kb * (Math.sin(angle) * force * 0.2 - 0.2);
      p.vr = Math.max(10, force * 10 * p.dir);
      p.hp = Math.max(Math.floor(p.hp - damage), 0);

      updatePlayerHealth(p);
    }
  }
}

/**
 * Add holes through all layers of the terrain.
 */
function addHoles(x: number, y: number, r: number) {
  addHole(masks[0], x, y, Math.max(0, r - 20));
  addHole(masks[1], x, y, r);
  addHole(masks[2], x, y, r + 10);
  addHole(masks[3], x, y, r);
  addHole(masks[4], x, y, r + 10);
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
  layer.appendChild(circle);
}

// ================================================================================================
// ======== INITIALISATION ========================================================================
// ================================================================================================

/**
 * Initialise the primary SVG wrapper.
 */
function initSvg(): HTMLElement {
  const svg = docElemById('svg')!;
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
// ======== VECTORS ===============================================================================
// ================================================================================================

function reflect(v: Vector, n: Vector): Vector {
  const nn = normalize(n);
  return subtract(v, multiply(nn, 2 * dot(v, nn)));
}

function magnitude(v: Vector): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}

function normalize(v: Vector): Vector {
  const l = magnitude(v);
  return l === 0 ? v : [v[0] / l, v[1] / l];
}

function subtract(v1: Vector, v2: Vector): Vector {
  return [v1[0] - v2[0], v1[1] - v2[1]];
}

function multiply(v1: Vector, i: number): Vector {
  return [v1[0] * i, v1[1] * i];
}

function dot(v1: Vector, v2: Vector): number {
  return (v1[0] * v2[0]) + (v1[1] * v2[1]);
}

function invert(v: Vector): Vector {
  return [-v[0], -v[1]];
}

function perpendicular(v: Vector): Vector {
  return [-v[1], v[0]];
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
function attrNS(element: Element | null, name: string, value: string) {
  element?.setAttributeNS(null, name, value);
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
function transform(el: Element, x: number, y: number, angle: [number, number, number] = [0, 0, 0], scale: [number, number] = [1, 1]) {
  attr(el, 'transform', `translate(${x} ${y}) rotate(${angle[0]} ${angle[1]} ${angle[2]}) scale(${scale[0]} ${scale[1]})`);
}

// ================================================================================================
// ======== BITMAP TEXT ===========================================================================
// ================================================================================================

function text(el: Element, str: string) {
  el.innerHTML = '';
  
  for (let i = 0; i < str.length; i++) {
    const char = glyph.cloneNode() as HTMLElement;
    char.style.backgroundPositionX = `${0 - CHARS.indexOf(str[i]) * 14}px`;
    el.append(char);
  }
}

// ================================================================================================
// ======== SOUND EFFECTS =========================================================================
// ================================================================================================

const SFX_EXPLOSION = [1.5,,50,.08,.18,.36,4,2.9,-5,,,,,1.2,20,.6,.16,.4,.12,,1689];
const SFX_JUMP = [,,369,.02,.05,.09,1,1.5,2,157,,,,,,.1,,.72,,,926];
const SFX_SHOOT = [,,109,.02,.19,.07,2,.8,10,45,,,,.1,18,.2,,.86,.09];

function sfx(params: any[]) {
  zzfx(...params);
}
