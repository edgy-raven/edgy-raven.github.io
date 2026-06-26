import {
  randomBinomial,
  randomGamma,
  randomLcg,
  randomPoisson,
} from "./random.mjs";

let SHIPS = [];
let SHIP_COUNT = 0;
let NAME_TO_INDEX = {};
let RAPID_FIRE = new Float64Array();

export const TECHS = {
  WEAPON: 109,
  SHIELD: 110,
  ARMOUR: 111,
};
const PLAYER = {
  NO_CLASS_ID: 0,
  GENERAL_CLASS_ID: 2,
};
const ALLIANCE = {
  WARRIOR_CLASS_ID: 1,
};
const DAMAGE_BINS = 12;
const PRE_EXPLOSION_DAMAGE_BINS = 4;
const SHIELD_BINS = 6;
const ALIVE_THRESHOLD = 0.5;

export function configureShips(shipCatalog) {
  SHIPS = shipCatalog;
  SHIP_COUNT = SHIPS.length;
  NAME_TO_INDEX = Object.fromEntries(
    SHIPS.map((ship, index) => [ship.name, index]),
  );
  RAPID_FIRE = new Float64Array(SHIP_COUNT * SHIP_COUNT);
  for (const ship of SHIPS) {
    for (const [targetName, factor] of ship.rapidfire_targets) {
      RAPID_FIRE[ship.index * SHIP_COUNT + NAME_TO_INDEX[targetName]] =
        1 - 1 / factor;
    }
  }
  return { shipCount: SHIP_COUNT };
}

class CombatRandom {
  constructor(seed) {
    this.source = randomLcg(seed);
    this.randomBinomial = randomBinomial.source(this.source);
    this.randomGamma = randomGamma.source(this.source);
    this.randomPoisson = randomPoisson.source(this.source);
  }

  binomial(n, p) {
    return this.randomBinomial(n, p)();
  }

  negativeBinomial(successes, successProbability) {
    return this.randomPoisson(
      this.randomGamma(
        successes,
        (1 - successProbability) / successProbability,
      )(),
    )();
  }

  multinomial(count, probabilities, out, offset) {
    let remaining = count;
    let remainingProbability = 1;
    let last = -1;
    for (let index = 0; index < probabilities.length; index++) {
      if (probabilities[index] > 0) last = index;
    }
    for (let index = 0; index < last; index++) {
      const probability = probabilities[index];
      if (probability <= 0) continue;
      const draw = this.binomial(
        remaining,
        Math.min(1, probability / remainingProbability),
      );
      out[offset + index] += draw;
      remaining -= draw;
      remainingProbability -= probability;
      if (remaining <= 0) return;
    }
    out[offset + last] += remaining;
  }
}

function gammaln(value) {
  const coefficients = [
    0.9999999999998099,
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];
  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) -
      gammaln(1 - value);
  }
  let z = value - 1;
  let x = coefficients[0];
  for (let index = 1; index < coefficients.length; index++) {
    x += coefficients[index] / (z + index);
  }
  const t = z + coefficients.length - 1.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t +
    Math.log(x);
}

function poissonQuantile(probability, rate) {
  let p = Math.exp(-rate);
  let cumulative = p;
  let count = 0;
  while (cumulative < probability && count < 10000) {
    count++;
    p *= rate / count;
    cumulative += p;
  }
  return count;
}

function poissonProbabilities(rate, hitLimit, out) {
  let p = Math.exp(-rate);
  out[0] = p;
  let sum = p;
  for (let hits = 1; hits < hitLimit; hits++) {
    p *= rate / hits;
    out[hits] = p;
    sum += p;
  }
  out[hitLimit] = Math.max(0, 1 - sum);
}

function linspace(start, end, count, endpoint) {
  const values = new Float64Array(count);
  const divisor = endpoint ? count - 1 : count;
  for (let index = 0; index < count; index++) {
    values[index] = start + (end - start) * index / divisor;
  }
  return values;
}

function baseFleet(units, player, coords = [1, 1, 1]) {
  const counts = new Float64Array(SHIP_COUNT);
  for (const [name, count] of Object.entries(units)) {
    counts[NAME_TO_INDEX[name]] = count;
  }
  return { units: counts, player, coords };
}

function combatValueArray(fleet, field, techId, shipField) {
  const values = new Float64Array(SHIP_COUNT);
  const isGeneral = fleet.player.classId === PLAYER.GENERAL_CLASS_ID;
  const isWarrior =
    fleet.player.allianceClassId === ALLIANCE.WARRIOR_CLASS_ID;
  for (let shipType = 0; shipType < SHIP_COUNT; shipType++) {
    values[shipType] = Math.floor(
      SHIPS[shipType][shipField] *
        (
          1 +
          0.1 *
            (
              (fleet.player.techs[techId] || 0) +
              (isWarrior ? 1 : 0) +
              (isGeneral ? 2 : 0)
            ) +
          (fleet.player.lifeforms?.[shipType]?.[field] || 0)
        ),
    );
  }
  return values;
}

class CombatSide {
  constructor(group) {
    let rowCount = 0;
    for (const fleet of group.memberFleets) {
      for (let shipType = 0; shipType < SHIP_COUNT; shipType++) {
        if (fleet.units[shipType] > 0) rowCount++;
      }
    }

    this.fleetCount = group.memberFleets.length;
    this.units = new Float64Array(rowCount);
    this.attackValues = new Float64Array(rowCount);
    this.shieldValues = new Float64Array(rowCount);
    this.hullValues = new Float64Array(rowCount);
    this.shipTypeIds = new Int32Array(rowCount);
    this.fleetIds = new Int32Array(rowCount);
    this.typeCounts = new Float64Array(rowCount);
    this.damageBinLabels = new Float64Array(rowCount * DAMAGE_BINS);
    this.shieldBinLabels = new Float64Array(rowCount * SHIELD_BINS);
    this.stateCounts = new Float64Array(rowCount * DAMAGE_BINS * SHIELD_BINS);

    let row = 0;
    for (let fleetId = 0; fleetId < group.memberFleets.length; fleetId++) {
      const fleet = group.memberFleets[fleetId];
      const attackValues = combatValueArray(
        fleet,
        "weapon",
        TECHS.WEAPON,
        "base_attack",
      );
      const shieldValues = combatValueArray(
        fleet,
        "shield",
        TECHS.SHIELD,
        "base_shield",
      );
      const hullValues = combatValueArray(
        fleet,
        "armor",
        TECHS.ARMOUR,
        "base_hull",
      );
      for (let shipType = 0; shipType < SHIP_COUNT; shipType++) {
        const count = fleet.units[shipType];
        if (count <= 0) continue;
        this.units[row] = count;
        this.typeCounts[row] = count;
        this.attackValues[row] = attackValues[shipType];
        this.shieldValues[row] = shieldValues[shipType];
        this.hullValues[row] = hullValues[shipType];
        this.shipTypeIds[row] = shipType;
        this.fleetIds[row] = fleetId;
        row++;
      }
    }

    for (let unitType = 0; unitType < rowCount; unitType++) {
      const hull = this.hullValues[unitType];
      const firstDamage = linspace(
        0,
        0.3 * hull,
        PRE_EXPLOSION_DAMAGE_BINS,
        false,
      );
      const secondDamage = linspace(
        0.3 * hull,
        hull,
        DAMAGE_BINS - PRE_EXPLOSION_DAMAGE_BINS,
        false,
      );
      for (let bin = 0; bin < PRE_EXPLOSION_DAMAGE_BINS; bin++) {
        this.damageBinLabels[unitType * DAMAGE_BINS + bin] =
          firstDamage[bin];
      }
      for (let bin = 0; bin < secondDamage.length; bin++) {
        this.damageBinLabels[
          unitType * DAMAGE_BINS + PRE_EXPLOSION_DAMAGE_BINS + bin
        ] = secondDamage[bin];
      }
      if (this.shieldValues[unitType] > 0) {
        const shields = linspace(
          0,
          this.shieldValues[unitType],
          SHIELD_BINS,
          true,
        );
        for (let bin = 0; bin < SHIELD_BINS; bin++) {
          this.shieldBinLabels[unitType * SHIELD_BINS + bin] = shields[bin];
        }
      }
      this.stateCounts[this.stateOffset(unitType, 0, SHIELD_BINS - 1)] =
        this.typeCounts[unitType];
    }
  }

  stateOffset(unitType, damageBin, shieldBin) {
    return (unitType * DAMAGE_BINS + damageBin) * SHIELD_BINS + shieldBin;
  }

  damageLabel(unitType, bin) {
    return this.damageBinLabels[unitType * DAMAGE_BINS + bin];
  }

  shieldLabel(unitType, bin) {
    return this.shieldBinLabels[unitType * SHIELD_BINS + bin];
  }

  aliveCount() {
    let count = 0;
    for (const value of this.typeCounts) count += value;
    return count;
  }

  resetShields() {
    for (let unitType = 0; unitType < this.typeCounts.length; unitType++) {
      if (this.typeCounts[unitType] <= 0) continue;
      const damageCounts = new Float64Array(DAMAGE_BINS);
      for (let damageBin = 0; damageBin < DAMAGE_BINS; damageBin++) {
        let count = 0;
        for (let shieldBin = 0; shieldBin < SHIELD_BINS; shieldBin++) {
          const offset = this.stateOffset(unitType, damageBin, shieldBin);
          count += this.stateCounts[offset];
          this.stateCounts[offset] = 0;
        }
        damageCounts[damageBin] = count;
      }
      let total = 0;
      for (let damageBin = 0; damageBin < DAMAGE_BINS; damageBin++) {
        this.stateCounts[
          this.stateOffset(unitType, damageBin, SHIELD_BINS - 1)
        ] = damageCounts[damageBin];
        total += damageCounts[damageBin];
      }
      this.typeCounts[unitType] = total;
    }
  }

  applyHits(hitCounts, attackValues) {
    if (!hitCounts) return;
    const rowCount = this.typeCounts.length;
    const nextState = new Float64Array(this.stateCounts.length);
    const targetTypes = [];
    const rates = [];
    const probabilities = [];

    for (let attackRow = 0; attackRow < attackValues.length; attackRow++) {
      const attackDamage = attackValues[attackRow];
      targetTypes.length = 0;
      rates.length = 0;
      let maxRate = 0;
      let maxDestroyHits = 0;
      for (let targetRow = 0; targetRow < rowCount; targetRow++) {
        const hits = hitCounts[attackRow * rowCount + targetRow];
        if (hits <= 0 || this.typeCounts[targetRow] <= 1e-9) continue;
        targetTypes.push(targetRow);
        const rate = hits / this.typeCounts[targetRow];
        rates.push(rate);
        maxRate = Math.max(maxRate, rate);
        for (let damageBin = 0; damageBin < DAMAGE_BINS; damageBin++) {
          for (let shieldBin = 0; shieldBin < SHIELD_BINS; shieldBin++) {
            if (
              this.stateCounts[
                this.stateOffset(targetRow, damageBin, shieldBin)
              ] <= 0
            ) {
              continue;
            }
            maxDestroyHits = Math.max(
              maxDestroyHits,
              Math.ceil(
                (
                  this.hullValues[targetRow] -
                  this.damageLabel(targetRow, damageBin) +
                  this.shieldLabel(targetRow, shieldBin)
                ) / attackDamage,
              ),
            );
          }
        }
      }
      if (!targetTypes.length) continue;

      const hitLimit = Math.min(
        poissonQuantile(0.9999, maxRate),
        maxDestroyHits,
      );
      probabilities.length = 0;
      for (const rate of rates) {
        const out = new Float64Array(hitLimit + 1);
        poissonProbabilities(rate, hitLimit, out);
        probabilities.push(out);
      }
      nextState.fill(0);

      for (let targetIndex = 0; targetIndex < targetTypes.length; targetIndex++) {
        const targetRow = targetTypes[targetIndex];
        const hitProbabilities = probabilities[targetIndex];
        const hull = this.hullValues[targetRow];
        for (let damageBin = 0; damageBin < DAMAGE_BINS; damageBin++) {
          for (let shieldBin = 0; shieldBin < SHIELD_BINS; shieldBin++) {
            const stateCount =
              this.stateCounts[
                this.stateOffset(targetRow, damageBin, shieldBin)
              ];
            if (stateCount <= 0) continue;
            const damageStart = this.damageLabel(targetRow, damageBin);
            const shield = this.shieldLabel(targetRow, shieldBin);
            for (let hits = 0; hits <= hitLimit; hits++) {
              const probability = hitProbabilities[hits];
              if (probability <= 0) continue;
              const damageEnd = damageStart +
                Math.max(0, hits * attackDamage - shield);
              const shieldEnd = Math.max(0, shield - hits * attackDamage);
              let nextDamageBin = 0;
              for (let bin = 0; bin < DAMAGE_BINS; bin++) {
                if (damageEnd >= this.damageLabel(targetRow, bin)) {
                  nextDamageBin = bin;
                }
              }
              let nextShieldBin = 0;
              for (let bin = 0; bin < SHIELD_BINS; bin++) {
                if (shieldEnd >= this.shieldLabel(targetRow, bin)) {
                  nextShieldBin = bin;
                }
              }
              const survival = this.explosionSurvival(
                hits,
                damageStart,
                shield,
                hull,
                attackDamage,
                damageEnd,
              );
              nextState[
                this.stateOffset(targetRow, nextDamageBin, nextShieldBin)
              ] += stateCount * probability * survival;
            }
          }
        }
      }

      for (const targetRow of targetTypes) {
        let total = 0;
        for (let damageBin = 0; damageBin < DAMAGE_BINS; damageBin++) {
          for (let shieldBin = 0; shieldBin < SHIELD_BINS; shieldBin++) {
            const offset = this.stateOffset(targetRow, damageBin, shieldBin);
            this.stateCounts[offset] = nextState[offset];
            total += nextState[offset];
          }
        }
        this.typeCounts[targetRow] = total;
      }
    }
  }

  explosionSurvival(
    hits,
    damageStart,
    shield,
    hull,
    attackDamage,
    damageEnd,
  ) {
    if (
      hits <= 0 ||
      (damageStart <= 0.3 * hull && damageEnd <= 0.3 * hull)
    ) {
      return 1;
    }
    const shieldHits = Math.min(hits, Math.floor(shield / attackDamage));
    let noExplosion = 1;
    if (shieldHits > 0 && damageStart > 0.3 * hull) {
      noExplosion *= Math.pow(1 - damageStart / hull, shieldHits);
    }
    const damageHits = hits - shieldHits;
    if (damageHits <= 0) return noExplosion;

    const damage = damageStart - (shield - shieldHits * attackDamage);
    if (damage + damageHits * attackDamage >= hull) return 0;
    const h0 = Math.max(
      Math.ceil((0.3 * hull - damage) / attackDamage),
      1,
    ) + shieldHits;
    if (h0 > hits) return noExplosion;

    const hLimit = (hull - damage) / attackDamage + shieldHits - h0;
    const rollCounts = hits - h0 + 1;
    const exponent = rollCounts * Math.log(attackDamage / hull) +
      gammaln(hLimit + 1) - gammaln(hLimit - rollCounts + 1);
    return noExplosion * Math.exp(Math.min(exponent, 0));
  }

  countsByFleetShipType() {
    const counts = new Float64Array(this.fleetCount * SHIP_COUNT);
    for (let row = 0; row < this.typeCounts.length; row++) {
      counts[this.fleetIds[row] * SHIP_COUNT + this.shipTypeIds[row]] +=
        this.typeCounts[row];
    }
    return counts;
  }
}

class Combat {
  constructor(attacker, defender, rng, options = {}) {
    this.attacker = new CombatSide(attacker);
    this.defender = new CombatSide(defender);
    this.rng = rng;
    this.rapidFire = options.rapidFire !== false;
    this.atkCanDamage = this.damageMask(this.attacker, this.defender);
    this.defCanDamage = this.damageMask(this.defender, this.attacker);
    this.atkRf = this.rfMatrix(this.attacker, this.defender, this.atkCanDamage);
    this.defRf = this.rfMatrix(this.defender, this.attacker, this.defCanDamage);
  }

  damageMask(attacker, defender) {
    const mask = new Uint8Array(attacker.units.length * defender.units.length);
    for (let row = 0; row < attacker.units.length; row++) {
      for (let target = 0; target < defender.units.length; target++) {
        mask[row * defender.units.length + target] =
          attacker.attackValues[row] > 0.01 * defender.shieldValues[target]
            ? 1
            : 0;
      }
    }
    return mask;
  }

  rfMatrix(attacker, defender, canDamage) {
    const values = new Float64Array(attacker.units.length * defender.units.length);
    for (let row = 0; row < attacker.units.length; row++) {
      for (let target = 0; target < defender.units.length; target++) {
        values[row * defender.units.length + target] =
          (
            this.rapidFire
              ? RAPID_FIRE[
                  attacker.shipTypeIds[row] * SHIP_COUNT +
                    defender.shipTypeIds[target]
                ]
              : 0
          ) * canDamage[row * defender.units.length + target];
      }
    }
    return values;
  }

  simulate() {
    const atkOriginal = this.attacker.countsByFleetShipType();
    const defOriginal = this.defender.countsByFleetShipType();
    let rounds = 0;
    for (let round = 0; round < 6; round++) {
      if (
        this.attacker.aliveCount() < ALIVE_THRESHOLD ||
        this.defender.aliveCount() < ALIVE_THRESHOLD
      ) {
        break;
      }
      const attackHits = this.lockHits(
        this.attacker,
        this.defender,
        this.atkCanDamage,
        this.atkRf,
      );
      const defenseHits = this.lockHits(
        this.defender,
        this.attacker,
        this.defCanDamage,
        this.defRf,
      );
      if (!attackHits && !defenseHits) break;
      this.defender.applyHits(attackHits, this.attacker.attackValues);
      this.attacker.applyHits(defenseHits, this.defender.attackValues);
      this.attacker.resetShields();
      this.defender.resetShields();
      rounds++;
    }
    const atkAlive = this.attacker.aliveCount() >= ALIVE_THRESHOLD;
    const defAlive = this.defender.aliveCount() >= ALIVE_THRESHOLD;
    return {
      atkOriginal,
      defOriginal,
      atkSurvivors: this.attacker.countsByFleetShipType(),
      defSurvivors: this.defender.countsByFleetShipType(),
      atkWin: atkAlive && !defAlive ? 1 : 0,
      draw: atkAlive === defAlive ? 1 : 0,
      defWin: defAlive && !atkAlive ? 1 : 0,
      rounds,
    };
  }

  lockHits(attacker, defender, canDamage, pRf) {
    const rowCount = attacker.typeCounts.length;
    const targetCount = defender.typeCounts.length;
    const hitCounts = new Int32Array(rowCount * targetCount);
    const pTarget = new Float64Array(targetCount);
    const probabilities = new Float64Array(targetCount);
    let defenderTotal = 0;
    for (const value of defender.typeCounts) defenderTotal += value;
    for (let target = 0; target < targetCount; target++) {
      pTarget[target] = defender.typeCounts[target] / defenderTotal;
    }

    let any = false;
    for (let row = 0; row < rowCount; row++) {
      const attackCount = Math.round(attacker.typeCounts[row]);
      if (attackCount <= 0) continue;
      let pRfTotal = 0;
      for (let target = 0; target < targetCount; target++) {
        pRfTotal += pRf[row * targetCount + target] * pTarget[target];
      }
      if (pRfTotal > 0) {
        const rfCount = this.rng.negativeBinomial(attackCount, 1 - pRfTotal);
        if (rfCount > 0) {
          for (let target = 0; target < targetCount; target++) {
            probabilities[target] =
              pRf[row * targetCount + target] * pTarget[target] / pRfTotal;
          }
          this.rng.multinomial(
            rfCount,
            probabilities,
            hitCounts,
            row * targetCount,
          );
        }
      }
      const terminalTotal = 1 - pRfTotal;
      if (terminalTotal > 0) {
        for (let target = 0; target < targetCount; target++) {
          probabilities[target] =
            (1 - pRf[row * targetCount + target]) *
            pTarget[target] /
            terminalTotal;
        }
        this.rng.multinomial(
          attackCount,
          probabilities,
          hitCounts,
          row * targetCount,
        );
      }
    }

    for (let index = 0; index < hitCounts.length; index++) {
      if (!canDamage[index]) {
        hitCounts[index] = 0;
      } else if (hitCounts[index] > 0) {
        any = true;
      }
    }
    return any ? hitCounts : null;
  }
}

export function benchmarkScenario(name) {
  const player = {
    classId: PLAYER.NO_CLASS_ID,
    allianceClassId: 0,
    techs: {
      [TECHS.WEAPON]: 20,
      [TECHS.SHIELD]: 20,
      [TECHS.ARMOUR]: 20,
    },
    lifeforms: {},
  };
  if (name === "tiny") {
    return {
      attacker: {
        memberFleets: [baseFleet({ LIGHT_FIGHTER: 10 }, player, [1, 1, 1])],
      },
      defender: {
        memberFleets: [baseFleet({ ROCKET_LAUNCHER: 10 }, player, [1, 1, 2])],
      },
    };
  }
  if (name === "mixed") {
    return {
      attacker: {
        memberFleets: [
          baseFleet(
            {
              SMALL_CARGO: 500,
              LIGHT_FIGHTER: 5000,
              CRUISER: 1000,
              BATTLECRUISER: 500,
              REAPER: 100,
            },
            player,
            [1, 1, 1],
          ),
        ],
      },
      defender: {
        memberFleets: [
          baseFleet(
            {
              ROCKET_LAUNCHER: 10000,
              LIGHT_LASER: 5000,
              GAUSS_CANNON: 500,
              PLASMA_TURRET: 100,
              SMALL_SHIELD_DOME: 1,
              LARGE_SHIELD_DOME: 1,
            },
            player,
            [1, 1, 2],
          ),
        ],
      },
    };
  }
  if (name === "balanced") {
    return {
      attacker: {
        memberFleets: [
          baseFleet(
            { LIGHT_FIGHTER: 1000, CRUISER: 50 },
            player,
            [1, 1, 1],
          ),
        ],
      },
      defender: {
        memberFleets: [
          baseFleet({ ROCKET_LAUNCHER: 2000 }, player, [1, 1, 2]),
        ],
      },
    };
  }
  if (name === "acs") {
    return {
      attacker: {
        memberFleets: [
          baseFleet({ LIGHT_FIGHTER: 4000, CRUISER: 800 }, player, [1, 1, 1]),
          baseFleet(
            { BATTLECRUISER: 600, REAPER: 150 },
            player,
            [1, 2, 1],
          ),
        ],
      },
      defender: {
        memberFleets: [
          baseFleet(
            { ROCKET_LAUNCHER: 12000, LIGHT_LASER: 8000 },
            player,
            [1, 1, 2],
          ),
          baseFleet(
            { GAUSS_CANNON: 600, PLASMA_TURRET: 120 },
            player,
            [1, 1, 2],
          ),
        ],
      },
    };
  }
  throw new Error(`unknown scenario: ${name}`);
}

function nestedCounts(values, fleetCount) {
  const counts = [];
  for (let fleetId = 0; fleetId < fleetCount; fleetId++) {
    counts.push(
      Array.from(values.slice(fleetId * SHIP_COUNT, (fleetId + 1) * SHIP_COUNT)),
    );
  }
  return counts;
}

function serializeResult(result, scenario) {
  return {
    atkOriginal: nestedCounts(
      result.atkOriginal,
      scenario.attacker.memberFleets.length,
    ),
    defOriginal: nestedCounts(
      result.defOriginal,
      scenario.defender.memberFleets.length,
    ),
    atkSurvivors: nestedCounts(
      result.atkSurvivors,
      scenario.attacker.memberFleets.length,
    ),
    defSurvivors: nestedCounts(
      result.defSurvivors,
      scenario.defender.memberFleets.length,
    ),
    atkWin: result.atkWin,
    draw: result.draw,
    defWin: result.defWin,
    rounds: result.rounds,
  };
}

function createSampleStore(fleetCount, trials) {
  return {
    aggregate: new Float64Array(SHIP_COUNT * trials),
    forces: Array.from(
      { length: fleetCount },
      () => new Float64Array(SHIP_COUNT * trials),
    ),
  };
}

function recordSamples(store, values, trial, trials) {
  for (let shipType = 0; shipType < SHIP_COUNT; shipType++) {
    let total = 0;
    for (let fleetId = 0; fleetId < store.forces.length; fleetId++) {
      const value = values[fleetId * SHIP_COUNT + shipType] || 0;
      store.forces[fleetId][shipType * trials + trial] = value;
      total += value;
    }
    store.aggregate[shipType * trials + trial] = total;
  }
}

export function simulateTrialResults(scenario, trials, seed, options = {}) {
  if (!SHIP_COUNT) {
    throw new Error("ship catalog has not been configured");
  }
  if (trials < 1) {
    throw new Error("trials must be at least 1");
  }
  const results = [];
  for (let trial = 0; trial < trials; trial++) {
    const combat = new Combat(
      scenario.attacker,
      scenario.defender,
      new CombatRandom(seed + trial),
      options,
    );
    results.push(serializeResult(combat.simulate(), scenario));
  }
  return results;
}

export function simulateTrialSamples(scenario, trials, seed, options = {}) {
  if (!SHIP_COUNT) {
    throw new Error("ship catalog has not been configured");
  }
  if (trials < 1) {
    throw new Error("trials must be at least 1");
  }
  const attackerSamples = createSampleStore(
    scenario.attacker.memberFleets.length,
    trials,
  );
  const defenderSamples = createSampleStore(
    scenario.defender.memberFleets.length,
    trials,
  );
  let attackerWin = 0;
  let draw = 0;
  let defenderWin = 0;
  let totalRounds = 0;
  let minRounds = Number.POSITIVE_INFINITY;
  let maxRounds = 0;
  for (let trial = 0; trial < trials; trial++) {
    const combat = new Combat(
      scenario.attacker,
      scenario.defender,
      new CombatRandom(seed + trial),
      options,
    );
    const result = combat.simulate();
    attackerWin += result.atkWin;
    draw += result.draw;
    defenderWin += result.defWin;
    totalRounds += result.rounds;
    minRounds = Math.min(minRounds, result.rounds);
    maxRounds = Math.max(maxRounds, result.rounds);
    recordSamples(attackerSamples, result.atkSurvivors, trial, trials);
    recordSamples(defenderSamples, result.defSurvivors, trial, trials);
  }
  return {
    completed: trials,
    attackerWin,
    draw,
    defenderWin,
    totalRounds,
    minRounds,
    maxRounds,
    attackerSurvivorSamples: attackerSamples.aggregate,
    defenderSurvivorSamples: defenderSamples.aggregate,
    attackerForceSurvivorSamples: attackerSamples.forces,
    defenderForceSurvivorSamples: defenderSamples.forces,
  };
}

export function runBenchmarkTrials(name, trials, seed) {
  const started = process.hrtime.bigint();
  let atkWin = 0;
  let draw = 0;
  let defWin = 0;
  let rounds = 0;
  let atkSurvivorTotal = 0;
  let defSurvivorTotal = 0;
  const scenario = benchmarkScenario(name);
  for (let trial = 0; trial < trials; trial++) {
    const combat = new Combat(
      scenario.attacker,
      scenario.defender,
      new CombatRandom(seed + trial),
    );
    const result = combat.simulate();
    atkWin += result.atkWin;
    draw += result.draw;
    defWin += result.defWin;
    rounds += result.rounds;
    for (const value of result.atkSurvivors) atkSurvivorTotal += value;
    for (const value of result.defSurvivors) defSurvivorTotal += value;
  }
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  return {
    name,
    trials,
    seconds,
    trialsPerSecond: trials / seconds,
    atkWinRate: atkWin / trials,
    drawRate: draw / trials,
    defWinRate: defWin / trials,
    rounds: rounds / trials,
    atkSurvivorTotal: atkSurvivorTotal / trials,
    defSurvivorTotal: defSurvivorTotal / trials,
  };
}
