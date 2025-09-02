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
    key: '1',
    label: 'BAZOOKA',
    icon: '<g transform="translate(24 24) rotate(-45) scale(1.55)"><use href="#missile" /></g>',
    power: true,
    aim: true,
  },
  {
    id: 1,
    key: '2',
    label: 'SHOTGUN',
    icon: '<use href="#shotgun" />',
    aim: true,
  },
  {
    id: 2,
    key: '3',
    label: 'UZI',
    icon: '<use href="#uzi" />',
    aim: true,
  },
  {
    id: 3,
    key: '4',
    label: 'AIR STRIKE',
    icon: '<g transform="translate(24 28) rotate(90) scale(0.8)"><use href="#missile" /></g><g transform="translate(12 20) rotate(90) scale(0.8)"><use href="#missile" /></g><g transform="translate(36 20) rotate(90) scale(0.8)"><use href="#missile" /></g>',
    target: true,
  },
  {
    id: 4,
    key: '5',
    label: 'DYNAMITE',
    icon: '<g transform="translate(24 32) scale(1.1)"><use href="#dynamite" /></g>',
    place: true,
  },
  {
    id: 5,
    key: '6',
    label: 'GRENADE',
    icon: '<g transform="translate(24 24) scale(2.1)"><use href="#grenade" /></g>',
    power: true,
    aim: true,
  },
  {
    id: 6,
    key: '7',
    label: 'UNHOLY BLACK CAT',
    icon: '<g transform="translate(24 24) scale(1.2)"><use href="#holy" /></g>',
    power: true,
    aim: true,
  },
  {
    id: 7,
    key: '8',
    label: 'MINIGUN',
    icon: '<use href="#minigun" />',
    aim: true,
  },
];
