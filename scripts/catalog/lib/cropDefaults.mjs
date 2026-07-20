/** Default spring timing by crop — confidence: low when inferred from category only */

const T = (indoor, harden, after, dth) => ({
  method: "transplant",
  indoorSowOffsetDays: indoor,
  hardenOffDaysBeforeTransplant: harden,
  transplantDaysAfterFrost: after,
  daysToHarvest: dth,
});

const D = (before, dth) => ({
  method: "direct",
  directSowDaysBeforeFrost: before,
  daysToHarvest: dth,
});

const DEFAULTS = {
  // Solanaceae — warm, transplant after frost
  tomato: T(56, 7, 0, 75),
  pepper: T(56, 7, 14, 70),
  eggplant: T(56, 7, 14, 75),
  tomatillo: T(56, 7, 14, 70),
  "ground-cherry": T(56, 7, 14, 70),
  potato: D(14, 90),

  // Brassicas — transplant before frost
  broccoli: T(84, 7, -14, 60),
  kale: T(42, 5, -21, 55),
  cabbage: T(70, 7, -14, 75),
  cauliflower: T(70, 7, -14, 70),
  "brussels-sprouts": T(84, 7, -14, 100),
  collards: T(42, 5, -21, 55),
  "asian-greens": D(14, 45),
  mustard: D(21, 40),
  arugula: D(28, 40),
  radish: D(28, 30),
  turnip: D(21, 55),
  rutabaga: D(21, 90),
  kohlrabi: T(42, 5, -14, 55),

  // Lettuce family
  lettuce: T(30, 5, -14, 45),
  endive: T(30, 5, -14, 85),
  escarole: T(30, 5, -14, 85),

  // Roots — direct, cool
  carrot: D(14, 70),
  beet: D(14, 55),
  parsnip: D(14, 110),
  spinach: D(42, 40),
  chard: D(14, 55),

  // Alliums
  onion: T(56, 7, -28, 100),
  leek: T(70, 7, -28, 120),
  shallot: T(56, 7, -28, 100),
  scallion: D(28, 70),
  garlic: D(150, 240), // ~fall plant: 150d before spring frost anchor

  // Legumes
  beans: D(0, 55),
  pea: D(28, 60),
  soybean: D(-7, 85),
  edamame: D(-7, 85),

  // Cucurbits — warm; negative = sow after last frost
  cucumber: T(21, 5, 7, 55),
  melon: T(28, 5, 14, 85),
  watermelon: T(28, 5, 14, 90),
  cantaloupe: T(28, 5, 14, 85),
  honeydew: T(28, 5, 14, 90),
  "squash-summer": D(-7, 55),
  "squash-winter": D(-14, 100),
  pumpkin: D(-14, 100),
  gourd: D(-14, 100),
  luffa: D(-14, 120),

  // Grains / warm direct
  corn: D(0, 75),
  amaranth: D(-7, 60),
  buckwheat: D(-7, 70),
  quinoa: D(-7, 100),
  flax: D(-7, 100),
  sunflower: D(-7, 90),

  // Herbs — transplant after frost
  basil: T(35, 5, 7, 45),
  cilantro: D(14, 45),
  parsley: T(42, 5, -7, 75),
  dill: D(14, 50),
  thyme: T(42, 5, 7, 80),
  oregano: T(42, 5, 7, 80),
  sage: T(56, 5, 7, 80),
  mint: T(42, 5, 7, 90),
  rosemary: T(70, 5, 14, 90),
  chamomile: D(14, 60),
  "lemon-balm": T(42, 5, 7, 70),
  marjoram: T(42, 5, 7, 70),
  catnip: T(42, 5, 7, 70),
  lovage: T(42, 5, 7, 90),
  shiso: T(35, 5, 7, 60),
  dandelion: D(14, 55),
  stevia: T(42, 5, 14, 90),
  hyssop: T(42, 5, 7, 80),
  savory: T(42, 5, 7, 70),
  borage: D(14, 60),
  chervil: D(14, 45),
  rue: T(56, 5, 7, 90),
  angelica: T(56, 5, -7, 365),
  valerian: T(56, 5, 7, 120),
  cumin: T(42, 5, 14, 120),
  "salad-burnet": D(14, 60),
  fennel: D(14, 90),

  // Greens
  cress: D(21, 30),
  watercress: D(21, 45),
  sorrel: D(21, 60),
  purslane: D(14, 50),
  orach: D(14, 45),
  microgreens: D(0, 21),
  celery: T(70, 7, -14, 90),

  // Fruits / perennials
  strawberry: D(14, 90),
  blueberry: D(14, 300),
  grape: T(70, 7, 14, 300),
  rhubarb: D(28, 300),
  artichoke: T(84, 7, -14, 90),
  asparagus: D(28, 300),
  okra: T(42, 5, 14, 60),

  // Roots / specialty
  horseradish: D(14, 300),
  ginger: D(14, 240),
  turmeric: D(14, 240),
  "sweet-potato": T(42, 5, 14, 100),
  mushroom: D(0, 60),
};

const GENERIC = D(0, 60);

export function cropDefaults(cropId) {
  return DEFAULTS[cropId] ?? GENERIC;
}

function seasonFor(anchor, block) {
  const base =
    block.method === "transplant"
      ? {
          anchor,
          method: "transplant",
          indoorSowOffsetDays: block.indoorSowOffsetDays,
          hardenOffDaysBeforeTransplant: block.hardenOffDaysBeforeTransplant,
          transplantDaysAfterAnchor: block.transplantDaysAfterFrost ?? 0,
        }
      : {
          anchor,
          method: "direct",
          directSowDaysBeforeAnchor: block.directSowDaysBeforeFrost ?? 0,
        };
  if (block.successionIntervalDays != null) {
    base.successionIntervalDays = block.successionIntervalDays;
  }
  return base;
}

export function springSeason(block) {
  return seasonFor("lastSpringFrost", block);
}

export function fallSeason(block) {
  return seasonFor("firstFallFrost", block);
}

export function summerSeason(block) {
  return seasonFor("lastSpringFrost", block);
}

/**
 * Fall timing offsets are relative to the first fall frost.
 * Inclusion: cool-season veg/herbs; fall-planted overwinter alliums.
 */
const FALL_DEFAULTS = {
  spinach: D(42, 40),
  lettuce: T(30, 5, -28, 45),
  kale: T(42, 5, -42, 55),
  broccoli: T(56, 7, -70, 60),
  cabbage: T(70, 7, -84, 75),
  cauliflower: T(70, 7, -70, 70),
  "brussels-sprouts": T(84, 7, -100, 100),
  collards: T(42, 5, -55, 55),

  radish: D(35, 30),
  arugula: D(45, 40),
  mustard: D(45, 40),
  "asian-greens": D(45, 45),
  turnip: D(60, 55),

  carrot: D(75, 70),
  beet: D(60, 55),
  chard: D(60, 55),
  parsnip: D(110, 110),
  potato: D(90, 90),

  garlic: D(21, 240),
  onion: D(28, 240),
  shallot: D(28, 100),
  leek: T(70, 7, -100, 120),

  pea: D(65, 60),
  cilantro: D(50, 45),
  parsley: T(42, 5, -42, 75),
  dill: D(55, 50),
  scallion: D(70, 70),
  kohlrabi: T(42, 5, -55, 55),
  endive: T(30, 5, -55, 85),
  escarole: T(30, 5, -55, 85),
  rutabaga: D(95, 90),
  celery: T(70, 7, -90, 90),
  fennel: D(80, 90),

  chervil: D(50, 45),
  chamomile: D(55, 60),
  borage: D(55, 60),
  lovage: T(42, 5, -55, 90),
  angelica: T(56, 5, -70, 365),
  dandelion: D(50, 55),
  "salad-burnet": D(50, 60),

  cress: D(35, 30),
  watercress: D(40, 45),
  sorrel: D(50, 60),
  orach: D(45, 45),
  microgreens: D(21, 21),

  strawberry: D(45, 90),
};

const Ds = (before, dth, succession) => ({
  ...D(before, dth),
  successionIntervalDays: succession,
});

/**
 * Summer: same last-spring-frost anchor, later offsets (typically after frost).
 * Negative directSowDaysBeforeFrost = days after frost. Optional succession.
 */
const SUMMER_DEFAULTS = {
  beans: Ds(-14, 55, 14),
  corn: D(-21, 75),
  "squash-summer": Ds(-21, 55, 14),
  cucumber: T(14, 5, 14, 55),
  basil: T(21, 5, 14, 45),
  okra: T(28, 5, 21, 60),
  tomato: T(42, 7, 14, 75),
  pepper: T(42, 7, 21, 70),
  eggplant: T(42, 7, 21, 75),
  melon: T(21, 5, 21, 85),
  watermelon: T(21, 5, 21, 90),
  cantaloupe: T(21, 5, 21, 85),
  sunflower: D(-21, 90),
  amaranth: Ds(-14, 60, 21),
  "squash-winter": D(-28, 100),
  pumpkin: D(-28, 100),
  lettuce: Ds(-45, 40, 14),
  chard: Ds(-30, 55, 21),
};

export function cropFallDefaults(cropId) {
  return FALL_DEFAULTS[cropId];
}

export function cropSummerDefaults(cropId) {
  return SUMMER_DEFAULTS[cropId];
}

export const CROP_DEFAULT_IDS = Object.keys(DEFAULTS);
export const CROP_FALL_DEFAULT_IDS = Object.keys(FALL_DEFAULTS);
export const CROP_SUMMER_DEFAULT_IDS = Object.keys(SUMMER_DEFAULTS);
export { FALL_DEFAULTS, SUMMER_DEFAULTS };
