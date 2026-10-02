export interface CharacterPart {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const CHARACTER_CANVAS = { width: 1024, height: 1536 } as const;

export const CHARACTER_PARTS = {
  "cable_cuff_connector": {
    "src": "/character-parts/cable_cuff_connector.webp",
    "x": 515,
    "y": 416,
    "width": 42,
    "height": 67
  },
  "cable_upper": {
    "src": "/character-parts/cable_upper.webp",
    "x": 496,
    "y": 324,
    "width": 57,
    "height": 94
  },
  "cable_waist_connector": {
    "src": "/character-parts/cable_waist_connector.webp",
    "x": 596,
    "y": 675,
    "width": 50,
    "height": 30
  },
  "coat_back_R": {
    "src": "/character-parts/coat_back_R.webp",
    "x": 207,
    "y": 431,
    "width": 731,
    "height": 861
  },
  "coat_back_center": {
    "src": "/character-parts/coat_back_center.webp",
    "x": 426,
    "y": 750,
    "width": 127,
    "height": 464
  },
  "coat_front_purple": {
    "src": "/character-parts/coat_front_purple.webp",
    "x": 65,
    "y": 37,
    "width": 911,
    "height": 1395
  },
  "coat_front_white": {
    "src": "/character-parts/coat_front_white.webp",
    "x": 273,
    "y": 37,
    "width": 627,
    "height": 1426
  },
  "cuff_L": {
    "src": "/character-parts/cuff_L.webp",
    "x": 438,
    "y": 402,
    "width": 91,
    "height": 108
  },
  "cuff_R": {
    "src": "/character-parts/cuff_R.webp",
    "x": 233,
    "y": 404,
    "width": 106,
    "height": 103
  },
  "foot_L": {
    "src": "/character-parts/foot_L.webp",
    "x": 547,
    "y": 1239,
    "width": 194,
    "height": 261
  },
  "foot_R": {
    "src": "/character-parts/foot_R.webp",
    "x": 190,
    "y": 1220,
    "width": 256,
    "height": 258
  },
  "forearm_L": {
    "src": "/character-parts/forearm_L.webp",
    "x": 394,
    "y": 386,
    "width": 83,
    "height": 88
  },
  "gauntlet_R": {
    "src": "/character-parts/gauntlet_R.webp",
    "x": 202,
    "y": 337,
    "width": 112,
    "height": 134
  },
  "hand_L": {
    "src": "/character-parts/hand_L.webp",
    "x": 273,
    "y": 328,
    "width": 593,
    "height": 800
  },
  "hand_R": {
    "src": "/character-parts/hand_R.webp",
    "x": 162,
    "y": 229,
    "width": 98,
    "height": 138
  },
  "harness_chest": {
    "src": "/character-parts/harness_chest.webp",
    "x": 457,
    "y": 212,
    "width": 200,
    "height": 140
  },
  "head": {
    "src": "/character-parts/head.webp",
    "x": 406,
    "y": 0,
    "width": 213,
    "height": 203
  },
  "inner_cloth": {
    "src": "/character-parts/inner_cloth.webp",
    "x": 369,
    "y": 184,
    "width": 157,
    "height": 342
  },
  "leg_device_L": {
    "src": "/character-parts/leg_device_L.webp",
    "x": 574,
    "y": 1007,
    "width": 78,
    "height": 124
  },
  "leg_device_R": {
    "src": "/character-parts/leg_device_R.webp",
    "x": 261,
    "y": 710,
    "width": 77,
    "height": 128
  },
  "neck": {
    "src": "/character-parts/neck.webp",
    "x": 436,
    "y": 130,
    "width": 119,
    "height": 82
  },
  "pants_L": {
    "src": "/character-parts/pants_L.webp",
    "x": 434,
    "y": 544,
    "width": 237,
    "height": 709
  },
  "pants_R": {
    "src": "/character-parts/pants_R.webp",
    "x": 137,
    "y": 484,
    "width": 555,
    "height": 782
  },
  "sleeve_L": {
    "src": "/character-parts/sleeve_L.webp",
    "x": 497,
    "y": 241,
    "width": 210,
    "height": 299
  },
  "sleeve_R": {
    "src": "/character-parts/sleeve_R.webp",
    "x": 236,
    "y": 230,
    "width": 168,
    "height": 308
  },
  "torso_jacket": {
    "src": "/character-parts/torso_jacket.webp",
    "x": 321,
    "y": 167,
    "width": 409,
    "height": 480
  },
  "waist_belt": {
    "src": "/character-parts/waist_belt.webp",
    "x": 314,
    "y": 486,
    "width": 552,
    "height": 642
  },
  "waist_device_inner": {
    "src": "/character-parts/waist_device_inner.webp",
    "x": 514,
    "y": 561,
    "width": 352,
    "height": 583
  },
  "waist_device_outer": {
    "src": "/character-parts/waist_device_outer.webp",
    "x": 578,
    "y": 557,
    "width": 75,
    "height": 131
  }
} as const satisfies Record<string, CharacterPart>;

export type CharacterPartName = keyof typeof CHARACTER_PARTS;
