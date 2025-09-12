import { createNoise2D } from './noise';
import type { Camera, Dynamite, Elements, Explosion, Grenade, Hole, Missile, Player, Position, Raycast, Team, Tracer, Tunnel, Vector } from './types';
import { ANIMATIONS, WEAPONS } from './data';
import { zzfx } from './zzfx';
import './styles.css';

// Shortcuts.
const docElem = document.getElementById.bind(document);
const docElems = (count: number) => new Array(count).fill(0).map((_, i) => docElem('id' + i)!);

// Get references to all of the 'idXX' elements in the page.
const [
  ch,
  timer,
  svg,
  playersContainer,
  particles,
  objects,
  crosshairs,
  targetlock,
  powerbar,
  powerbarMask,
  weapons,
  weaponLabel,
  windleft,
  windright,
  captions,
  glyph,
  explosion,
  tracer,
  logo,
  svg2,
  svg3,
  names,
  menu1,
  menu2,
  menu3,
  menu4,
  menu5,
  arrow,
  muzzle,
] = docElems(29);

// Constants.
const NAMES = 'ALICE|CLIVE|BORIS|RICHARD|MIKE|SARAH|PAULINE|HENRY'.split('|');
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 \'!:-';
const HALF_PI = Math.PI / 2;
const WW = 8000;
const WH = 2000;
const GROUND = WH + 400;
const OCEAN_SIZE = 10000;
const WORLD_SCALE = 0.00075;
const NOISE_AMPLITUDE = 1500;
const AIR_RESISTANCE = 0.002;
const PLAYER_GRAVITY = 0.002;
const MISSILE_GRAVITY = 0.001;

// Sound effects.
const SFX_EXPLOSION = [1.3,,50,.08,.18,.36,4,2.9,-5,,,,,1.2,20,.6,.16,.4,.12,,1689];
const SFX_JUMP = [,,369,.02,.05,.09,1,1.5,2,157,,,,,,.1,,.72,,,926];
const SFX_SHOOT = [1.7,,185,.03,.01,.06,3,3.2,-16,-9,50,,,,,.4,.2,.67,.1,,-1376];
const SFX_GUNSHOT = [.6,,328,.01,.01,.03,3,3.7,7,,-50,,.01,.1,7.4,,,.74,,,193];
const SFX_BOUNCE = [,324,,.05,.09,1,3.1,-3,-8,,,,.8,38,.3,,.42,.09,,-2385];
const SFX_SPLASH = [5,,244,.01,.01,.01,1,.7,,,,,,,,,.07,.56,.01,.04,-978];

// Noise function.
const rngf = splitmix32((Math.random() * 2 ** 32) >>> 0);
const simplex = createNoise2D(rngf);

// Time since the page load.
let time = 0;

// Viewport dimensions.
let vw = innerWidth;
let vh = innerHeight;

// Keep track of the holes and tunnels in the terrain.
let holes: Hole[] = [];

// Create the terrain layers.
let heights: number[] = [];

// Mask layers, for terrain destruction.
let masks: HTMLElement[] = [];

// Has the game started.
let started = false;
let gameover = false;
let master = false;
let connected = true;
let code: number[] = [];
let codeInput = false;
let cursor = 0;
let timeout: NodeJS.Timeout | null = null;

// Create a series of players, 4 for each team.
let teams: Team[] = [];
let players: Player[] = [];
let activePlayer = 0;
let activeTeam = 0;
let activeWeapon = 0;
let muzzlettl = 0;
let gameoverttl = 0;
let captionsttl = 0;
let roundtime = 0;
let timerstr = '';
let paused = false;

// Current wind state.
let windSpeed = 0;

// Various game objects.
let explosions: Map<number, Explosion> = new Map();
let missiles: Map<number, Missile> = new Map();
let grenades: Map<number, Grenade> = new Map();
let dynamites: Map<number, Dynamite> = new Map();
let tracers: Map<number, Tracer> = new Map();

// Camera position, and object that it's locked to.
let camera: Camera = {
  x: 1350,
  y: WH - 600,
  to: { x: 1350, y: WH - 600 },
  free: true,
  ttl: 0,
};

// DOM elements for game entities.
let destroyed: number[] = [];
let elements: Element[] = [];

// Multiplayer state.
let socket: WebSocket | null = null;
let syncttl = 0;
let pending: Map<string, string> = new Map();
let sent: Map<string, string> = new Map();
let callbacks: ((data: string) => void)[] = [];

// Initialise everything required for the title screen.
setTimeout(initGame);

// ================================================================================================
// ======== EVENTS ================================================================================
// ================================================================================================

const keys = new Set<string>();
const mouse = { x: vw / 2, y: vh / 2, over: false };

// Keep track of the mouse position.
addEventListener('mousemove', (event) => {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
});

// Fire targeted weapons on mouse click.
addEventListener('mousedown', (event) => {
  if (master && WEAPONS[activeWeapon][3] && event.clientY > 100) { // 3 = target
    fireWeapon();
  }
});

// Keep track of which keyboard buttons are pressed.
addEventListener('keydown', (event) => {
  const kc = event.keyCode;

  // Prevent the space bar from scrolling the page.
  if (kc === 32) {
    event.preventDefault();
  }

  // Keep track of the keys that are currently down.
  if (started) {
    keys.add(event.code);
    keys.add(event.key);
  }

  // Read numeric input to fill out the multiplayer code.
  if (!started && codeInput && kc >= 48 && kc <= 57) {
    code[cursor++] = kc - 48;
    text(menu5, 'ENTER CODE: ' + code.join('').padEnd(8, '-'));

    if (code.length === 8) {
      joinMultiplayerGame();
    }
  }

  // Switch to a different player.
  if (event.code === 'KeyN') {
    activateNextPlayer();
  }

  if (event.code === 'KeyX') {
    gameover = true;
  }
});

// Keep track of which keyboard buttons are released.
addEventListener('keyup', (event) => {
  keys.delete(event.code);
  keys.delete(event.key);
});

// Reload the game if the window resizes. It's a hack, but all I have time for right now.
addEventListener('resize', () => {
  vw = innerWidth;
  vh = innerHeight;
});

// Prevent scrolling via the mouse wheel, as we're controlling it ourselves.
addEventListener('wheel', (event) => {
  event.preventDefault();
}, { passive: false });

// track when the mouse enters the page.
document.body.addEventListener('mouseenter', () => {
  mouse.over = true;
});

// track when the mouse leaves the page.
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

  const delta = clamp(t - time, 0, 33);
  time = t;

  updatePlayers(delta);
  updateCrosshairs(delta);
  updatePowerbar(delta);
  updateExplosions(delta);
  updateMuzzleFlash(delta);
  updateTracers(delta);
  updateMissiles(delta);
  updateDynamites(delta);
  updateGrenades(delta);
  updateCamera(delta);
  updateWind();
  updateDestroyedElement();
  updateStateSync(delta);
  updateCaptions(delta);
  updateGameOver(delta);
  updateTimer(delta);
}

/**
 * 
 */
function initGame() {
  initSvg();
  initMenu();
  requestAnimationFrame(tick);
  initTerrain(true);
  initWeaponsUI();
}

/**
 * 
 */
function startRegularGame() {
  if (!started) {
    initHeights();
    initTerrain(false);
    initTerrainDamage();
    initTeams();
    initPlayers();
    randomiseWind();
    unlockCamera();
    menuShow(menu1, false);
    menuShow(menu2, false);
    menuShow(menu3, false);
    document.body.classList.add('started');
    started = true;
    master = true;
    roundtime = 30;
  }
}

/**
 * 
 */
function startMultiplayerGame() {
  startRegularGame();
  started = false;
  connected = false;
  code = new Array(8).fill(0).map(() => rngi(0, 10));
  socketInit(code.join(''));
  menuShow(menu4, true);
  text(menu4, 'WAITING FOR PLAYER TO JOIN: ' + code.join(''));
}

/**
 * 
 */
function showCodeInput() {
  connected = false;
  codeInput = true;
  text(menu5, 'ENTER CODE: --------'); 
  menuShow(menu1, false);
  menuShow(menu2, false);
  menuShow(menu3, false);
  menuShow(menu5, true);
}

/**
 * 
 */
function joinMultiplayerGame() {
  socketInit(code.join(''));
  // socketActionJoin();
  socketAction(0);
}

/**
 * 
 */
function updateTimer(delta: number) {
  if (!paused) {
    if (started) {
      roundtime -= delta / 1000;
      const str = ('' + Math.ceil(roundtime)).padStart(2, '0')

      if (master && roundtime <= 0) {
        activateNextTeam();
        caption('OOPS, YOU RAN OUT OF TIME!')
      }
      
      if (timerstr !== str) {
        timerstr = str;
        console.log(str, timerstr);
        text(timer, str);
      }
    } else {
      text(timer, '30');
    }
  }
}

/**
 * 
 */
async function updateGameOver(delta: number) {
  if (gameover) {
    gameoverttl += delta;

    if (gameoverttl > 500) {
      gameoverttl -= 500;

      const x = camera.x - (vw / 2) + (rngi(0, vw));
      const y = 0;

      const dx = rngf() * 0.4 - 0.4;
      const dy = 0.2;

      const m = await fireMissileRound(getId(), x, y, dx, dy, rngi(60, 80), 150);
      m.grav = true;
      m.wind = true;
    }
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
 * 
 */
function initTeams() {
  teams[0] = [,,,2,2,,1,1,1,3,1,,];
  teams[1] = [,,,2,2,,1,1,1,3,1,,];
}

/**
 * Initial two teams of players, four on each team.
 */
function initPlayers() {
  for (let i = 0; i < 8; i++) {
    const p = initPlayer(i);
    players.push(p);
    updatePlayerHealth(p);
    text(getPlayerInfoElement(p, 2), NAMES[i]);
  }
}

/**
 * Initialise the player sprite, setting the position based on the terrain heights.
 */
function initPlayer(i: number): Player {
  let x = -1;
  while (x === -1) {
    const cx = Math.random() * (WW - 500) + 250;
    if (getTerrainHeight(cx) < WH - 210) {
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
function getPlayerInfoElement(p: Player, offset: number) {
  return getElement(names, 'hp', p.id + offset, (el: HTMLElement) => {
    sprop(el, '--c', p.team === 0 ? '#FF418B' : '#00EAFF');
  });
}

/**
 * Update all of the players, ensuring they move as expected and all collision checks are applied.
 * For the active player, use the keyboard input to move the player too.
 */
function updatePlayers(delta: number) {
  for (let p of players) {
    updatePlayer(p, p.i === activePlayer, delta);
  }
}

/**
 * Update the velocity and position of a player, then check for collisions. Apply forces based on
 * user inputs, such as the arrow keys being pressed, but only if the player if the active one.
 */
function updatePlayer(p: Player, active: boolean, delta: number) {
  const el1 = getPlayerElement(p);
  const el2 = getPlayerInfoElement(p, 1) as HTMLElement;
  const el3 = getPlayerInfoElement(p, 2) as HTMLElement;

  if (!p.gone) {
    if (master && connected) {

      // Keyboard input.
      p.ix = active && (p.cooldown || 0) <= 0 ? +keys.has('KeyD') - +keys.has('KeyA') : 0;
      p.jumping = !!(active ? keys.has('Space') && p.onGround && (p.cooldown || 0) <= 0 : false);

      // Snap back to the player when they move.
      if (p.ix !== 0) {
        unlockCamera();
      }

      // Update the velocity.
      p.dx = p.dx + (p.onGround ? p.ix * 0.1 : 0);
      p.dy = p.dy + (p.jumping ? -0.6 : 0);

      // Prevent the player from picking up too much speed when walking.
      if (p.onGround && !p.ragdoll) {
        p.dx = clamp(p.dx, -0.125, 0.125);
      }

      // Boost the player forwards when they jump.
      if (p.jumping) {
        p.dx += p.dir * 0.2;
        p.cooldown = 500;
      }

      // Apply ground friction.
      if (!p.jumping && p.onGround) {
        p.dx *= 0.5;
        p.jumped = false;
      }

      // Play a jumping sound effect.
      if (p.jumping && p.onGround) {
        sfx(SFX_JUMP);
        p.jumped = true;
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
        p.cooldown = (p.cooldown || 0) - delta;
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
        const [up] = raycast(p.x, p.y, 0, -1);
        const [down] = raycast(p.x, p.y - 20, 0, 1);
        const [right] = raycast(p.x - 5, p.y - 10, 1, 0);
        const [left] = raycast(p.x + 5, p.y - 10, -1, 0);

        // Push the player, back up above a floor.
        if (up !== Infinity && up > 0 && p.dy > 0) {
          p.y -= up;
          p.dy = p.ragdoll ? 0 - (p.dy * 0.5) : 0;
          p.onGround = true;
        }

        // Push the player, back below a ceiling.
        if (down !== Infinity && down > 0 && p.dy < 0) {
          p.y += down;
          p.dy = p.ragdoll ? 0 - (p.dy * 0.5) : 0;
        }

        // Push the player left, back out of a right-hand wall.
        if (left !== Infinity && left > 0 && p.dx > 0) {
          p.x -= left;
          p.dx = p.ragdoll || !p.onGround ? 0 - (p.dx * 0.5) : 0;
        }

        // Push the player right, back out of a left-hand wall.
        if (right !== Infinity && right > 0 && p.dx < 0) {
          p.x += right;
          p.dx = p.ragdoll || !p.onGround ? 0 - (p.dx * 0.5) : 0;
        }
      } else {
        p.onGround = false;
      }

      // If the player falls into the ocean, mark them as dead and gone immediately.
      if (master && p.y >= WH - 190) {
        killPlayer(p, false, true);
        sfx(SFX_SPLASH);
      }
    }

    // Render the changes into the DOM.
    const scale = 0.75;
    const x = p.x - (p.dir * 32 * scale);
    const sx = p.dir * scale;
    transform(el1, x, p.y - 60 * scale, [p.r, 32 * sx, 32 * scale], [sx, scale]);

    // Switch to a different animation.
    const anim = p.jumped ? 2 : p.ix ? 1 : 0;
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

    const px = ~~p.x;
    const py = ~~p.y;

    // Display the player's health.
    let x1 = px - el2.children.length * 8 - 4;
    let y1 = py - 75;
    el2.style.transform = `translate(${x1}px, ${y1}px)`;

    // Display the player's name tag.
    let x2 = px - el3.children.length * 8 - 4;
    let y2 = py - 97;
    el3.style.transform = `translate(${x2}px, ${y2}px)`;

    // Position the arrow over the active player.
    if (p.i === activePlayer) {
      transform(arrow, p.x - 7.5, p.y - 120);
      arrow.style.fill = p.team === 0 ? '#FF418B' : '#00EAFF';
    }

    if (master && connected) {
      // Send the player data to connected clients.
      // socketActionSyncPlayer(p);
      socketAction(4, pack(p.x, p.y, p.dx, p.dy, p.aim, p.dir, p.hp, p.ix, p.power, p.r, +(p.jumped || 0)), p.i, true);
    }

  } else {
    el2.style.display = 'none';
    el3.style.display = 'none';
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
  attrNS(children[1], 'cx', frame[1]);
  attrNS(children[2], 'cx', frame[2]);
}

/**
 * 
 */
function updatePlayerHealth(p: Player) {
  const el2 = getPlayerInfoElement(p, 1);

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
  if (WEAPONS[activeWeapon][2]) { // 2 = aim
    const p = players[activePlayer];

    if (p) {
      if (master && connected) {
        const vertical = +keys.has('KeyS') - +keys.has('KeyW');

        if (vertical !== 0) {
          unlockCamera();
        }

        p.aim = clamp(p.aim + (vertical * delta * 0.001), -HALF_PI, HALF_PI);
      }

      const [x, y] = rpos(p, 0, -10, 150);

      transform(powerbar, p.x, p.y, [p.aim, 0, 0]);
      showCrosshairs(false, x, y);

      // Match the colour to the team colour
      crosshairs.style.fill = p.team === 0 ? '#FF418B' : '#00EAFF';
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
    if (!p.hasFired && (w[2] || w[4])) { // 2 = aim, 4 = place
      if (master && connected) {
        const isFireKeyDown = keys.has('KeyP');

        if (w[1]) { // 1 = power
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

  attrNS(powerbarMask, 'width', width);
}

/**
 * Switch to the next player for the current team.
 */
function activateNextPlayer() {
  if (master) {
    // Cycle through the players, looking for one that is alive.
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
      if (!checkForGameOver()) {
        activeWeapon = 0;
        activeTeam = 1 - activeTeam;
        roundtime = 30;
        paused = false;

        activateRandomPlayer();
        randomiseWind();
        resetPlayers();
        socketActionGameState();

        if (socket) {
          master = false;
          // socketActionEndTurn();
          socketAction(3);
        } else {
          caption(`TEAM ${activeTeam + 1} IT'S YOUR TURN`);
        }
      }
    }
  }

  unlockCamera();
  updateWeaponUI();
}

/**
 * 
 */
function checkForGameOver() {
  // Determine how many players are still alive.
  const counts = [0, 0];

  for (const p of players) {
    if (!p.gone) {
      counts[p.team]++;
    }
  }

  // If there are none alive, the other player has won!
  if (!counts[0] && !counts[1]) {
    caption(`WHOA, IT'S A DRAW!`);
    gameover = true;
  } else if (!counts[0]) {
    caption(`CONGRATULATIONS TEAM 2! YOU WIN!`);
    gameover = true;
  } else if (!counts[1]) {
    caption(`CONGRATULATIONS TEAM 1! YOU WIN!`);
    gameover = true;
  }

  return gameover;
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
    // socketActionKillPlayer(p, explode, immediately);
    socketAction(5, pack(+explode, +immediately), p.i);
  }

  // Note: this timeout has to be 2001, so that it only fires AFTER the standard timeouts that
  // fire after weapons have completed their sequences, which is 2000.
  const timeout = immediately ? 0 : 2001;

  p.dead = true;
  
  setTimeout(() => {
    p.gone = true;

    const el1 = getPlayerElement(p);
    attrNS(el1, 'opacity', '0');

    const el2 = getPlayerInfoElement(p, 1);
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
  for (const [id, e] of explosions) {
    e.ttl -= delta;
    attrNS(e.el, 'opacity', e.ttl > 400 ? '1' : (e.ttl / 400));
    attrNS(e.el, 'r', (e.r * (((500 - e.ttl) / 600) + 1)));

    if (e.ttl <= 0) {
      e.el.remove();
      explosions.delete(id);
    }
  }
}

/**
 * Add a new explosion effect.
 */
function addExplosion(x: number, y: number, r: number, hue: number | false = false) {
  const el = explosion.cloneNode(true) as Element;
  const fill = hue === false ? '#fff' : `hsl(${hue}, 100%, 50%)`;
  const ttl = hue === false ? 500 : 1000;

  attrNS(el, 'cx', x);
  attrNS(el, 'cy', y);
  attrNS(el, 'r', r);
  attrNS(el, 'fill', fill);

  particles.append(el);

  explosions.set(getId(), { x, y, r, el, ttl });
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

    let icon = '';
    for (const [a,b,c,d,e] of WEAPONS[i][6]) {
      const href = Number.isInteger(e) ? 'w' + e : e;
      icon += `<g transform="translate(${a||0} ${b||0}) rotate(${c||0}) scale(${d||1})"><use href="#${href}" /></g>`;
    }

    el.innerHTML = `<svg>${icon}</svg>`;

    el.addEventListener('mousedown', function() {
      if (master && connected && teams[activeTeam][i] !== 0) {
        activeWeapon = i;
        socketActionGameState();
        updateWeaponUI();
        hideCrosshairs(false);
      }
    });

    weapons.append(el);
  }

  updateWeaponUI();
}

/**
 * 
 */
function updateWeaponUI() {
  const qty = teams[activeTeam]?.[activeWeapon];
  const label = WEAPONS[activeWeapon][5];

  text(weaponLabel, `${label}${qty === undefined ? '' : ' X ' + qty}`);

  for (let i = 0; i < WEAPONS.length; i++) {
    const el = weapons.children.item(i)?.classList;
    el?.toggle('active', i === activeWeapon);
    el?.toggle('inactive', teams[activeTeam]?.[i] === 0);
  }
}

/**
 * Fire the active weapon.
 */
function fireWeapon() {
  const { id: pid, x, y, dir, aim, power } = players[activePlayer];
  const id = getId();
  const tx = mouse.x + camera.x - vw / 2;
  const ty = mouse.y + camera.y - vh / 2;
  const seed = (Math.random() * 2 ** 32) >>> 0;

  paused = true;

  switch (activeWeapon) {
    case 0: return fireBazooka(id, x, y, dir, aim, power);
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

/**
 * 
 */
function reduceWeaponCount() {
  const t = teams[activeTeam];
  if (t[activeWeapon] !== undefined) {
    t[activeWeapon]! -= 1
  }
}

/**
 * 
 */
function updateMuzzleFlash(delta: number) {
  if (muzzlettl > 0) {
    muzzlettl -= delta;

    if (muzzlettl <= 0){
      muzzlettl = 0;
      transform(muzzle, 0, 0);
    }
  }
}

/**
 * 
 */
function flashMuzzle(x: number, y: number) {
  const r = rngf() * 0.4 + 1.5;
  transform(muzzle, x, y, [rngi(0, 360), 0, 0], [r, r]);
  muzzlettl = 150;
}

// ================================================================================================
// ======== WEAPON: MISSILES ======================================================================
// ================================================================================================

/**
 * 
 */
function getMissileElement(m: Missile) {
  return m.invis ? null : getElement(objects, m.nyan ? 'w10' : m.homing ? 'w8' : 'w0', m.id);
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
      // socketActionSyncMissile(m.id, m.x, m.y, m.dx, m.dy);
      socketAction(6, pack(m.x, m.y, m.dx, m.dy), m.id);
    }

    // Check for collisions.
    // There is no player with index of '999', so this will check against all players.
    if (master && checkCollision(m.x, m.y, 999)) {
      // socketActionRemoveMissile(m.id);
      socketAction(7, '', m.id);
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
    // socketActionAddCharge(id, x, y, dx, dy, power);
    socketAction(23, pack(x, y, dx, dy, power), id);
  }

  missiles.set(id, { id, x, y, dx, dy, power, wind: false, grav: true, invis: true });
  cancelEndTurn();
}

/**
 * Launch a missile from the player's position, in the direction they are aiming, and with the
 * correct amount of power based on how long they held down the power button.
 */
function fireBazooka(id: number, x: number, y: number, dir: number, aim: number, power: number) {
  if (master) {
    // socketActionAddMissile(id, x, y, dir, aim, power);
    socketAction(11, pack(id, x, y, dir, aim, power));
  }

  const m = fireMissile(id, x, y, dir, aim, power);
  m.wind = true;
  m.grav = true;

  reduceWeaponCount();
}

/**
 * 
 */
function fireHomingMissile(id: number, x: number, y: number, dir: number, aim: number, power: number, tx: number, ty: number) {
  const p = players[activePlayer];

  if (master) {
    // socketActionAddHomingMissile(id, x, y, dir, aim, power, tx, ty);
    socketAction(19, pack(id, x, y, dir, aim, power, tx, ty));
  }

  if (power === 0) {
    // Phase 1, set a target.
    p.tx = tx;
    p.ty = ty;

    showCrosshairs(true, tx, ty);

  } else if (p.tx && p.ty) {
    const m = fireMissile(id, x, y, dir, aim, power);
    m.tx = p.tx;
    m.ty = p.ty;
    m.homing = true;

    p.tx = p.ty = undefined;

    reduceWeaponCount();
  }
}

/**
 * 
 */
function fireMissile(id: number, x: number, y: number, dir: number, aim: number, power: number): Missile {
  const dx = Math.cos(aim) * power * 2 * dir;
  const dy = Math.sin(aim) * power * 2;

  const sx = x + (dx * 10);
  const sy = y - 10 + (dy * 10);

  const dmg = rngi(70, 80);

  const missile: Missile = { id, x: sx, y: sy, dx, dy, power: dmg };

  missiles.set(id, missile);
  lockCamera(missile);

  sfx(SFX_SHOOT);
  flashMuzzle(sx, sy);

  cancelEndTurn();

  return missile;
}

/**
 * Drop a series of 5 missiles from the sky on a given location.
 */
async function fireAirStrike(id: number, x: number, tx: number, ty: number) {
  if (master) {
    // socketActionAddAirStrike(id, x, tx, ty);
    socketAction(14, pack(id, x, tx, ty));
  }

  lockCamera({ x: tx, y: ty });
  showCrosshairs(true, tx, ty);

  reduceWeaponCount();

  setTimeout(async () => {
    for (let i = 0; i < 5; i++) {
      const dir = x < tx ? 1 : -1;
      const dx = 0.2 * dir;
      const offset = ((i - 2.5) * 50 - 150) * dir;
      const power = rngi(55, 65);

      // const m = await fireAirStrikeRound(id + i, tx + offset, -50, dx, 0.2, power);
      const m = await fireMissileRound(id + i, tx + offset, -50, dx, 0.2, power, 150);
      m.grav = true;
    }
  }, 1000);
}

/**
 * 
 */
async function fireNyanCats(id: number, tx: number, ty: number, seed: number) {
  if (master) {
    // socketActionAddNyanCats(id, tx, ty, seed);
    socketAction(21, pack(id, tx, ty, seed));
  }

  lockCamera({ x: tx, y: ty });
  showCrosshairs(true, tx, ty);

  reduceWeaponCount();

  const rng = splitmix32(seed);

  setTimeout(async () => {
    for (let i = 0; i < 5; i++) {
      const angle = Math.PI / 2 + (rng() * 0.2 - 0.1);
      const dx = Math.cos(angle) * 0.4;
      const dy = Math.sin(angle) * 0.4;
      const power = rngi(75, 90);

      // const m = await fireNyanCat(id + i, tx - dx * 100, -20, dx, dy, power);
      const m = await fireMissileRound(id + i, tx - dx * 100, -20, dx, dy, power, 1250);
      m.nyan = true;
    }
  }, 1000);
}

/**
 * 
 */
async function fireMissileRound(id: number, x: number, y: number, dx: number, dy: number, power: number, delay: number): Promise<Missile> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const missile: Missile = { id, x, y, dx, dy, power };
      missiles.set(id, missile);
      cancelEndTurn();
      resolve(missile);
    }, delay);
  });
}

// ================================================================================================
// ======== WEAPON: GUNS ==========================================================================
// ================================================================================================

/**
 * Update all tracer lines, and remove them once done with.
 */
function updateTracers(delta: number) {
  for (const [id, t] of tracers) {
    t.ttl -= delta;
    t.el.style.opacity = '' + (t.ttl / 50);

    if (t.ttl <= 0) {
      t.el.remove();
      tracers.delete(id);
    }
  }
}

/**
 * Add a new tracer line, for a fired round.
 */
function addTracer(x1: number, y1: number, x2: number, y2: number) {
  const el = tracer!.cloneNode(true) as SVGLineElement;
  attrNS(el, 'x1', x1);
  attrNS(el, 'y1', y1);
  attrNS(el, 'x2', x2);
  attrNS(el, 'y2', y2);
  objects.appendChild(el);

  tracers.set(getId(), { el, ttl: 50 });
}

/**
 * Fire the shotgun, consisting of 2 high-powered rounds.
 */
function fireShotgun(id: number, x: number, y: number, dir: number, aim: number, seed: number) {
  fireGun(id, x, y, dir, aim, seed, 1, [40, 45], 0.05, 1000, 12);
  reduceWeaponCount();
}

/**
 * Fire the uzi, consisting of 10 low-powered rounds that sprad out more.
 */
function fireUzi(id: number, x: number, y: number, dir: number, aim: number, seed: number) {
  fireGun(id, x, y, dir, aim, seed, 8, [12, 16], 0.1, 50, 13);
  reduceWeaponCount();
}

/**
 * Fire the uzi, consisting of 10 low-powered rounds that sprad out more.
 */
function fireMinigun(id: number, x: number, y: number, dir: number, aim: number, seed: number) {
  fireGun(id, x, y, dir, aim, seed, 30, [16, 20], 0.125, 40, 18);
  reduceWeaponCount();
}

/**
 * Fire a generic gun.
 */
async function fireGun(id: number, x: number, y: number, dir: number, aim: number, seed: number, rounds: number, power: [number, number], spread: number, delay: number, action: number) {
  if (master) {
    socketAction(action, pack(id, x, y, dir, aim, seed));
  }

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
      const sx = x + nx * 20;
      const sy = y + ny * 20;

      const tx = x + nx * dist;
      const ty = y + ny * dist;
  
      if (lock) {
        lockCamera({ x: tx, y: ty });
      }
  
      setTimeout(() => {
        addTracer(sx, sy, tx, ty);
        flashMuzzle(sx, sy);
        sfx(SFX_GUNSHOT);

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
  return getElement(objects, 'w4', d.id, (el) => {
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
    // socketActionAddDynamite(id, x, y);
    socketAction(15, pack(id, x, y));
  }

  const sx = x;
  const sy = y - 5;

  const d: Dynamite = { id, x: sx, y: sy, dmg: rngi(90, 100), ttl: 5000 };
  dynamites.set(id, d);

  cancelEndTurn();
  reduceWeaponCount();
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
  const type = g.holy ? 'w6' : g.cluster ? 'w9' : 'w5';

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
      const mag = magnitude([g.dx, g.dy])
      if (mag > 0.4) {
        addSmoke(g.x, g.y);
        
      }

      if (mag > 0.2) {
        sfx([mag * 3, ...SFX_BOUNCE]);
      }

      // Bring the grenade back up to the surface.
      const [dist, type, payload] = raycast(g.x, g.y + 8, 0, -1);
      if (dist !== Infinity && dist > 0) {
        g.y -= dist;
      }

      // Surface vector (to be determined, based on the raycast result type.
      let surface: Vector = [1, 0];

      // Bounce off the terrain (type = 0)
      if (type === 0) {
        const j = Math.floor(g.x / 10);
        const g1: Vector = [j * 10, GROUND + heights[j]];
        const g2: Vector = [(j + 1) * 10, GROUND + heights[j + 1]];
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
      // socketActionSyncGrenade(g.id, g.x, g.y, g.dx, g.dy);
      socketAction(8, pack(g.x, g.y, g.dx, g.dy), g.id);
    }

    // Explode the grenade when the fuse has run down.
    if (master && g.ttl <= 0) {
      // socketActionRemoveGrenade(g.id);
      socketAction(9, '', g.id);
      explodeGrenade(g);
    }
  }
}

/**
 * 
 */
function fireGrenade(id: number, x: number, y: number, dir: number, aim: number, power: number, holy = false, cluster = false) {
  if (master) {
    // const fn = holy ? socketActionAddHolyHandGrenade : cluster ? socketActionAddClusterBomb : socketActionAddGrenade;
    // fn(id, x, y, dir, aim, power);
    const type = holy ? 17 : cluster ? 20 : 16;
    socketAction(type, pack(id, x, y, dir, aim, power));
  }

  const sx = x;
  const sy = y - 10;

  const dx = Math.cos(aim) * power * 1.25 * dir;
  const dy = Math.sin(aim) * power * 1.25;

  const dmg = rngi(55, 65) * (holy ? 3 : 1);

  const g: Grenade = { id, x: sx, y: sy, dx, dy, holy, cluster, power: dmg, ttl: 5000 };
  grenades.set(id, g);

  lockCamera(g);
  cancelEndTurn();
  reduceWeaponCount();
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
    const power = g.holy ? rngi(70, 90) : g.cluster ? rngi(40, 60) : 0;

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
    // socketActionAddCricketBat(pid, x, y, dir, aim);
    socketAction(22, pack(pid, x, y, dir, aim));

    let hit = false;

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
        flashMuzzle(p2.x, p2.y - 10);
        hit = true;
      }
    }

    if (!hit) {
      paused = false;
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
  let horizontal = 0
  let vertical = 0;

  // Mouse scrolling.
  if (mouse.over && master && connected) {
    if (mouse.x > vw - 100) {
      horizontal = 1;
    } else if (mouse.x < 100) {
      horizontal = -1;
    }

    if (mouse.y > vh - 100) {
      vertical = 1;
    } else if (mouse.y < 100) {
      const min = vw / 2 - 420;
      const max = vw / 2 + 420;
      if (mouse.x < min || mouse.x > max) {
        vertical = -1;
      }
    }
  }

  const dx = horizontal * delta / 2;
  const dy = vertical * delta / 2;

  const minx = vw / 2;
  const maxx = WW - minx;

  const miny = vh / 2;
  const maxy = WH - miny;

  // Allow free movement of the camera.
  if (horizontal !== 0 || vertical !== 0) {
    if (!camera.free) {
      camera.free = true;
      camera.to = { x: camera.to.x, y: camera.to.y };
    }

    camera.to.x = clamp(camera.to.x + dx, minx, maxx);
    camera.to.y = clamp(camera.to.y + dy, miny, maxy);

    if (master) {
      socketAction(24, pack(camera.to.x, camera.to.y));
    }
  }

  const tx = clamp(camera.to.x, minx, maxx);
  const ty = clamp(camera.to.y, miny, maxy);

  camera.x = lerp(camera.x, tx, 0.0075 * delta);
  if (Math.abs(camera.x - tx) < 0.1) {
    camera.x = tx;
  }

  camera.y = lerp(camera.y, ty, 0.0075 * delta);
  if (Math.abs(camera.y - ty) < 0.1) {
    camera.y = ty;
  }

  camera.ttl = Math.max(camera.ttl - delta, 0);
  const shake = camera.ttl > 0 ? Math.sin(camera.ttl / 15) * (camera.ttl / 20) : 0;

  const cx = clamp(camera.x, minx, maxx) - (vw / 2) + shake;
  const cy = clamp(camera.y, miny, maxy) - (vh / 2);

  document.body.scrollTo({ left: ~~cx, top: ~~cy });
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

  if (master) {
    socketAction(25);
  }
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
 * Cast a ray in a given direction, to find the distance to the nearest hole, or to the surface.
 * This will give us the distance back to a floor/ceiling/wall, so that we can push the player
 * back to where they belong.
 */
function raycast(x: number, y: number, dx: number, dy: number): [number, number, any] {
  let dist = Infinity;
  let type = -1;
  let payload = null;

  if (checkCollision(x, y)) {
    // Cast in the direction the object is moving.
    const [nx, ny] = normalize([dx, dy]);
    const ray: Raycast = { x, y, nx, ny };

    // Distance to the nearest hole.
    for (const h of holes) {
      const d = distToHole(ray, h);
      if (d < dist) {
        dist = d;
        type = 1;
        payload = h;
      }
    }

    // Distance UP to the surface, if it hit no holes.
    if (dy === -1) {
      const d = y - getTerrainHeight(x);
      if (d < dist) {
        dist = d;
        type = 0;
      }
    }

    // Distance RIGHT to a surface segment.
    if (dx === 1) {
      let x1 = 0
      let y1 = 0;
      let x2 = x - (x % 10);
      let y2 = 0;

      while (x2 < WW) {
        x1 = x2;
        y1 = y2;
        x2 = x1 + 10;
        y2 = getTerrainHeight(x2);

        if (y >= y1 && y <= y2) {
          const d = lerp(x1, x2, unlerp(y, y1, y2)) - x;
          if (d < dist) {
            dist = d;
            type = 0;
          }
        }
      }
    }

    // Distance LEFT to a surface segment.
    if (dx === -1) {
      let x1 = 0
      let y1 = 0;
      let x2 = x - (x % 10) + 10;
      let y2 = 0;

      while (x2 > 0) {
        x1 = x2;
        y1 = y2;
        x2 = x1 - 10;
        y2 = getTerrainHeight(x2);

        if (y >= y1 && y <= y2) {
          const d = x - lerp(x1, x2, unlerp(y, y1, y2));
          if (d < dist) {
            dist = d;
            type = 0;
          }
        }
      }
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

    if (ix < 0 || ix > WW || iy < 0 || iy > WH) {
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
 * Determine if a given point is inside of a circle.
 */
function insideCircle(x: number, y: number, cx: number, cy: number, r2: number): boolean {
  return sqdist(x, y, cx, cy) < r2;
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

// ================================================================================================
// ======== TERRAIN ===============================================================================
// ================================================================================================

/**
 * 
 */
function initHeights() {
  for (let i = 0; i < WW + 10; i += 10) {
    const base = 0 - Math.sin(i / WW * Math.PI);
    const aux = Math.abs(noise(i, 5, WORLD_SCALE, 0.4));
    heights.push(Math.round((base * NOISE_AMPLITUDE) - (aux * NOISE_AMPLITUDE / 2)));
  }
}

/**
 * Initialise all of the terrain layers.
 * Generate noise-based heights for the terrain across the x-axis.
 */
function initTerrain(home = false) {
  holes = [];
  initMasks(home);

  let t = 0;
  for (let offset of [10,0,0,20,35,35]) {
    initTerrainLayer('l' + t++, home, offset);
  }

  if (home) {
    // Initialise the water when the terrain is first setup, on the home screen.
    for (let i = 0; i < 6; i++) {
      initWater('o' + (6 - i), i * 20);
    }

    // Add a few holes to make the home screen look more interesting.
    addHoles(1300, WH - 820, 80);
    addHoles(690, WH - 650, 80);
    addHoles(1970, WH - 520, 80);
  }
}

/**
 * 
 */
function initTerrainDamage() {
  for (let i = 0; i < 10; i++) {
    const cx = rngi(1000, WW - 1000);
    const cy = getTerrainHeight(cx);

    if (checkCollision(cx, cy + 10)) {
      addHoles(cx, cy, rngi(60, 120));
    }
  }
}

/**
 * Initialise a terrain layer.
 */
function initTerrainLayer(id: string, home = false, offset: number): HTMLElement {
  const layer = docElem(id)!;
  layer.innerHTML = '';

  // Start bottom left.
  let d = `M0 ${WH}`;

  if (home) {
    d += `L0 ${WH - 900}L${WW} ${WH - 900}`;
  } else {
    let j = 0;
    for (let h of heights) {
      d += `L${j++ * 10} ${GROUND + offset + h}`;
    }
  }

  // Finish bottom right.
  d += `L${WW} ${WH}Z`;
  attr(layer, 'd', d);

  return layer;
}

/**
 * 
 */
function initMasks(home = false) {
  masks = [];
  for (const offset of [10,0,0,15,25]) {
    masks.push(initMask('m' + masks.length, home, offset));
  }
}

/**
 * Initialise a mask layer.
 */
function initMask(id: string, home = false, offset: number): HTMLElement {
  const layer = docElem(id)!;
  
  const path = elemSVG('path');
  attrNS(path, 'd', `M-10,0 L${WW},0 L${WW},${WH + 10} L-10,${WH + 10} Z`);
  attrNS(path, 'fill', home ? 'black' : 'white');
  layer.appendChild(path);

  if (home) {
    const logo1 = logo.cloneNode(true) as HTMLElement;
    attrNS(logo1, 'transform', `translate(680, ${WH - 820 + offset}) scale(4.5)`);
    layer.appendChild(logo1);

    const logo2 = logo.cloneNode(true) as HTMLElement;
    attrNS(logo2, 'transform', `translate(680, ${WH - 790}) scale(4.5)`);
    layer.appendChild(logo2);
  }

  return layer;
}

/**
 * Initialise the size of the water layers.
 */
function initWater(id: string, offset: number) {
  const rect = docElem(id)!;
  attrNS(rect, 'x', (-offset * 2.7 + rngi(-40, 0)));
  attrNS(rect, 'y', (WH - 200 - offset));
  attrNS(rect, 'width', OCEAN_SIZE);
}

/**
 * Get the height of the terrain at a given point, which is used for collision checks and also when
 * raycasting.
 */
function getTerrainHeight(x: number): number {
  const j = Math.floor(x / 10);
  const g1 = GROUND + heights[j];
  const g2 = GROUND + heights[j + 1];
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

  if (master) {
    const r2 = Math.pow(r * 1.5, 2);

    // Track the player that has been impacted the most by the blast,
    // so that the camera can follow them.
    let fi: number | null = null;
    let fv = 0;

    for (let i = 0; i < players.length; i++) {
      const p = players[i];

      // Some blasts don't impact the player creating them, such as for the
      // shotgun, uzi, and minigun. Also, don't impact dead worms.
      if (ignorePlayer === i || p.dead) {
        continue;
      }

      const d2 = sqdist(x, y, p.x, p.y);

      if (d2 < r2) {
        const damage = (1 - (d2 / r2)) * r / 2;
        const force = Math.log2((1 - (d2 / r2)) * r) / 2;
        const angle = Math.atan2(p.y - y, p.x - x);
        const velocity = kb * force * 0.2;

        // This player was impacted more that any previous player, so they
        // become the current favourite for the camera to track.
        if (velocity > fv) {
          fv = velocity;
          fi = i;
        }

        p.ragdoll = true;
        p.dx = velocity * Math.cos(angle);
        p.dy = velocity * Math.sin(angle) - 0.1;
        p.vr = Math.max(10, force * 10 * p.dir);
        p.hp = Math.max(Math.floor(p.hp - damage), 0);

        updatePlayerHealth(p);
      }
    }

    // Track the player that is moving around the most.
    if (fi !== null) {
      lockCamera(players[fi]);
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

  holes.push({ x, y, r, r2: r * r });
}

/**
 * Punch a hole through a single layer of terrain.
 */
function addHole(layer: HTMLElement, x: number, y: number, r: number) {
  const circle = elemSVG('circle');
  attrNS(circle, 'cx', x);
  attrNS(circle, 'cy', y);
  attrNS(circle, 'r', r);
  attrNS(circle, 'fill', 'black');
  layer.appendChild(circle);
}

// ================================================================================================
// ======== INITIALISATION ========================================================================
// ================================================================================================

/**
 * Initialise the primary SVG wrapper.
 */
function initSvg() {
  attr(svg, 'width', WW);
  attr(svg, 'height', WH);
  attr(svg2, 'width', WW);
  attr(svg2, 'height', WH);
  attr(svg3, 'width', WW);
  attr(svg3, 'height', WH);

  document.body.style.cursor = `url('data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="27" height="36"><path fill="#FF418B" stroke="#000" stroke-width="2" d="m20 25 2 6c0 2-4 4-7 4-2 0-3-2-5-5l-5 2c-3 0-4-6-4-15C1 9 1 3 3 1c2-1 7 2 13 8 6 4 10 9 10 11s-2 4-6 5Z"/><path fill="#FF859F" d="M4 5c1-3 3-1 5 1-5-2-5 6-4 22C3 21 3 8 4 5Z"/></svg>')}') 6 5, pointer`;

  // Duplicate the crosshairs icon into a few places.
  crosshairs.innerHTML = ch.innerHTML;
  targetlock.innerHTML = ch.innerHTML;
}

/**
 * 
 */
function initMenu() {
  text(menu1, 'START LOCAL GAME');
  text(menu2, 'START REMOTE GAME');
  text(menu3, 'JOIN REMOTE GAME');

  menuShow(menu1, true);
  menuShow(menu2, true);
  menuShow(menu3, true);

  menu1.onclick = startRegularGame;
  menu2.onclick = startMultiplayerGame;
  menu3.onclick = showCodeInput;
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
 * The inverse of linear interpolation.
 */
function unlerp(x: number, a: number, b: number): number {
  return (x - a) / (b - a);
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
function attr(element: Element, name: string, value: string | number) {
  element.setAttribute(name, '' + value);
}

/**
 * Set an attribute on aa namespaced (SVG) element.
 */
function attrNS(element: Element | null, name: string, value: string | number) {
  element?.setAttributeNS(null, name, '' + value);
}

/**
 * 
 */
function sprop(element: HTMLElement, name: string, value: string | number) {
  element.style.setProperty(name, '' + value);
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
    el = docElem(key)!.cloneNode(true) as E;
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

/**
 * 
 */
function menuShow(el: HTMLElement, show: boolean) {
  el.style.opacity = show ? '1' : '0';
}

// ================================================================================================
// ======== BITMAP TEXT ===========================================================================
// ================================================================================================

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

/**
 * 
 */
function updateStateSync(delta: number) {
  if (socket && socket.readyState === 1) {
    syncttl += delta;

    if (syncttl >= 50 && pending.size > 0) {
      syncttl -= 50;
      socket.send([...pending.values()].join('\n'));
      pending.clear();
    }
  }
}

/**
 * 
 */
function socketInit(code: string) {
  socket = new WebSocket('wss://relay.js13kgames.com/worms-13k/' + code);
  socket.onmessage = socketReceive;
}

/**
 * 
 */
function socketAction(type: number, data = '', id: number | null = null, cache = false) {
  const prefix = (type < 10 ? '0' : '') + type + (id !== null ? '|' + id : '');
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
function socketActionGameState() {
  socketAction(2, pack(activeTeam, activePlayer, activeWeapon, windSpeed));
}

/**
 * 
 */
function socketActionAddBlast(id: number, x: number, y: number, r: number) {
  socketAction(10, pack(x, y, r), id);
}

/**
 * 
 */
function socketReceive(event: MessageEvent<string>) {
  const actions = event.data.split('\n');
  
  for (const action of actions) {
    const code = parseInt(action.substring(0, 2));
    const data = action.substring(3);
    const cb = callbacks[code];
    cb?.(data);
  }
}

/**
 * 
 */
function socketRegister(cb: (data: string) => void) {
  callbacks.push(cb);
}

//// CORE

// "00" Request from other client to join.
socketRegister(() => {
  if (!started) {
    // socketActionAcceptJoin();
    socketAction(1, JSON.stringify([heights, players, holes]));
    socketActionGameState();
    menuShow(menu4, false);
    connected = true;
    started = true;
  }
});

// "01" Response from master, accepting join request.
socketRegister((data) => {
  const json = JSON.parse(data);
  heights = json[0];
  players = json[1];

  initTeams();
  initTerrain(false);
  unlockCamera();
  menuShow(menu5, false);
  document.body.classList.add('started');
  started = true;
  master = false;
  connected = true;
  roundtime = 30;

  for (const h of json[2]) {
    addHoles(h.x, h.y, h.r);
  }

  for (const p of players) {
    updatePlayerHealth(p);
    text(getPlayerInfoElement(p, 2), NAMES[p.i]);
  }
});

// "02" Receive game state.
socketRegister((data) => {
  const values = unpack(data);
  activeTeam = int(values[0]);
  activePlayer = int(values[1]);
  activeWeapon = int(values[2]);
  windSpeed = f(values[3]);
  unlockCamera();
  updateWeaponUI();
});

// "03" End of turn.
socketRegister(() => {
  master = true;
  roundtime = 30;
  paused = false;
  caption(`TEAM ${activeTeam + 1} IT'S YOUR TURN`);
});

//// PLAYERS

// "04" Sync the state of a player.
socketRegister((data) => {
  const [i, x, y, dx, dy, aim, dir, hp, ix, power, r, jumped] = unpack(data);
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
    p.r = f(r);
    p.jumped = jumped === '1';

    if(p.hp !== int(hp)) {
      p.hp = int(hp);
      updatePlayerHealth(p);
    }
  }
});

// "05" Kill a player.
socketRegister((data) => {
  const [i, explode, immediate] = unpack(data);
  const p = players[int(i)];
  if (p) {
    killPlayer(p, explode === '1', immediate === '1');
  }
});

//// MISSILES

// "06" Sync the state of a missile.
socketRegister((data) => {
  const [id, x, y,dx, dy] = unpack(data);
  const m = missiles.get(int(id));
  if (m) {
    m.x = f(x);
    m.y = f(y);
    m.dx = f(dx);
    m.dy = f(dy);
  }
});

// "07" Remove a missile.
socketRegister((data) => {
  const [id] = unpack(data);
  const m = missiles.get(int(id));
  if (m) {
    explodeMissile(m);
  }
});

//// GRENADES

// "08" Sync the state of a grenade.
socketRegister((data) => {
  const [id, x, y,dx, dy] = unpack(data);
  const g = grenades.get(int(id));
  if (g) {
    g.x = f(x);
    g.y = f(y);
    g.dx = f(dx);
    g.dy = f(dy);
  }
});

// "09" Remove a missile.
socketRegister((data) => {
  const [id] = unpack(data);
  const g = grenades.get(int(id));
  if (g) {
    explodeGrenade(g);
  }
});

//// BLASTS

// "10" Add a new blast.
socketRegister((data) => {
  const [id, x, y, r] = unpack(data);
  addBlast(int(id), f(x), f(y), f(r), 1);
});

//// FIRE WEAPONS

// "11" Fire bazooka
socketRegister((data) => {
  const [id, x, y, dir, aim, power] = unpack(data);
  fireBazooka(int(id), f(x), f(y), int(dir), f(aim), f(power));
});

// "12" Fire shotgun.
socketRegister((data) => {
  const [id, x, y, dir, aim, seed] = unpack(data);
  fireShotgun(int(id), f(x), f(y), int(dir), f(aim), int(seed));
});

// "13" Fire shotgun.
socketRegister((data) => {
  const [id, x, y, dir, aim, seed] = unpack(data);
  fireUzi(int(id), f(x), f(y), int(dir), f(aim), int(seed));
});

// "14" Fire air strike.
socketRegister((data) => {
  const [id, x, tx, ty] = unpack(data);
  fireAirStrike(int(id), f(x), f(tx), f(ty));
});

// "15" Fire dynamite.
socketRegister((data) => {
  const [id, x, y] = unpack(data);
  placeDynamite(int(id), f(x), f(y));
});

// "16" Fire grenade.
socketRegister((data) => {
  const [id, x, y, dir, aim, power] = unpack(data);
  fireGrenade(int(id), f(x), f(y), int(dir), f(aim), f(power));
});

// "17" Fire unholy black cat.
socketRegister((data) => {
  const [id, x, y, dir, aim, power] = unpack(data);
  fireHolyHandGrenade(int(id), f(x), f(y), int(dir), f(aim), f(power));
});

// "18" Fire minigun.
socketRegister((data) => {
  const [id, x, y, dir, aim, seed] = unpack(data);
  fireMinigun(int(id), f(x), f(y), int(dir), f(aim), int(seed));
});

// "19" Fire homing missile.
socketRegister((data) => {
  const [id, x, y, dir, aim, power, tx, ty] = unpack(data);
  fireHomingMissile(int(id), f(x), f(y), int(dir), f(aim), f(power), f(tx), f(ty));
});

// "20" Fire cluster bomb.
socketRegister((data) => {
  const [id, x, y, dir, aim, power] = unpack(data);
  fireClusterBomb(int(id), f(x), f(y), int(dir), f(aim), f(power));
});

// "21" Fire nyan cat strike.
socketRegister((data) => {
  const [id, tx, ty, seed] = unpack(data);
  fireNyanCats(int(id), f(tx), f(ty), int(seed));
});

// "22" Fire cricket bat.
socketRegister((data) => {
  const [pid, x, y, dir, aim] = unpack(data);
  fireCricketBat(int(pid), f(x), f(y), int(dir), f(aim));
});

// "23" Fire charge (invisible missile).
socketRegister((data) => {
  const [id, x, y, dx, dy, power] = unpack(data);
  fireCharge(int(id), f(x), f(y), f(dx), f(dy), f(power));
});

//// CAMERA

// "24" Switch the camera into free movement mode.
socketRegister((data) => {
  const [x, y] = unpack(data);
  camera.free = true;
  camera.to = { x: int(x), y: int(y) };
});

// "25" Unlock the camera.
socketRegister(() => {
  unlockCamera();
});

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
