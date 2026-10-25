import { upgradeRarity } from '../game/content';
/** Presentation palette only. Physics, generation and AI use their original units. */
export const VIEW = { width: 480, height: 270, tile: 16, worldScale: 2 / 3 };
export interface FloorTheme {
    name: string; epithet: string; floor: number[]; wall: number; edge: number;
    mortar: number; dust: number; accent: number; glow: number; symbol: number;
}
export const floorThemes: FloorTheme[] = [
    { name: 'Forgotten Entrance', epithet: 'Where the silence begins', floor: [0x303640, 0x343b45, 0x2c333c, 0x373d45], wall: 0x424a56, edge: 0x626875, mortar: 0x171e28, dust: 0x626257, accent: 0xffa65d, glow: 0xff7733, symbol: 0x7a7565 },
    { name: 'Ashen Corridors', epithet: 'All that fire leaves behind', floor: [0x302b2d, 0x352f30, 0x29282d, 0x393133], wall: 0x484047, edge: 0x6b5655, mortar: 0x1b1a22, dust: 0x686064, accent: 0xff9251, glow: 0xff682e, symbol: 0x92674b },
    { name: 'Hollow Depths', epithet: 'The stone remembers', floor: [0x243540, 0x293a46, 0x29333e, 0x2e3f48], wall: 0x354957, edge: 0x536f7c, mortar: 0x121f2c, dust: 0x495d6b, accent: 0x54d6da, glow: 0x3998ac, symbol: 0x52898b },
    { name: 'Burning Catacombs', epithet: 'Beneath a sky of cinders', floor: [0x352c31, 0x3b2d31, 0x2b262e, 0x3e3236], wall: 0x49363c, edge: 0x795254, mortar: 0x211921, dust: 0x69525a, accent: 0xff8650, glow: 0xe44b32, symbol: 0xa34f3c },
    { name: 'Heart of the Ember', epithet: 'The last flame waits below', floor: [0x312e37, 0x38323b, 0x2d2933, 0x3b3540], wall: 0x4b4050, edge: 0x78616b, mortar: 0x1c1722, dust: 0x6b5967, accent: 0xffc16a, glow: 0xff7733, symbol: 0xa47b50 },
];
export const rarity = upgradeRarity.map(name => ({ name, color: ({ Common: '#a4a6af', Rare: '#54d6da', Epic: '#9974d8', Legendary: '#ffc16a' } as Record<string, string>)[name] }));
export const hex = (color: number) => '#' + color.toString(16).padStart(6, '0');
export const hash = (x: number, y: number, salt = 0) => ((Math.imul(x + salt, 73856093) ^ Math.imul(y + salt, 19349663)) >>> 0);
