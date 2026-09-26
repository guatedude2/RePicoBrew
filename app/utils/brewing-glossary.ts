// Plain-language explanations for brewing terms, shown in (i) tooltips next to recipe labels.
export const GLOSSARY = {
  abv: 'Alcohol by volume: how strong the finished beer is, as a percentage. It comes from how far the gravity drops during fermentation, roughly (OG - FG) x 131.25.',
  ibu: 'International Bitterness Units: how bitter the beer is, mostly from hops added early in the boil. A light lager is around 10, an IPA 50-70.',
  srm: 'Standard Reference Method: the beer’s color. Around 2-4 is pale straw, 10 amber, 20 brown, 35+ black.',
  batchSize: 'How much finished beer the recipe makes.',
  batchSizePico: 'A PicoPak always makes about 5 L (1.3 gal) of beer; the Pico can’t brew more or less.',
  aa: 'Alpha acids: how much bittering power a hop has, as a percentage (printed on the hop packet). Higher AA means more bitterness from the same amount.',
  hopTime:
    'How many minutes before the end of the boil the hop goes in. Long boils (60 min) add bitterness; short ones (0-15 min) add aroma and flavor.',
  dryHopTime: 'How many days the hops sit in the fermenting beer. Dry hopping adds aroma without bitterness.',
  dryHops: 'Hops added to the beer during or after fermentation, instead of in the boil, for a strong hop aroma.',
  compartment:
    'Which hop slot in the PicoPak the hop goes in. The Pico adds Adjunct 1 first and Adjunct 4 last, so later slots mean shorter boil times.',
  fermentables: 'The grains, extracts and sugars that give the yeast sugar to turn into alcohol.',
  fermentableColor:
    'The grain’s color in degrees Lovibond. Pale malts are 1-3; crystal and roasted malts go much higher and darken the beer.',
  mashType:
    'How the grains are soaked in hot water to turn their starches into sugar. A single step holds one temperature; multi-step uses several for better efficiency.',
  mashSteps:
    'The temperatures and times the grains are held at while mashing. Around 148-152°F makes a drier beer; 154-158°F a fuller, sweeter one.',
  startingWater:
    'How much water goes into the machine at the start. It is more than the batch size because the grain soaks some up and some boils off.',
  waterAmendments:
    'Minerals or salts added to the brewing water (e.g. gypsum, calcium chloride) to adjust its chemistry for the style.',
  boilTime: 'How long the wort boils. Most recipes boil 60-90 minutes.',
  boilTemp:
    'The temperature the machine boils at. Water boils lower at altitude (about 1°F lower per 500 ft), which changes timings slightly.',
  firstWortHopping:
    'Adding hops to the wort as it drains from the mash, before the boil starts. Gives a smoother bitterness.',
  otherBoil: 'Non-hop additions during the boil, such as Irish moss (to clear the beer) or yeast nutrient.',
  fermentationSteps:
    'The temperatures and durations the beer is held at while fermenting, for example primary fermentation, then a cold lagering period.',
  fermentDays:
    "How long fermentation should run for this recipe. It sets the fermentation chart's default date range and the time remaining; a batch can be extended later with Ferment longer.",
  grainBill:
    'The mix of grains in the recipe, by weight. Base malts make most of the sugar; specialty malts add color and flavor.',
  hopBill: 'The mix of hops in the recipe, by weight.',
  wortCurve:
    'The temperature of the wort (the sweet liquid made from the grains, before it becomes beer) over the brew day: mash steps, then the boil.',
} as const;
