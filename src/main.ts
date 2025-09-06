import { createNoise2D } from './noise';
import type { Camera, Dynamite, Elements, Explosion, Grenade, Hole, Missile, Player, Position, Raycast, Tracer, Tunnel, Vector } from './types';
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
const NAMES = 'ALICE|CLIVE|BORIS|RICHARD|MIKE|SARAH|PAULINE|HENRY'.split('|');
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 \'!';
const HALF_PI = Math.PI / 2;
const WORLD_SIZE = 8000;
const OCEAN_SIZE = 10000;
const WORLD_SCALE = 0.00075;
const NOISE_AMPLITUDE = 1000;
const AIR_RESISTANCE = 0.002;
const PLAYER_GRAVITY = 0.002;
const MISSILE_GRAVITY = 0.001;

// Sound effects.
const SFX_EXPLOSION = [1.5,,50,.08,.18,.36,4,2.9,-5,,,,,1.2,20,.6,.16,.4,.12,,1689];
const SFX_JUMP = [,,369,.02,.05,.09,1,1.5,2,157,,,,,,.1,,.72,,,926];
const SFX_SHOOT = [,,109,.02,.19,.07,2,.8,10,45,,,,.1,18,.2,,.86,.09];

// Noise function.
const rngf = splitmix32((Math.random() * 2 ** 32) >>> 0);
const simplex = createNoise2D(rngf);

// Time since the page load.
let time = 0;

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

// Create the terrain layers.
let heights: number[] = [];

// Mask layers, for terrain destruction.
let masks: HTMLElement[] = [];

// Has the game started.
let started = false;
let master = false;
let timeout: NodeJS.Timeout | null = null;

// Various player and UI element.
const playersContainer = docElemById(ID_PLAYERS)!;
const crosshairs = docElemById(ID_CROSSHAIRS)!;
const targetlock = docElemById('targetlock')!;
const powerbar = docElemById(ID_POWERBAR)!;
const powerbarMask = docElemById(ID_POWERBAR_MASK)!;
const windleft = docElemById('windleft')!;
const windright = docElemById('windright')!;
const weaponLabel = docElemById('weaponLabel')!;
const weapons = docElemById('weapons')!;
const objects = docElemById('objects')!;
const captions = docElemById('msg')!;

// Create a series of players, 4 for each team.
let players: Player[] = [];
let activePlayer = 0;
let activeTeam = 0;
let activeWeapon = 0;

// Current wind state.
let windSpeed = 0;

// Various game objects.
let explosions: Explosion[] = [];
let missiles: Map<number, Missile> = new Map();
let grenades: Map<number, Grenade> = new Map();
let dynamites: Map<number, Dynamite> = new Map();
let tracers: Tracer[] = [];

// Camera position, and object that it's locked to.
let camera: Camera = {
  x: 0,
  to: { x: 0, y: 0 },
  free: false,
  ttl: 0,
};

// DOM elements for game entities.
let destroyed: number[] = [];
let elements: Element[] = [];

// Initialise everything required for the title screen.
setTimeout(initGame);

// ================================================================================================
// ======== EVENTS ================================================================================
// ================================================================================================

const keys = new Set<string>();
const mouse = { x: 0, y: 0, over: false };

// Keep track of the mouse position.
addEventListener('mousemove', (event) => {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
});

// Fire targeted weapons on mouse click.
addEventListener('mousedown', (event) => {
  if (master && WEAPONS[activeWeapon].target && event.clientY > 100) {
    fireWeapon();
  }
});

// Keep track of which keyboard buttons are pressed.
addEventListener('keydown', (event) => {
  if (started) {
    keys.add(event.code);
    keys.add(event.key);
  }

  switch (event.code) {
    case 'KeyN':
      return activateNextPlayer();
    case 'Space':
      return startGame();
    case 'KeyK':
      return startMultiplayerGame();
    case 'KeyJ':
      return joinMultiplayerGame();
  }
});

// Keep track of which keyboard buttons are released.
addEventListener('keyup', (event) => {
  keys.delete(event.code);
  keys.delete(event.key);
});

// Reload the game if the window resizes. It's a hack, but all I have time for right now.
addEventListener('resize', () => {
  location.reload();
});

//
document.body.addEventListener('mouseenter', () => {
  mouse.over = true;
});

//
document.body.addEventListener('mouseleave', () => {
  mouse.over = false;
});

// ================================================================================================
// ======== GAME LOOP =============================================================================
// ================================================================================================

/**
 * Update the game state (and push render changes to the DOM).
 */
function tick(t: number) {
  requestAnimationFrame(tick);

  const delta = t - time;
  time = t;

  updatePlayers(delta);
  updateCrosshairs(delta);
  updatePowerbar(delta);
  updateExplosions(delta);
  updateTracers(delta);
  updateMissiles(delta);
  updateDynamites(delta);
  updateGrenades(delta);
  updateCamera(delta);
  updateWind();
  updateDestroyedElement();
  updateStateSync(delta);
  updateCaptions(delta);
}

/**
 * 
 */
function initGame() {
  initSvg();
  requestAnimationFrame(tick);
  initTerrain(true);
  initWeaponsUI();
}

/**
 * 
 */
function startGame() {
  if (!started) {
    initHeights();
    initTerrain(false);
    initPlayers();
    unlockCamera();
    document.body.classList.add('started');
    started = true;
    master = true;
  }
}

/**
 * 
 */
function startMultiplayerGame() {
  socketInit();
  startGame();
}

/**
 * 
 */
function joinMultiplayerGame() {
  socketInit();
  socketActionJoin();
}

/**
 * Join a game started by someone else.
 */
function joinGame() {
  if (!started) {
    initTerrain(false);
    unlockCamera();
    document.body.classList.add('started');
    started = true;
    master = false;
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
    text(getPlayerNameElement(p), NAMES[i]);
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

  return { id: getId(), i, x, y, hp: 100, dx: 0, dy: 0, ix: 0, jumping: false, r: 0, vr: 0, aim: 0, dir, power: 0, team: i % 2, anim: 0 };
}

/**
 * 
 */
function getPlayerElement(p: Player) {
  return getElement(playersContainer, 'player', p.id);
}

/**
 * 
 */
function getPlayerHealthElement(p: Player) {
  return getElement(world, 'hp', p.id + 1, (el: HTMLElement) => {
    el.style.setProperty('--c', p.team === 0 ? '#f0f' : '#0ff')
  });
}

/**
 * 
 */
function getPlayerNameElement(p: Player) {
  return getElement(world, 'hp', p.id + 2, (el: HTMLElement) => {
    el.style.setProperty('--c', p.team === 0 ? '#f0f' : '#0ff')
  });
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
function updatePlayer(p: Player, active: boolean, delta: number) {
  const el1 = getPlayerElement(p);
  const el2 = getPlayerHealthElement(p) as HTMLElement;
  const el3 = getPlayerNameElement(p) as HTMLElement;

  if (!p.gone) {
    // const horizontal = master && active ? +keys.has('KeyD') - +keys.has('KeyA') : 0;
    // const jumping = master && active ? keys.has('Space') && p.onGround : false;

    if (master) {

      // Keyboard input.
      p.ix = active ? +keys.has('KeyD') - +keys.has('KeyA') : 0;
      p.jumping = !!(active ? keys.has('Space') && p.onGround : false);

      // Update the velocity.
      p.dx = p.dx + (p.onGround ? p.ix * 0.1 : 0);
      p.dy = p.dy + (p.jumping ? -0.5 : 0);

      // Prevent the player from picking up too much speed when walking.
      if (p.onGround && !p.ragdoll) {
        p.dx = clamp(p.dx, -0.125, 0.125);
      }

      // Boost the player forwards when they jump.
      if (p.jumping) {
        p.dx += p.ix * 0.1;
      }

      // Apply ground friction.
      if (!p.jumping && p.onGround) {
        p.dx *= 0.5;
      }

      // Play a jumping sound effect.
      if (p.jumping && p.onGround) {
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
      p.dir = p.ix === 0 ? p.dir : p.ix > 0 ? 1 : -1;

      // Snap velocity to zero when it's very close.
      if (Math.abs(p.dx) < 0.01) {
        p.dx = 0;
      }

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
      if (master && p.y >= vh - 100) {
        killPlayer(p, false, true);
      }

      // Send the player data to connected clients.
      socketActionSyncPlayer(p);
    }

    // Render the changes into the DOM.
    const scale = 0.75;
    const x = p.x - (p.dir * 32 * scale);
    const sx = p.dir * scale;
    transform(el1, x, p.y - 60 * scale, [p.r, 32 * sx, 32 * scale], [sx, scale]);

    // Switch to a different animation.
    const anim = p.ix ? 1 : 0;
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
    el2.style.setProperty('--x', `${p.x}px`);
    el2.style.setProperty('--y', `${p.y - 60}px`);

    // Display the player's name tag.
    el3.style.setProperty('--x', `${p.x}px`);
    el3.style.setProperty('--y', `${p.y - 82}px`);
    
  } else {
    el2.style.setProperty('--x', `-100px`);
    el3.style.setProperty('--x', `-100px`);
  }
}

/**
 * Draw the next animation frame.
 */
function updatePlayerAnimation(p: Player) {
  const el1 = getPlayerElement(p);

  const anim = ANIMATIONS[p.anim || 0];
  p.frame = (p.frame || 0) % anim.length;

  const frame = anim[p.frame];
  const children = [...el1.children];
  attrNS(children[0], 'd', frame[0]);
  attrNS(children[1], 'cx', '' + frame[1]);
  attrNS(children[2], 'cx', '' + frame[2]);
}

/**
 * 
 */
function updatePlayerHealth(p: Player) {
  const el2 = getPlayerHealthElement(p);

  text(el2, '' + p.hp);

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
      if (master) {
        const vertical = +keys.has('KeyS') - +keys.has('KeyW');
        p.aim = clamp(p.aim + (vertical * delta * 0.001), -HALF_PI, HALF_PI);
      }

      const [x, y] = rpos(p, 0, -10, 150);

      transform(powerbar, p.x, p.y, [p.aim, 0, 0]);
      showCrosshairs(false, x, y); 
    } else {
      hideCrosshairs(false);
    }
  }
}

/**
 * Show the crosshairs at a specific position. This could either be based on the player's position
 * and aim direction, or at the mouse location (for air strikes).
 */
function showCrosshairs(lock: boolean, x: number, y: number) {
  transform(lock ? targetlock : crosshairs, x, y);
  (lock ? targetlock : crosshairs).style.visibility = 'visible';
}

/**
 * Hide the crosshairs graphic.
 */
function hideCrosshairs(lock: boolean) {
  (lock ? targetlock : crosshairs).style.visibility = 'hidden';
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
      if (master) {
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
    }

    const [x, y] = rpos(p, 0, -10, 40);
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
  if (master) {
    do {
      activePlayer = (activePlayer + 2) % players.length;
    } while (players[activePlayer].dead);
  }

  unlockCamera();
  socketActionGameState();
}

/**
 * 
 */
function activateRandomPlayer() {
  activePlayer = rngi(0, 4) * 2 + activeTeam;
  activateNextPlayer();
}

/**
 * Switch to the next team, and select a random player from it.
 */
function activateNextTeam() {
  if (master) {
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
      randomiseWind();
      resetPlayers();
      socketActionGameState();

      if (socket) {
        master = false;
        socketActionEndTurn();
      } else {
        caption(`TEAM ${activeTeam + 1} IT'S YOUR TURN`);
      }
    }
  }

  unlockCamera();
  updateWeaponUI();
}

/**
 * 
 */
function requestEndTurn() {
  if (master) {
    cancelEndTurn();
    timeout = setTimeout(activateNextTeam, 4000);
  }
}

/**
 * 
 */
function cancelEndTurn() {
  if (timeout) {
    clearTimeout(timeout);
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
  if (master) {
    socketActionKillPlayer(p, explode, immediately);
  }

  // Note: this timeout has to be 2001, so that it only fires AFTER the standard timeouts that
  // fire after weapons have completed their sequences, which is 2000.
  const timeout = immediately ? 0 : 2001;

  p.dead = true;
  
  setTimeout(() => {
    p.gone = true;

    const el1 = getPlayerElement(p);
    attrNS(el1, 'opacity', '0');

    const el2 = getPlayerHealthElement(p);
    (el2 as HTMLElement).style.display = 'none';

    if (explode) {
      caption(`GOOD BYE ${NAMES[p.i]}!`)
      sfx(SFX_EXPLOSION);

      if (master) {
        const id = getId();
        const r = rngi(60, 70);
        socketActionAddBlast(id, p.x, p.y - 10, r);
        addBlast(id, p.x, p.y - 10, r, 1);
      }
    } else {
      caption(`${NAMES[p.i]} IS SLEEPING WITH THE FISHES!`)
    }

    lockCamera(p);

    if (!immediately) {
      requestEndTurn();
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
    attrNS(e.el, 'r', '' + (e.r * (((500 - e.ttl) / 600) + 1)));

    if (e.ttl <= 0) {
      e.el.remove();
      explosions.splice(i, 1);
    }
  }
}

/**
 * Add a new explosion effect.
 */
function addExplosion(x: number, y: number, r: number, hue: number | false = false) {
  const el = docElemById('explosion')!.cloneNode(true) as Element;
  const fill = hue === false ? '#fff' : `hsl(${hue}, 100%, 50%)`;
  const ttl = hue === false ? 500 : 1000;

  attrNS(el, 'cx', '' + x);
  attrNS(el, 'cy', '' + y);
  attrNS(el, 'r', '' + r);

  attrNS(el, 'fill', fill);

  particles.append(el);

  explosions.push({ x, y, r, el, ttl });
}

/**
 * 
 */
function addSmoke(x: number, y: number, hue: number | false = false) {
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * 0.4 * i;
    const d = Math.random() * 5 + 5;
    addExplosion(x + Math.sin(a) * d, y + Math.cos(a) * d, rngi(6, 9), hue);
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
      if (master) {
        activeWeapon = i;
        socketActionGameState();
      }

      updateWeaponUI();
      hideCrosshairs(false);
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
 * Fire the active weapon.
 */
function fireWeapon() {
  const { id: pid, x, y, dir, aim, power } = players[activePlayer];
  const id = getId();
  const tx = mouse.x + camera.x - vw / 2;
  const ty = mouse.y;
  const seed = (Math.random() * 2 ** 32) >>> 0;

  switch (activeWeapon) {
    case 0: return fireMissile(id, x, y, dir, aim, power);
    case 1: return fireShotgun(id, x, y, dir, aim, seed);
    case 2: return fireUzi(id, x, y, dir, aim, seed);
    case 3: return fireAirStrike(id, x, tx, ty);
    case 4: return placeDynamite(id, x, y);
    case 5: return fireGrenade(id, x, y, dir, aim, power);
    case 6: return fireHolyHandGrenade(id, x, y, dir, aim, power);
    case 7: return fireMinigun(id, x, y, dir, aim, seed);
    case 8: return fireHomingMissile(id, x, y, dir, aim, power, tx, ty);
    case 9: return fireClusterBomb(id, x, y, dir, aim, power);
    case 10: return fireNyanCats(id, tx, ty, seed);
    case 11: return fireCricketBat(pid, x, y, dir, aim);
  }
}

// ================================================================================================
// ======== WEAPON: MISSILES ======================================================================
// ================================================================================================

/**
 * 
 */
function getMissileElement(m: Missile) {
  if (m.invis) {
    return null;
  }

  const type = m.nyan ? 'nyancat' : m.homing ? 'homing' : 'missile';
  return getElement(objects, type, m.id);
}

/**
 * Update the velocity and position of any live missiles, then check for collisions. If a missile
 * collides with the terrain, create a blast, and remove it.
 */
function updateMissiles(delta: number) {
  for (const [_, m] of missiles) {
    const el = getMissileElement(m);

    // Display a smoke trial.
    m.dt = (m.dt || 0) + delta;
    if (m.dt >= 30) {
      m.dt -= 30;
      addSmoke(m.x, m.y, m.nyan ? ((m.ttl || 0) / 10) % 360 : false);
    }

    m.ttl = (m.ttl || 0) + delta;

    // Non-homing missiles (and homing missiles for the first 500ms).
    if (m.ttl < 500 || !m.tx || !m.ty ) {
      // Apply gravity.
      if (m.grav) {
        m.dy += delta * MISSILE_GRAVITY;
      }

      // Apply air resistance.
      if (m.grav) {
        m.dx *= 1 - AIR_RESISTANCE;
        m.dy *= 1 - AIR_RESISTANCE;
      }

      // Apply wind factor.
      if (m.wind) {
        m.dx += windSpeed * 0.015;
      }
    }

    // Homing missiles locked on to their target.
    if (m.ttl > 500 && m.tx && m.ty) {
      const mag = magnitude([m.dx, m.dy]);
      const [nx, ny] = multiply(normalize([m.tx - m.x, m.ty - m.y]), mag * 1.02);
      const [dx, dy] = normalize([lerp(m.dx, nx, 0.05), lerp(m.dy, ny, 0.05)]);
      const mag2 = magnitude([dx, dy]);
      m.dx = dx * mag2;
      m.dy = dy * mag2;
    }
    
    // Update the position.
    m.x += m.dx * delta;
    m.y += m.dy * delta;

    // Sync position to clients.
    if (master) {
      socketActionSyncMissile(m.id, m.x, m.y, m.dx, m.dy);
    }

    // Check for collisions.
    // There is no player with index of '999', so this will check against all players.
    if (master && checkCollision(m.x, m.y, 999)) {
      socketActionRemoveMissile(m.id);
      explodeMissile(m);
    }

    // Render the changes into the DOM.
    if (el) {
      const angle = m.nyan ? 0 : Math.atan2(m.dy, m.dx);
      transform(el, m.x, m.y, [angle * 180 / Math.PI, 0, 0]);
    }
  }
}

/**
 * When the missile explodes, it creates a blast in the terrain, and it removed from the list and
 * from the DOM. Then, after a couple of seconds, the turn ends and we switch to the next team.
 */
function explodeMissile(m: Missile) {
  if (master) {
    const id = getId();
    socketActionAddBlast(id, m.x, m.y, m.power);
    addBlast(id, m.x, m.y, m.power, 1.2);
  }

  sfx(SFX_EXPLOSION);

  destroyed.push(m.id);
  missiles.delete(m.id);

  if (missiles.size === 0) {
    hideCrosshairs(true);
    requestEndTurn();
  }
}

/**
 * 
 */
function fireCharge(id: number, x: number, y: number, dx: number, dy: number, power: number) {
  if (master) {
    socketActionAddCharge(id, x, y, dx, dy, power);
  }

  missiles.set(id, { id, x, y, dx, dy, power, wind: false, grav: true, invis: true });
  cancelEndTurn();
}

/**
 * Launch a missile from the player's position, in the direction they are aiming, and with the
 * correct amount of power based on how long they held down the power button.
 */
function fireMissile(id: number, x: number, y: number, dir: number, aim: number, power: number) {
  if (master) {
    socketActionAddMissile(id, x, y, dir, aim, power);
  }

  const dx = Math.cos(aim) * power * 2 * dir;
  const dy = Math.sin(aim) * power * 2;

  const sx = x + (dx * 10);
  const sy = y - 10 + (dy * 10);

  const dmg = rngi(60, 70);

  const missile: Missile = { id, x: sx, y: sy, dx, dy, power: dmg, wind: true, grav: true };
  missiles.set(id, missile);
  lockCamera(missile);

  sfx(SFX_SHOOT);

  cancelEndTurn();
}

/**
 * 
 */
function fireHomingMissile(id: number, x: number, y: number, dir: number, aim: number, power: number, tx: number, ty: number) {
  const p = players[activePlayer];

  if (master) {
    socketActionAddHomingMissile(id, x, y, dir, aim, power, tx, ty);
  }

  if (power === 0) {
    // Phase 1, set a target.
    p.tx = tx;
    p.ty = ty;

    showCrosshairs(true, tx, ty);

  } else if (p.tx && p.ty) {
    // Phase 2, fire the missile.
    const dx = Math.cos(aim) * power * 2 * dir;
    const dy = Math.sin(aim) * power * 2;

    const sx = x + (dx * 10);
    const sy = y - 10 + (dy * 10);

    const dmg = rngi(60, 70);

    const missile: Missile = { id, x: sx, y: sy, dx, dy, power: dmg, tx: p.tx, ty: p.ty, homing: true };
    missiles.set(id, missile);
    lockCamera(missile);

    p.tx = p.ty = undefined;

    cancelEndTurn();
  }
}

/**
 * Drop a series of 5 missiles from the sky on a given location.
 */
async function fireAirStrike(id: number, x: number, tx: number, ty: number) {
  if (master) {
    socketActionAddAirStrike(id, x, tx, ty);
  }

  const dir = x < tx ? 1 : -1;
  const dx = 0.2 * dir;

  lockCamera({ x: tx, y: ty });
  showCrosshairs(true, tx, ty);

  setTimeout(async () => {
    for (let i = 0; i < 5; i++) {
      const offset = ((i - 2.5) * 50 - 150) * dir;
      await fireAirStrikeRound(id + i, tx + offset, dx);
    }
  }, 1000);
}

/**
 * Drop a single missle from the sky.
 */
async function fireAirStrikeRound(id: number, x: number, dx: number): Promise<void> {
  return new Promise((resolve) => {
    const dy = 0.2;

    const power = rngi(55, 65);
    
    setTimeout(() => {
      const missile: Missile = { id, x, y: -50, dx, dy, power, wind: false, grav: true };
      missiles.set(id, missile);

      cancelEndTurn();
      resolve();
    }, 150);
  });
}

/**
 * 
 */
async function fireNyanCats(id: number, tx: number, ty: number, seed: number) {
  if (master) {
    socketActionAddNyanCats(id, tx, ty, seed);
  }

  lockCamera({ x: tx, y: ty });
  showCrosshairs(true, tx, ty);

  const rng = splitmix32(seed);

  setTimeout(async () => {
    for (let i = 0; i < 5; i++) {
      const angle = Math.PI / 2 + (rng() * 0.5 - 0.25);
      const dx = Math.cos(angle) * 0.2;
      const dy = Math.sin(angle) * 0.2;

      await fireNyanCat(id + i, tx - dx * 100, -20, dx, dy);
    }
  }, 1000);
}

/**
 * 
 */
async function fireNyanCat(id: number, x: number, y: number, dx: number, dy: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const missile: Missile = { id, x, y, dx, dy, power: rngi(75, 90), wind: false, grav: false, nyan: true };
      missiles.set(id, missile);

      cancelEndTurn();
      resolve();
    }, 1250);
  });
}

// ================================================================================================
// ======== WEAPON: GUNS ==========================================================================
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
function fireShotgun(id: number, x: number, y: number, dir: number, aim: number, seed: number) {
  if (master) {
    socketActionAddShotgun(id, x, y, dir, aim, seed);
  }
  fireGun(id, x, y, dir, aim, seed, 1, [40, 45], 0.05, 1000);
}

/**
 * Fire the uzi, consisting of 10 low-powered rounds that sprad out more.
 */
function fireUzi(id: number, x: number, y: number, dir: number, aim: number, seed: number) {
  if (master) {
    socketActionAddUzi(id, x, y, dir, aim, seed);
  }
  fireGun(id, x, y, dir, aim, seed, 8, [12, 16], 0.1, 50);
}

/**
 * Fire the uzi, consisting of 10 low-powered rounds that sprad out more.
 */
function fireMinigun(id: number, x: number, y: number, dir: number, aim: number, seed: number) {
  if (master) {
    socketActionAddMinigun(id, x, y, dir, aim, seed);
  }
  fireGun(id, x, y, dir, aim, seed, 30, [16, 20], 0.125, 40);
}

/**
 * Fire a generic gun.
 */
async function fireGun(id: number, x: number, y: number, dir: number, aim: number, seed: number, rounds: number, power: [number, number], spread: number, delay: number) {
  const sx = x;
  const sy = y - 10;
  const angle = dir === 1 ? aim : Math.PI - aim;

  const rng = splitmix32(seed);

  for (let i = 0; i < rounds; i++) {
    const r = (rng() * spread * 2) - spread;
    await fireRound(id + i, sx, sy, angle + r, power, delay, i === 0);
  }

  requestEndTurn();
}

/**
 * Fire a single gun round.
 */
async function fireRound(id: number, x: number, y: number, angle: number, power: [number, number], delay: number, lock: boolean): Promise<void> {
  return new Promise((resolve) => {
    const player = players[activePlayer];

    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const dist = raycastBrute(x, y, nx, ny, player.i);
  
    if (dist !== Infinity) {
      const tx = x + nx * dist;
      const ty = y + ny * dist;
  
      if (lock) {
        lockCamera({ x: tx, y: ty });
      }
  
      setTimeout(() => {
        addTracer(x, y, tx, ty);

        if (master) {
          const dmg = rngi(power[0], power[1]);
          socketActionAddBlast(id, tx, ty, dmg);
          addBlast(id, tx, ty, dmg, 0.25, activePlayer);
        }

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
 * 
 */
function getDynamiteElement(d: Dynamite) {
  return getElement(objects, 'dynamite', d.id, (el) => {
    transform(el, d.x, d.y, [Math.random() * 10 - 5, 0, 0]);
  });
}

/**
 * Update all sticks of dynamite, reducing their ttl, making them flash accordingly.
 */
function updateDynamites(delta: number) {
  for (const [_, d] of dynamites) {
    const el = getDynamiteElement(d);

    d.ttl -= delta;

    // Flash between red and white.
    el.classList.toggle('flash', d.ttl < 2000 && !!(~~(d.ttl / 250) % 2));

    if (d.ttl <= 0) {
      explodeDynamite(d);
    }
  }
}

/**
 * Place a stick of dynamite at the player's location, then give them time to run away!
 */
function placeDynamite(id: number, x: number, y: number ) {
  if (master) {
    socketActionAddDynamite(id, x, y);
  }

  const sx = x;
  const sy = y - 5;

  const d: Dynamite = { id, x: sx, y: sy, dmg: rngi(90, 100), ttl: 5000 };
  dynamites.set(id, d);

  cancelEndTurn();
}

/**
 * Explode the dynamite, remove it from the game, and create a blast crater.
 */
function explodeDynamite(d: Dynamite) {
  const el = getDynamiteElement(d);

  if (master) {
    const id = getId();
    addBlast(id, d.x, d.y, d.dmg, 2.4);
    socketActionAddBlast(id, d.x, d.y, d.dmg);
  }

  sfx(SFX_EXPLOSION);

  el.remove();
  dynamites.delete(d.id);

  requestEndTurn();
}

// ================================================================================================
// ======== WEAPON: GRENADES ======================================================================
// ================================================================================================

/**
 * 
 */
function getGrenadeElement(g: Grenade) {
  const type = g.holy ? 'holy' : g.cluster ? 'clusterbomb' : 'grenade';

  return getElement(objects, type, g.id, (el) => {
    transform(el, g.x, g.y);
  });
}

/**
 * 
 */
function updateGrenades(delta: number) {
  for (const [_, g] of grenades) {
    const el = getGrenadeElement(g);

    g.ttl -= delta;

    // Apply gravity.
    g.dy += delta * MISSILE_GRAVITY;

    // Update the position.
    g.x += g.dx * delta;
    g.y += g.dy * delta;

    // Render the changes into the DOM.
    transform(el, g.x, g.y);

    // Flash between black and white.
    el.classList.toggle('flash', g.ttl < 2000 && !!(~~(g.ttl / 250) % 2));

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

    // Sync position to clients.
    if (master) {
      socketActionSyncGrenade(g.id, g.x, g.y, g.dx, g.dy);
    }

    // Explode the grenade when the fuse has run down.
    if (master && g.ttl <= 0) {
      socketActionRemoveGrenade(g.id);
      explodeGrenade(g);
    }
  }
}

/**
 * 
 */
function fireGrenade(id: number, x: number, y: number, dir: number, aim: number, power: number, holy = false, cluster = false) {
  if (master) {
    const fn = holy ? socketActionAddHolyHandGrenade : cluster ? socketActionAddClusterBomb : socketActionAddGrenade;
    fn(id, x, y, dir, aim, power);
  }

  const sx = x;
  const sy = y - 10;

  const dx = Math.cos(aim) * power * 1.25 * dir;
  const dy = Math.sin(aim) * power * 1.25;

  const dmg = rngi(45, 55) * (holy ? 4 : 1);

  const g: Grenade = { id, x: sx, y: sy, dx, dy, holy, cluster, power: dmg, ttl: 5000 };
  grenades.set(id, g);

  lockCamera(g);
  cancelEndTurn();
}

/**
 * 
 */
function fireHolyHandGrenade(id: number, x: number, y: number, dir: number, aim: number, power: number) {
  fireGrenade(id, x, y, dir, aim, power, true, false);
}

/**
 * 
 */
function fireClusterBomb(id: number, x: number, y: number, dir: number, aim: number, power: number) {
  fireGrenade(id, x, y, dir, aim, power, false, true);
}

/**
 * 
 */
function explodeGrenade(g: Grenade) {
  if (master) {
    const id = getId();
    socketActionAddBlast(id, g.x, g.y, g.power);
    addBlast(id, g.x, g.y, g.power, 1.2);
  }

  sfx(SFX_EXPLOSION);

  destroyed.push(g.id);
  grenades.delete(g.id);

  if (master) {
    const clusters = g.holy ? 10 : g.cluster ? 5 : 0;
    const power = g.holy ? rngi(70, 90) : g.cluster ? rngi(30, 40) : 0;

    for (let i = 0; i < clusters; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dx = Math.sin(angle) * 0.25;
      const dy = Math.cos(angle) * 0.25 - 0.5;
      fireCharge(g.id + i, g.x, g.y, dx, dy, power);
    }
  }

  requestEndTurn();
}

// ================================================================================================
// ======== MELEE WEAPONS =========================================================================
// ================================================================================================

/**
 * 
 */
function fireCricketBat(pid: number, x: number, y: number, dir: number, aim: number) {
  if (master) {
    socketActionAddCricketBat(pid, x, y, dir, aim);

    for (let i = 0; i < players.length; i++) {
      const p2 = players[i];

      if (pid === p2.id || p2.dead) {
        continue;
      }

      const d2 = sqdist(x, y, p2.x, p2.y);

      if (d2 < 2000) {
        const force = 1;

        p2.ragdoll = true;
        p2.dx = Math.cos(aim) * dir;
        p2.dy = Math.sin(aim);
        p2.vr = Math.max(20, 20 * p2.dir);
        p2.hp -= 15;

        updatePlayerHealth(p2);
        lockCamera(p2);
        requestEndTurn();
      }
    }
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
  if (mouse.over) {
    if (mouse.x > vw - 100) {
      horizontal = 1;
    } else if (mouse.x < 100) {
      horizontal = -1;
    }
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

  const target = clamp(camera.to.x, min, max);
  camera.x = lerp(camera.x, target, 0.0075 * delta);
  if (Math.abs(camera.x - target) < 0.1) {
    camera.x = target;
  }

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
    heights.push(Math.round((base * NOISE_AMPLITUDE) - (aux * NOISE_AMPLITUDE / 2)));
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
  attrNS(rect, 'x', '' + (-offset * 2.7 + rngi(-40, 0)));
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
function addBlast(_: number, x: number, y: number, r: number, kb: number, ignorePlayer?: number) {
  addHoles(x, y, r);
  addExplosion(x, y, r * 0.9);
  shakeCamera();

  holes.push({ x, y, r, r2: r * r });

  if (master) {
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
}

/**
 * Add holes through all layers of the terrain.
 */
function addHoles(x: number, y: number, r: number) {
  if (r > 50) {
    addHole(masks[0], x, y, r - 20);
  }

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
 * Create a random number generator function, using the 'splitmix32' algorithm.
 */
function splitmix32(a: number) {
  return function() {
    a |= 0;
    a = a + 0x9e3779b9 | 0;
    let t = a ^ a >>> 16;
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    return ((t = t ^ t >>> 15) >>> 0) / 4294967296;
  }
}

/**
 * Generate a random integer between "a" (inclusive) and "b" (exclusive).
 */
function rngi(a: number, b: number): number {
  return Math.floor(a + (rngf() * (b - a)));
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

/**
 * Reflect one vector around the normal of another vector, for bounces.
 */
function reflect(v: Vector, n: Vector): Vector {
  const nn = normalize(n);
  return subtract(v, multiply(nn, 2 * dot(v, nn)));
}

/**
 * Get the magnitude of a vector.
 */
function magnitude(v: Vector): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}

/**
 * Normalize a vector, giving it a length of 1.
 */
function normalize(v: Vector): Vector {
  const l = magnitude(v);
  return l === 0 ? v : [v[0] / l, v[1] / l];
}

/**
 * Find the difference between two vectors.
 */
function subtract(v1: Vector, v2: Vector): Vector {
  return [v1[0] - v2[0], v1[1] - v2[1]];
}

/**
 * Multiply a vector, increasing (or decreasing) its length.
 */
function multiply(v1: Vector, i: number): Vector {
  return [v1[0] * i, v1[1] * i];
}

/**
 * Find the dot-product of two vectors.
 */
function dot(v1: Vector, v2: Vector): number {
  return (v1[0] * v2[0]) + (v1[1] * v2[1]);
}

/**
 * Invert a vector.
 */
function invert(v: Vector): Vector {
  return [-v[0], -v[1]];
}

/**
 * Find the perpendicular vector for the given vector.
 */
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

/**
 * 
 */
function getElement<E extends Element>(container: HTMLElement, key: string, id: number, cb?: (element: E) => void): E {
  let el = elements[id] as E;

  if (!el) {
    el = docElemById(key)!.cloneNode(true) as E;
    cb?.(el);
    container.appendChild(el);
    elements[id] = el;
  }

  return el;
}

/**
 * 
 */
function getId(): number {
  return rngi(0, 999999999);
}

/**
 * 
 */
function updateDestroyedElement() {
  for (const id of destroyed) {
    elements[id]?.remove();
  }

  destroyed = [];
}

// ================================================================================================
// ======== BITMAP TEXT ===========================================================================
// ================================================================================================

let captionsttl = 0;

/**
 * Draw some bitmap text inside of the given element.
 */
function text(el: Element, str: string) {
  el.innerHTML = '';
  
  for (let i = 0; i < str.length; i++) {
    const char = glyph.cloneNode() as HTMLElement;
    char.style.backgroundPositionX = `${0 - CHARS.indexOf(str[i]) * 14}px`;
    el.append(char);
  }
}

/**
 * 
 */
function caption(str: string) {
  text(captions, str);
  captionsttl = 2500;
  captions.style.display = 'block';
}

/**
 * 
 */
function updateCaptions(delta: number) {
  if (captionsttl > 0) {
    captionsttl -= delta;
  }

  if (captionsttl <= 0) {
    captions.style.display = 'none';
  }
}

// ================================================================================================
// ======== SOUND EFFECTS =========================================================================
// ================================================================================================

/**
 * Play a sound effect.
 */
function sfx(params: any[]) {
  zzfx(...params);
}

// ================================================================================================
// ======== MULTIPLAYER ===========================================================================
// ================================================================================================

// Connect to the relay server, and listen for messages.
let socket: WebSocket | null = null;
let syncttl = 0;
let pending: Map<string, string> = new Map();
let sent: Map<string, string> = new Map();
let callbacks: Record<string, (data: string) => void> = {};

/**
 * 
 */
function updateStateSync(delta: number) {
  if (socket && socket.readyState === 1) {
    syncttl += delta;

    if (syncttl >= 50 && pending.size > 0) {
      syncttl -= 50;
      socketSend([...pending.values()].join('\n'));
      pending.clear();
    }
  }
}

/**
 * 
 */
function socketInit() {
  socket = new WebSocket("wss://relay.js13kgames.com/worms-13k/test");
  socket.onmessage = socketReceive;
}

/**
 * 
 */
function socketAction(prefix: string, data = '', cache = false) {
  const msg = prefix + '|' + data;

  if (sent.get(prefix) !== msg) {
    pending.set(prefix, msg);
  }

  if (cache) {
    sent.set(prefix, msg);
  }
}

/**
 * 
 */
function socketSend(data: string) {
  if (socket) {
    socket.send(data);
  }
}

/**
 * 
 */
function socketRegister(prefix: string, cb: (data: string) => void) {
  callbacks[prefix] = cb;
}

// ================================================================================================
// ======== MULTIPLAYER: RECEIVE ==================================================================
// ================================================================================================

/**
 * 
 */
function socketReceive(event: MessageEvent<string>) {
  const actions = event.data.split('\n');
  
  for (const action of actions) {
    const code = action.substring(0, 2);
    const data = action.substring(3);
    const cb = callbacks[code];
    cb?.(data);
  }
}

//// CORE

// "G0" Request from other client to join.
socketRegister('G0', () => {
  if (started) {
    socketActionAcceptJoin();
    socketActionGameState();
  }
});

// "G1" Response from master, accepting join request.
socketRegister('G1', (data) => {
  const json = JSON.parse(data);
  heights = json[0];
  players = json[1];
  joinGame();

  for (const p of players) {
    updatePlayerHealth(p);
    text(getPlayerNameElement(p), NAMES[p.i]);
  }
});

// "G2" Receive game state.
socketRegister('G2', (data) => {
  const values = unpack(data);
  activeTeam = int(values[0]);
  activePlayer = int(values[1]);
  activeWeapon = int(values[2]);
  windSpeed = f(values[3]);
  unlockCamera();
  updateWeaponUI();
});

// "G3" End of turn.
socketRegister('G3', () => {
  master = true;
  caption(`TEAM ${activeTeam + 1} IT'S YOUR TURN`);
});

//// PLAYERS

// "P=" Sync the state of a player.
socketRegister('P=', (data) => {
  const [i, x, y, dx, dy, aim, dir, hp, ix, power] = unpack(data);
  const p = players[int(i)];
  if (p) {
    p.x = f(x);
    p.y = f(y);
    p.dx = f(dx);
    p.dy = f(dy);
    p.aim = f(aim);
    p.dir = dir === '1' ? 1 : -1;
    p.ix = f(ix);
    p.power = f(power);

    if(p.hp !== int(hp)) {
      p.hp = int(hp);
      updatePlayerHealth(p);
    }
  }
});

// "P-" Kill a player.
socketRegister('P-', (data) => {
  const [i, explode, immediate] = unpack(data);
  const p = players[int(i)];
  if (p) {
    killPlayer(p, explode === '1', immediate === '1');
  }
});

//// MISSILES

// "M=" Sync the state of a missile.
socketRegister('M=', (data) => {
  const [id, x, y,dx, dy] = unpack(data);
  const m = missiles.get(int(id));
  if (m) {
    m.x = f(x);
    m.y = f(y);
    m.dx = f(dx);
    m.dy = f(dy);
  }
});

// "M-" Remove a missile.
socketRegister('M-', (data) => {
  const [id] = unpack(data);
  const m = missiles.get(int(id));
  if (m) {
    explodeMissile(m);
  }
});

//// GRENADES

// "G=" Sync the state of a grenade.
socketRegister('G=', (data) => {
  const [id, x, y,dx, dy] = unpack(data);
  const g = grenades.get(int(id));
  if (g) {
    g.x = f(x);
    g.y = f(y);
    g.dx = f(dx);
    g.dy = f(dy);
  }
});

// "G-" Remove a missile.
socketRegister('G-', (data) => {
  const [id] = unpack(data);
  const g = grenades.get(int(id));
  if (g) {
    explodeGrenade(g);
  }
});

//// BLASTS

// "B+" Add a new blast.
socketRegister('B+', (data) => {
  const [id, x, y, r] = unpack(data);
  addBlast(int(id), f(x), f(y), f(r), 1);
});

//// FIRE WEAPONS

// "F0" Fire bazooka
socketRegister('F0', (data) => {
  const [id, x, y, dir, aim, power] = unpack(data);
  fireMissile(int(id), f(x), f(y), int(dir), f(aim), f(power));
});

// "F1" Fire shotgun.
socketRegister('F1', (data) => {
  const [id, x, y, dir, aim, seed] = unpack(data);
  fireShotgun(int(id), f(x), f(y), int(dir), f(aim), int(seed));
});

// "F2" Fire shotgun.
socketRegister('F2',(data) => {
  const [id, x, y, dir, aim, seed] = unpack(data);
  fireUzi(int(id), f(x), f(y), int(dir), f(aim), int(seed));
});

// "F3" Fire air strike.
socketRegister('F3', (data) => {
  const [id, x, tx, ty] = unpack(data);
  fireAirStrike(int(id), f(x), f(tx), f(ty));
});

// "F4" Fire dynamite.
socketRegister('F4', (data) => {
  const [id, x, y] = unpack(data);
  placeDynamite(int(id), f(x), f(y));
});

// "F5" Fire grenade.
socketRegister('F5', (data) => {
  const [id, x, y, dir, aim, power] = unpack(data);
  fireGrenade(int(id), f(x), f(y), int(dir), f(aim), f(power));
});

// "F6" Fire unholy black cat.
socketRegister('F6', (data) => {
  const [id, x, y, dir, aim, power] = unpack(data);
  fireHolyHandGrenade(int(id), f(x), f(y), int(dir), f(aim), f(power));
});

// "F7" Fire minigun.
socketRegister('F7', (data) => {
  const [id, x, y, dir, aim, seed] = unpack(data);
  fireMinigun(int(id), f(x), f(y), int(dir), f(aim), int(seed));
});

// "F8" Fire homing missile.
socketRegister('F8', (data) => {
  const [id, x, y, dir, aim, power, tx, ty] = unpack(data);
  fireHomingMissile(int(id), f(x), f(y), int(dir), f(aim), f(power), f(tx), f(ty));
});

// "F9" Fire cluster bomb.
socketRegister('F9', (data) => {
  const [id, x, y, dir, aim, power] = unpack(data);
  fireClusterBomb(int(id), f(x), f(y), int(dir), f(aim), f(power));
});

// "FA" Fire nyan cat strike.
socketRegister('FA', (data) => {
  const [id, tx, ty, seed] = unpack(data);
  fireNyanCats(int(id), f(tx), f(ty), int(seed));
});

// "FB" Fire cricket bat.
socketRegister('FB', (data) => {
  const [pid, x, y, dir, aim] = unpack(data);
  fireCricketBat(int(pid), f(x), f(y), int(dir), f(aim));
});

// "FC" Fire charge (invisible missile).
socketRegister('FC', (data) => {
  const [id, x, y, dx, dy, power] = unpack(data);
  fireCharge(int(id), f(x), f(y), f(dx), f(dy), f(power));
});

// ================================================================================================
// ======== MULTIPLAYER: SEND =====================================================================
// ================================================================================================

//// CORE

function socketActionJoin() {
  socketAction('G0');
}

function socketActionAcceptJoin() {
  socketAction('G1', JSON.stringify([heights, players]));
}

function socketActionGameState() {
  socketAction('G2', pack(activeTeam, activePlayer, activeWeapon, windSpeed));
}

function socketActionEndTurn() {
  socketAction('G3');
}

//// PLAYERS

function socketActionSyncPlayer(p: Player) {
  socketAction(pack('P=', p.i), pack(p.x, p.y, p.dx, p.dy, p.aim, p.dir, p.hp, p.ix, p.power), true);
}

function socketActionKillPlayer(p: Player, explode: boolean, immediately: boolean) {
  socketAction(pack('P-', p.i), pack(+explode, +immediately));
}

//// MISSILES

function socketActionSyncMissile(id: number, x: number, y: number, dx: number, dy: number) {
  socketAction(pack('M=', id), pack(x, y, dx, dy));
}

function socketActionRemoveMissile(id: number) {
  socketAction(pack('M-', id));
}

//// GRENADES

function socketActionSyncGrenade(id: number, x: number, y: number, dx: number, dy: number) {
  socketAction(pack('G=', id), pack(x, y, dx, dy));
}

function socketActionRemoveGrenade(id: number) {
  socketAction(pack('G-', id));
}

//// BLASTS

function socketActionAddBlast(id: number, x: number, y: number, r: number) {
  socketAction(pack('B+', id), pack(x, y, r));
}

//// FIRE WEAPONS

function socketActionAddMissile(id: number, x: number, y: number, dir: number, aim: number, power: number) {
  socketAction('F0', pack(id, x, y, dir, aim, power));
}

function socketActionAddShotgun(id: number, x: number, y: number, dir: number, aim: number, seed: number) {
  socketAction('F1', pack(id, x, y, dir, aim, seed));
}

function socketActionAddUzi(id: number, x: number, y: number, dir: number, aim: number, seed: number) {
  socketAction('F2', pack(id, x, y, dir, aim, seed));
}

function socketActionAddAirStrike(id: number, x: number, tx: number, ty: number) {
  socketAction('F3', pack(id, x, tx, ty));
}

function socketActionAddDynamite(id: number, x: number, y: number) {
  socketAction('F4', pack(id, x, y));
}

function socketActionAddGrenade(id: number, x: number, y: number, dir: number, aim: number, power: number) {
  socketAction('F5', pack(id, x, y, dir, aim, power));
}

function socketActionAddHolyHandGrenade(id: number, x: number, y: number, dir: number, aim: number, power: number) {
  socketAction('F6', pack(id, x, y, dir, aim, power));
}

function socketActionAddMinigun(id: number, x: number, y: number, dir: number, aim: number, seed: number) {
  socketAction('F7', pack(id, x, y, dir, aim, seed));
}

function socketActionAddHomingMissile(id: number, x: number, y: number, dir: number, aim: number, power: number, tx: number, ty: number) {
  socketAction('F8', pack(id, x, y, dir, aim, power, tx, ty));
}

function socketActionAddClusterBomb(id: number, x: number, y: number, dir: number, aim: number, power: number) {
  socketAction('F9', pack(id, x, y, dir, aim, power));
}

function socketActionAddNyanCats(id: number, tx: number, ty: number, seed: number) {
  socketAction('FA', pack(id, tx, ty, seed));
}

function socketActionAddCricketBat(pid: number, x: number, y: number, dir: number, aim: number) {
  socketAction('FB', pack(pid, x, y, dir, aim));
}

function socketActionAddCharge(id: number, x: number, y: number, dx: number, dy: number, power: number) {
  socketAction(pack('FC', id), pack(x, y, dx, dy, power));
}

// ================================================================================================
// ======== MULTIPLAYER: UTILS ==================================================================
// ================================================================================================

function f(input: string): number {
  return parseFloat(input);
}

function int(input: string): number {
  return parseInt(input, 10);
}

function pack(...args : (string | number)[]): string {
  return [...args].join('|');
}

function unpack(input: string): string[] {
  return input.split('|');
}
