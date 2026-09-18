// Condensed domain-knowledge reference for the AI Brewmaster feature (app/services/ai-advisor.server.ts).
//
// This is an original, paraphrased synthesis distilled from reading PicoBrew's own published
// hardware manuals and troubleshooting guides for the Pico C, Pico S/Pro, Zymatic, Z Series, and
// PicoFerm (sourced from picobrew.com's product-resources pages). It intentionally does NOT
// reproduce manual text verbatim — it is a practical engineer's cheat-sheet, reworded and
// reorganized for use as grounding context in an LLM system prompt, not a republication of
// PicoBrew's copyrighted documentation. Keep it dense but short: it is sent on every AI Brewmaster
// call, so prefer trimming stale detail over letting it grow unbounded.

export const PICOBREW_DOMAIN_KNOWLEDGE = `
# PicoBrew Hardware & Process Reference

Background knowledge about PicoBrew machines and the brewing process, to ground advice in how
these specific devices actually behave. Only surface details relevant to what the brewer is doing;
don't recite this reference back to them.

## Machine families

- **Pico C / Pico S / Pico Pro** ("Pico" line): compact single-batch (~2.5 gal) brewers built
  around a removable "step filter" basket that holds a mash screen and hop cages, plus a small
  keg (Pico C uses its own dedicated brew keg with adapters; S/Pro use a 1.75-gal ball-lock keg).
  Recipes are usually driven by a PicoPak (a pre-portioned grain/hop pack read via an RFID tag) or
  a synced recipe from picobrew.com; a step-by-step "Manual Brew" mode also exists for when
  network/recipe sync isn't available. Brewing is a single automated program: mash, then a
  short boil-equivalent heat step, with hops added between steps rather than a rolling boil.
- **Zymatic**: the older sibling of the Pico line, a bigger step-filter machine (up to ~9 lbs of
  grain) that mashes and boils into a 5-gal Corny keg but does NOT manage fermentation — after
  the brew and a chill step, the keg is handed off to standard homebrew fermentation, racking, and
  carbonation. Boil step is a fixed near-boiling single temperature (design default 207°F, not a
  true rolling boil), with hop timing handled by dropping hop cages into the circulating wort at
  the right countdown point.
- **Z Series (Z1/Z2/Z3/Z4, stackable)**: the current top-of-line all-in-one — full step-filter
  mash/boil like the Zymatic, plus on-machine chilling, and it can track/guide fermentation,
  racking, and carbonation, all using the same 5-gal keg from grain to glass. Also doubles as a
  general-purpose heat/pump platform for coffee, sous vide, and (with the PicoStill accessory)
  distillation.
- **PicoFerm**: a battery/USB-powered WiFi fermentation sensor that attaches to a keg's gas port
  (via a fermentation seal or ball-lock adapter) and reports temperature and fermentation status
  back to picobrew.com. It is a monitoring accessory only — it doesn't control temperature.

## Step sequencing & typical parameters

All step-filter machines (Pico, Zymatic, Z) follow the same rough shape: **dough-in/mash step(s)
→ mash-out → boil-equivalent heat step with staggered hop additions → drain/chill → ferment →
rack → carbonate.** Keep these ranges as sanity checks, not hard rules — the recipe's own target
values always win:

- Single-step infusion mash: commonly ~150-155°F for 60-90 minutes. A multi-step/high-efficiency
  mash schedule (used to push OG higher without more grain) looks roughly like: dough-in near
  100-105°F (~20 min) → first mash rest ~150-153°F (~30 min) → second mash rest ~153-155°F
  (~60 min) → mash-out ~170-175°F (~10 min). Full multi-step programs run ~5 hours total.
- Boil-equivalent step: these machines don't do a true rolling boil — they circulate near-boiling
  liquid (~200-207°F, capped below actual boiling to protect the machine) through the step filter.
  Hop additions are staggered by remaining time in this step (e.g., a "60-minute" bittering hop is
  added 60 minutes before the step ends), matching normal homebrew hop-timing conventions.
- Grain load is capped by step-filter size (Zymatic/Z: ~9 lbs; Pico: much smaller, PicoPak-sized).
  Water volume is always specified precisely by the recipe (measured by weight or volume) — under-
  or over-filling the keg is one of the most common causes of a bad mash or a low/missed gravity
  reading, more often than actual mash chemistry.
- After the boil step, wort must be drained/transferred and then chilled before pitching yeast —
  never pitch onto hot wort. On Z-family machines, some designs deliberately circulate a bit of
  air through the hot wort right after the boil (before chilling) to help drive off DMS
  (dimethyl sulfide, a "creamed corn" off-flavor precursor); don't cool the wort before this step,
  since circulating cooler wort at that stage tends to cause excess foaming.

## Chilling

- No-chill (ambient, overnight, 10-12+ hours) and ice-bath (bucket of ice water around the keg,
  circulated for a bounded time, roughly 30-45 minutes) are the two common approaches. Never run
  an active chill circulation indefinitely — beyond the recommended window it causes foaming, and
  ice-bath chilling in particular should not run much past ~40 minutes.
- The insulating "keg cozy" sleeve must be removed before chilling (and handled carefully — the
  keg is genuinely hot immediately after brewing).

## Fermentation

- Typical ranges: ales roughly 64-70°F, lagers roughly 49-55°F, though the specific yeast strain's
  recommended range should always take precedence over these defaults.
- Visible activity (airlock bubbling, krausen foam) should appear within 12-48 hours; if nothing
  is happening after ~72 hours, treat it as a real anomaly worth flagging (check seals, consider a
  fresh yeast pitch) rather than staying quiet — but don't panic before that window has passed.
  Fermentation temperature that's too low is one of the more common causes of a sluggish or
  seemingly stalled start.
- Total primary fermentation commonly wraps up in roughly 7-14 days; a final gravity that's stayed
  flat across two readings taken a couple of days apart is the standard sign that fermentation is
  actually done, not just slow.
- A pressurized fermentation adapter (used in place of a plain airlock) lets brewers ferment
  warmer/faster (roughly a few PSI of headspace pressure) without the off-flavors that warm,
  unpressurized fermentation would otherwise produce — useful context if the temperature reading
  looks "too warm" for the style but the recipe intentionally uses this approach.
- Dry hopping, when called for, is typically added a few days into fermentation and shouldn't sit
  in contact with the beer much beyond about a week, or grassy/vegetal flavors start to leach out.
- Cold crashing (chilling the finished beer for roughly 1-2 days before packaging) is a normal,
  optional clarity step, not a sign anything went wrong.

## Racking & carbonation

- Racking (moving beer off the fermenting yeast cake into a serving vessel) should happen at a
  reasonable point after fermentation finishes — leaving beer on a heavy yeast/trub cake for
  many weeks risks off-flavors, but there's no need to rush it either; a few extra days on the
  yeast is generally harmless or even beneficial.
- Carbonation is faster and more efficient under refrigeration. A common forced-carbonation target
  is roughly 10-12 PSI for a few days at fridge temperature to reach a typical carbonation level;
  higher pressure carbonates faster but the relationship is nonlinear and style-dependent, so
  treat any specific PSI/day numbers as ballpark, not gospel.
- Bottle conditioning (with priming sugar) instead of forced CO2 takes substantially longer —
  on the order of two weeks at room temperature before the beer is fully carbonated and ready to
  chill.

## Equipment quirks worth knowing

- **Cleaning agent restrictions are a real, machine-specific hazard, not general homebrew advice.**
  On Z-family (and generally step-filter) machines, common brewing chemicals — PBW, StarSan,
  OneStep, OxyClean/OxiClean, iodophor, and similar — are explicitly unsafe for the machine's own
  clean-in-place cycle and for soaking the plastic step-filter/adjunct/hop-cage components: they
  can craze or crack the plastic, especially combined with the near-boiling clean cycle. Those
  same sanitizers ARE fine for the metal keg, keg posts, and short soaks (a few minutes, not
  longer) of hoses/keg wands. The machine's own deep-clean cycle instead wants an unscented
  dishwasher detergent tablet (no gel packs, no "shine" additives, no scented tablets). Dishwasher-
  washing of the plastic step-filter parts is fine, but skip the heated-dry/sanitize dishwasher
  cycle — the extra heat is also hard on those parts.
- **Step filter drain issues are the single most common mechanical complaint** across the whole
  product line — a clogged drain port, a bad grommet/O-ring, a keg sealed with its solid metal lid
  (it should be open/vented during brewing, not sealed, except during specific deliberate
  pressurized steps like priming or racking), or debris in the ball-lock poppet valves. When wort
  isn't draining, isn't circulating, or a keg is running dry mid-session, these mechanical causes
  are far more likely than a recipe or ingredient problem.
- **RFID/PicoPak recognition errors** (Pico line) are usually solved by simply reseating the step
  filter, or — if a PicoPak's code truly won't associate — manually associating its serial number
  through the account's PicoPak support page. A "PicoPak already brewed" error just means the
  system thinks that pack was already used; it does not indicate a hardware fault.
- Most transient numbered error codes on the Pico line (DNS/server/WiFi/RFID communication
  errors) clear with a simple power cycle of the machine and router; if they persist, satellite
  internet connections are a known culprit (their "acceleration"/precaching features interfere
  with the machine's cloud calls and should be disabled).
- A "too hot" or large temperature-sensor-delta error usually traces back to restricted airflow
  behind the unit, air being drawn into the intake side instead of liquid, or a keg that's
  run dry — not a failing heater.
- The keg cozy is a safety item (shielding the metal keg's heat) as much as an insulation aid;
  always expect it to be off during chilling and back on during brewing/carbonation storage.

## Reading telemetry sensibly

Wort/heat-exchanger temperature deltas, drift, or plateaus during a step should be read against
the step's *target* rather than in isolation — a temp holding steady near target for its whole
hold time is healthy and unremarkable, while a temp that never reaches target, or swings by tens
of degrees between readings, points at real flow/seal problems like the ones above rather than
recipe issues. During fermentation, favor gravity trend (dropping vs. flat) over a single
temperature reading when judging whether something needs attention.
`.trim();
