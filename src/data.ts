import type { AnimationConfig, WeaponConfig } from "./types";

export const ANIMATIONS: AnimationConfig[] = [
  [
    // Idle
    ['M45 19c3 27 1 40-4 40-8 0-5-11-11-11s-7 11-16 11', 49, 51.5],
  ],
  [
    // Walk
    ['M51 19c3 27 1 40-4 40-8 0-8-11-18-11S21 59 7 59', 55, 57.5],
    ['M45 19c3 27 1 40-4 40-8 0-5-11-11-11s-7 11-16 11', 49, 51.5],
    ['M39 19c3 27 1 40-4 40-8 0-1-11-6-11s-3 11-13 11', 43, 45.5],
    ['M43 19c3 27 1 40-4 40-8 0-5-11-11-11s-7 11-16 11', 47, 49.5],
  ],
];

export const WEAPONS: WeaponConfig[] = [
  {
    id: 0,
    label: 'BAZOOKA',
    icon: '<g transform="translate(24 24) rotate(-45) scale(1.55)"><use href="#missile" /></g>',
    power: true,
    aim: true,
  },
  {
    id: 1,
    label: 'SHOTGUN',
    icon: '<use href="#shotgun" />',
    aim: true,
  },
  {
    id: 2,
    label: 'UZI',
    icon: '<use href="#uzi" />',
    aim: true,
  },
  {
    id: 3,
    label: 'AIR STRIKE',
    icon: '<g transform="translate(24 28) rotate(90) scale(0.8)"><use href="#missile" /></g><g transform="translate(12 20) rotate(90) scale(0.8)"><use href="#missile" /></g><g transform="translate(36 20) rotate(90) scale(0.8)"><use href="#missile" /></g>',
    target: true,
  },
  {
    id: 4,
    label: 'DYNAMITE',
    icon: '<g transform="translate(24 32) scale(1.1)"><use href="#dynamite" /></g>',
    place: true,
  },
  {
    id: 5,
    label: 'GRENADE',
    icon: '<g transform="translate(22 24) scale(1.9)"><use href="#grenade" /></g>',
    power: true,
    aim: true,
  },
  {
    id: 6,
    label: 'UNHOLY BLACK CAT',
    icon: '<g transform="translate(24 24) scale(1.2)"><use href="#holy" /></g>',
    power: true,
    aim: true,
  },
  {
    id: 7,
    label: 'MINIGUN',
    icon: '<use href="#minigun" />',
    aim: true,
  },
  {
    id: 8,
    label: 'HOMING MISSILE',
    icon: '<g transform="translate(32 16) scale(0.75)"><use href="#lock" /></g><g transform="translate(16 32) rotate(-45)"><use href="#homing" /></g>',
    power: true,
    aim: true,
    target: true,
  },
  {
    id: 9,
    label: 'CLUSTER BOMB',
    icon: '<g transform="translate(24 24) scale(1.9)"><use href="#clusterbomb" /></g>',
    power: true,
    aim: true,
  },
  {
    id: 10,
    label: 'NYAN CATS',
    icon: '<g transform="translate(24 24) scale(1.2)"><use href="#nyancat" /></g>',
    target: true,
  },
  {
    id: 11,
    label: 'CRICKET BAT',
    icon: '<use href="#cricketbat" />',
    aim: true,
  },
];
