export type Vertex = [number, number];

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
  ttl: number;
  el: HTMLElement;
};

export type Tracer = {
  ttl: number;
  el: SVGLineElement;
};

export type Missile = Position & {
  dx: number;
  dy: number;
  power: number
  el: Element;
  wind?: boolean;
};

export type Player = Position & {
  team: number;
  dx: number;
  dy: number;
  r: number;
  vr: number;
  aim: number;
  power: number;
  dir: -1 | 1;
  el: Element;
  onGround?: boolean;
  ragdoll?: boolean;
  hasFired?: boolean;
};

export type Raycast = Position & {
  nx: number;
  ny: number;
};

export type Camera = {
  to: Position;
  x: number;
  free: boolean;
};

export type WeaponConfig = {
  id: number;
  key: string;
  label: string;
  power?: boolean;
  aim?: boolean;
  target?: boolean;
};
