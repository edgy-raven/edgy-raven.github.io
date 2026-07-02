import {
  TECHS,
  configureShips,
  simulateTrialSamples,
} from "./combat.mjs";

const CLASS_IDS = {
  none: 0,
  collector: 1,
  general: 2,
  discoverer: 3,
};
const ALLIANCE_CLASS_IDS = {
  none: 0,
  warrior: 1,
};
const LIFEFORM_FIELDS = {
  lfWeapon: "weapon",
  lfShield: "shield",
  lfArmor: "armor",
};

function lifeformsFromTech(tech) {
  const values = {};
  for (let index = 0; index < (tech.lifeforms || []).length; index++) {
    const bonuses = {};
    for (const [source, target] of Object.entries(LIFEFORM_FIELDS)) {
      if (tech.lifeforms[index]?.[source]) {
        bonuses[target] = tech.lifeforms[index][source] / 100;
      }
    }
    if (Object.keys(bonuses).length) {
      values[index] = bonuses;
    }
  }
  return values;
}

function playerFromTech(tech) {
  return {
    classId: CLASS_IDS[tech.className] || 0,
    allianceClassId: ALLIANCE_CLASS_IDS[tech.allianceClassName] || 0,
    techs: {
      [TECHS.WEAPON]: tech.weapon || 0,
      [TECHS.SHIELD]: tech.shield || 0,
      [TECHS.ARMOUR]: tech.armor || 0,
    },
    lifeforms: lifeformsFromTech(tech),
  };
}

function fleetFromForce(force) {
  return {
    units: force.counts,
    player: playerFromTech(force.tech),
  };
}

function scenarioFromMessage(message) {
  return {
    attacker: {
      memberFleets: message.attackerForces.map(fleetFromForce),
    },
    defender: {
      memberFleets: message.defenderForces.map(fleetFromForce),
    },
  };
}

self.onmessage = (event) => {
  const startedAt = performance.now();
  const message = event.data;
  configureShips(message.ships);
  const result = simulateTrialSamples(
    scenarioFromMessage(message),
    message.trials,
    message.seed,
    { rapidFire: message.settings?.rapidFire !== false },
  );
  result.elapsedMs = performance.now() - startedAt;
  self.postMessage(result, [
    result.attackerSurvivorSamples.buffer,
    result.defenderSurvivorSamples.buffer,
    ...result.attackerForceSurvivorSamples.map((values) => values.buffer),
    ...result.defenderForceSurvivorSamples.map((values) => values.buffer),
  ]);
};
