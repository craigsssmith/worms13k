type RaycastFunction = (x: number, y: number) => number;
type InitOptions = {
  raycast: RaycastFunction;
}

// Debug raycast line.
const debug = document.getElementById('debug')! as unknown as SVGPathElement;

// Current mouse position.
const mouse = { x: 0, y: 0 };

// Supplied utilities.
let raycast: RaycastFunction = () => Infinity;

/**
 * Initialise the debugging mode.
 */
export function initDebugging(options: InitOptions) {
  raycast = options.raycast;

  // Start the main game loop.
  requestAnimationFrame(tick);

  // Keep track of the mouse position.
  addEventListener('mousemove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });
}

/**
 * Update the debug state every frame.
 */
function tick(): void {
  requestAnimationFrame(tick);
  updateRaycast(mouse.x, mouse.y);
}

/**
 * 
 */
function updateRaycast(x: number, y: number) {
  const dist = raycast(x, y);

  if (dist !== Infinity && dist > 4) {
    debug.setAttributeNS(null, 'd', `M${x},${y} l0,-${dist - 4}`);
  } else {
    debug.setAttributeNS(null, 'd', '');
  }
}


// function testShotgun() {
//   const player = players[activePlayer];

//   const angle = player.dir === 1 ? player.aim : Math.PI - player.aim;
//   const px = player.x;
//   const py = player.y - 10;
//   const nx = Math.cos(angle);
//   const ny = Math.sin(angle);
//   const dist = raycastBrute(px, py, nx, ny);

//   if (dist !== Infinity) {
//     debug.setAttributeNS(null, 'd', `M${player.x},${player.y - 10} l${nx * dist},${ny * dist}`);
//   } else {
//     debug.setAttributeNS(null, 'd', '');
//   }
// }