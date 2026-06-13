import {
  TECHS,
  configureShips,
  simulateTrialResults,
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

function sumCounts(forceCounts) {
  const counts = new Array(forceCounts[0]?.length || 0).fill(0);
  for (const force of forceCounts) {
    for (let index = 0; index < force.length; index++) {
      counts[index] += force[index];
    }
  }
  return counts;
}

self.onmessage = (event) => {
  const startedAt = performance.now();
  const message = event.data;
  configureShips(message.ships);
  const trialResults = simulateTrialResults(
    scenarioFromMessage(message),
    message.trials,
    message.seed,
    { rapidFire: message.settings?.rapidFire !== false },
  );
  let attackerWin = 0;
  let draw = 0;
  let defenderWin = 0;
  let totalRounds = 0;
  let minRounds = Number.POSITIVE_INFINITY;
  let maxRounds = 0;
  const attackerSurvivors = [];
  const defenderSurvivors = [];
  const attackerForceSurvivors = [];
  const defenderForceSurvivors = [];
  for (const result of trialResults) {
    const attackers = sumCounts(result.atkSurvivors);
    const defenders = sumCounts(result.defSurvivors);
    attackerWin += result.atkWin;
    draw += result.draw;
    defenderWin += result.defWin;
    totalRounds += result.rounds;
    minRounds = Math.min(minRounds, result.rounds);
    maxRounds = Math.max(maxRounds, result.rounds);
    attackerSurvivors.push(attackers);
    defenderSurvivors.push(defenders);
    attackerForceSurvivors.push(result.atkSurvivors);
    defenderForceSurvivors.push(result.defSurvivors);
  }
  self.postMessage({
    completed: message.trials,
    attackerWin,
    draw,
    defenderWin,
    totalRounds,
    minRounds,
    maxRounds,
    attackerSurvivors,
    defenderSurvivors,
    attackerForceSurvivors,
    defenderForceSurvivors,
    elapsedMs: performance.now() - startedAt,
  });
};
