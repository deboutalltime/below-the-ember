export const weapons = [
    { id: 'spark', name: 'Sparkcaster', key: '1', description: 'Accurate ember bolts', rate: 1, damage: 1, range: 1, special: 'Ember fan', heat: 18 },
    { id: 'scatter', name: 'Ash Scattergun', key: '2', description: 'Five close-range pellets', rate: .55, damage: .52, range: .52, special: 'Cinder nova', heat: 16 },
    { id: 'spear', name: 'Coal Lance', key: '3', description: 'Hold fire to charge a piercing lance', rate: .65, damage: 2.1, range: 1.4, special: 'Heartpiercer', heat: 24 },
    { id: 'chain', name: 'Flame Chain', key: '4', description: 'A short arc that strikes a group', rate: .85, damage: .95, range: .45, special: 'Chain lightning', heat: 22 },
] as const;
export const upgrades = [
    ['♥', 'Ember Heart', '+20 maximum HP and restore 20'], ['➤', 'Swift Boots', '+15% movement speed'],
    ['✦', 'Sharpened Flame', '+20% weapon damage'], ['»', 'Rapid Fire', '+15% attack speed'],
    ['⬡', 'Iron Skin', '10% less incoming damage'], ['⋔', 'Flame Split', '+1 bolt or pellet (maximum 5 bolt streams)'],
    ['✚', 'Vital Spark', 'Restore 30 HP'], ['⌁', 'Longshot', '+20% projectile range'],
    ['ϟ', 'Ember Surge', '20% shorter dash cooldown'], ['♨', 'Burning Rounds', 'Hits ignite foes for 3 seconds'],
    ['↗', 'Rebound', 'Bolts bounce off one extra wall (maximum 3)'], ['✹', 'Ash Cascade', 'Burning foes explode on defeat'],
    ['〰', 'Cinderwake', 'Dashes leave damaging flame on the ground'], ['↑', 'Through the Ash', 'Bolts pierce one extra enemy'],
    ['❖', 'Warmth Siphon', '+5 heat and +2 HP per defeated foe'], ['◈', 'Quiet Wick', 'Shots make 35% less noise'],
    ['✧', 'Searing Focus', '+35% lance charge damage'], ['♜', 'Last Ember', 'Once per floor, spend 40 heat to survive a fatal hit'],
];
export const upgradeRarity = ['Rare', 'Common', 'Rare', 'Common', 'Rare', 'Legendary', 'Common', 'Common', 'Epic', 'Epic', 'Rare', 'Epic', 'Rare', 'Rare', 'Rare', 'Common', 'Epic', 'Legendary'];
export const curseNames = { hunger: 'Hungry Flame', thunder: 'Thunderstep', frailty: 'Glass Covenant' };
export const floorLore = [
    'The keeper at the gate calls your ember a memory. Someone below still remembers its name.',
    'The smith recognizes the scorch marks: these halls were burned from within.',
    'The archivist speaks of guardians who learned to fear the very light they protected.',
    'A final inscription names the Warden. It has kept the last door shut for centuries.',
    'The heart is not an ending. Carry what remains back into the world.',
];
