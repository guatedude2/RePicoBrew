import { Phase } from '~/components/BrewingAnimation/BrewingAnimation';

// Which scene of the vessel animation a Pico step name belongs to. Step names come from the device's own log
// ("Preparing To Brew", "Heating", "Dough In", "Mash 1", "Mash Out", "Hops 2", "Brew Canceled", ...) and from
// hand-written recipes ("Heat to Boil", "Boil Adjunct 1", "Whirlpool", "Connect Chiller", ...), so it matches on
// the words in the name rather than exact names. `earlierSteps` are the steps already seen this session, in
// order: what a step like "Heating" means depends on whether the grain is in yet.
const has = (name: string, pattern: RegExp) => pattern.test(name);

export function phaseForStep(stepName: string, earlierSteps: string[] = []): Phase {
  const name = stepName.toLowerCase();

  if (has(name, /cancel|abort|error/)) {
    return Phase.PREPARING; // stopped: cold water, no flame
  }
  if (has(name, /complete|finish/)) {
    return Phase.CHILLING;
  }
  if (has(name, /chill|cool/)) {
    return Phase.CHILLING;
  }
  if (has(name, /whirlpool|hop|adj|tea|coffee|extract/)) {
    return Phase.BITTERING; // hops / adjunct additions ("Boil Hops 2" is a hop step, not just a boil)
  }
  if (has(name, /boil/)) {
    return Phase.BOILING;
  }
  if (has(name, /prepar|prime|balance|clean|rinse|connect/)) {
    return Phase.PREPARING;
  }
  if (has(name, /heat|warm/)) {
    const grainIn = earlierSteps.some((step) => has(step.toLowerCase(), /dough|mash/));
    return grainIn ? Phase.MASHING : Phase.HEATING; // before the grain: strike water; after: heating the mash
  }
  if (has(name, /dough|mash|infusion|pass\s?thru/)) {
    return Phase.MASHING;
  }

  // An unfamiliar step name: stay in whatever scene the previous step was in.
  const previous = earlierSteps[earlierSteps.length - 1];
  return previous ? phaseForStep(previous, earlierSteps.slice(0, -1)) : Phase.PREPARING;
}
