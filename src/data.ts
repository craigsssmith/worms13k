import type { WeaponConfig } from "./types";

export const WEAPONS: WeaponConfig[] = [
  {
    id: 0,
    key: 'Digit1',
    label: '1. Bazooka',
    power: true,
    aim: true,
  },
  {
    id: 1,
    key: 'Digit2',
    label: '2. Shotgun',
    aim: true,
  },
  {
    id: 2,
    key: 'Digit3',
    label: '3. Uzi',
    aim: true,
  },
  {
    id: 3,
    key: 'Digit4',
    label: '4. Air Strike',
    target: true,
  },
];
