export type Vertex = [number, number];
export type Vector = [number, number];

export type Position = {
  x: number;
  y: number;
};

export type Hole = Position & {
  r: number;
  r2: number;
};

export type Tunnel = {
  vs: Vertex[];
};

export type Explosion = Position & {
  r: number;
  ttl: number;
  el: Element;
};

export type Tracer = {
  ttl: number;
  el: SVGLineElement;
};

export type Missile = Position & {
  id: number;
  // gone?: boolean;
  dx: number;
  dy: number;
  tx?: number;
  ty?: number;
  power: number
  wind?: boolean;
  dt?: number;
  ttl?: number;
  grav?: boolean;
  nyan?: boolean;
  homing?: boolean;
  invis?: boolean;
};

export type Dynamite = Position & {
  id: number;
  ttl: number;
  dmg: number;
};

export type Grenade = Position & {
  id: number;
  dx: number;
  dy: number;
  ttl: number;
  holy: boolean;
  cluster: boolean;
  power: number;
};

// export type Grenade = [
//   number, // 0: id
//   number, // 1: x
//   number, // 2: y
//   number, // 3: dx
//   number, // 4: dy
//   number, // 5: ttl
//   number, // 6: power
//   number, // 7: unholy black cat?
//   number, // 8: cluster bomb?
// ];

export type Player = Position & {
  id: number;
  i: number;
  team: number;
  hp: number;
  ix: number;
  jumping: boolean;
  dx: number;
  dy: number;
  r: number;
  vr: number;
  aim: number;
  power: number;
  dir: -1 | 1;
  onGround?: boolean;
  ragdoll?: boolean;
  hasFired?: boolean;
  dead?: boolean;
  gone?: boolean;
  anim?: number;
  adt?: number;
  frame?: number;
  tx?: number;
  ty?: number;
};

export type Elements = {
  p: Element[];
  hp: Element[];
  m: Element[];
  d: Element[];
  g: Element[];
};

export type Raycast = Position & {
  nx: number;
  ny: number;
};

export type Camera = {
  to: Position; // | [number, number, number, ...number[]];
  x: number;
  free: boolean;
  ttl: number;
};

type WeaponIcon = (number | string | undefined)[];

export type WeaponConfig = [number, number, number, number, number, string, WeaponIcon[]];

export type AnimationConfig = [string, number, number][];