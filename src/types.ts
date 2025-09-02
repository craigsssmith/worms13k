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
  dx: number;
  dy: number;
  power: number
  el?: Element;
  wind?: boolean;
  dt?: number;
};

export type Dynamite = Position & {
  ttl: number;
  el: Element;
};

export type Grenade = Position & {
  dx: number;
  dy: number;
  ttl: number;
  el: Element;
  holy: boolean;
  power: number;
};

export type Player = Position & {
  i: number;
  team: number;
  hp: number;
  dx: number;
  dy: number;
  r: number;
  vr: number;
  aim: number;
  power: number;
  dir: -1 | 1;
  el1: Element;
  el2: Element;
  onGround?: boolean;
  ragdoll?: boolean;
  hasFired?: boolean;
  dead?: boolean;
  gone?: boolean;
  anim?: number;
  adt?: number;
  frame?: number;
};

export type Raycast = Position & {
  nx: number;
  ny: number;
};

export type Camera = {
  to: Position;
  x: number;
  free: boolean;
  ttl: number;
};

export type WeaponConfig = {
  id: number;
  key: string;
  label: string;
  icon: string;
  power?: boolean;
  aim?: boolean;
  target?: boolean;
  place?: boolean;
};

export type AnimationConfig = [string, number, number][];