const TECHS = {
  HYPERSPACE: 114,
  COMBUSTION_DRIVE: 115,
  IMPULSE_DRIVE: 117,
  HYPERSPACE_DRIVE: 118,
};
const PLAYER = {
  COLLECTOR_CLASS_ID: 1,
  GENERAL_CLASS_ID: 2,
};
const ALLIANCE = {
  WARRIOR_CLASS_ID: 1,
};

let SHIPS = [];
let NAME_TO_INDEX = {};

const DRIVE_TECH_IDS = {
  COMBUSTION_DRIVE: TECHS.COMBUSTION_DRIVE,
  IMPULSE_DRIVE: TECHS.IMPULSE_DRIVE,
  HYPERSPACE_DRIVE: TECHS.HYPERSPACE_DRIVE,
};
const CIVILIAN_NAMES = new Set([
  "SMALL_CARGO",
  "LARGE_CARGO",
  "COLONY_SHIP",
  "RECYCLER",
  "ESPIONAGE_PROBE",
  "SOLAR_SATELLITE",
  "CRAWLER",
]);
const CLASS_IDS = {
  collector: 1,
  general: 2,
  discoverer: 3,
};
const ALLIANCE_CLASS_IDS = {
  warrior: 1,
};
const WEB_TECHS = {
  hyperspaceTech: TECHS.HYPERSPACE,
  combustion: TECHS.COMBUSTION_DRIVE,
  impulse: TECHS.IMPULSE_DRIVE,
  hyperspace: TECHS.HYPERSPACE_DRIVE,
};
const WEB_LIFEFORM_FIELDS = {
  lfSpeed: "speed",
  lfFuel: "fuel",
  lfCargo: "cargo",
};

export function configureShips(shipCatalog) {
  SHIPS = shipCatalog;
  NAME_TO_INDEX = Object.fromEntries(
    SHIPS.map((ship, index) => [ship.name, index]),
  );
}

function shipObject(ship) {
  if (typeof ship === "number") return SHIPS[ship];
  if (typeof ship === "string") return SHIPS[NAME_TO_INDEX[ship]];
  return ship;
}

function techLevel(player, techId) {
  return player.techs?.[techId] || 0;
}

function lifeformBonus(player, ship, field) {
  return player.lifeforms?.[ship.index]?.[field] || 0;
}

function driveTechId(ship) {
  return DRIVE_TECH_IDS[ship.drive_tech_id] || null;
}

function webPlayer(force) {
  const lifeforms = {};
  for (let index = 0; index < (force.lifeforms || []).length; index++) {
    const bonuses = {};
    for (const [source, target] of Object.entries(WEB_LIFEFORM_FIELDS)) {
      if (force.lifeforms[index]?.[source]) {
        bonuses[target] = force.lifeforms[index][source] / 100;
      }
    }
    if (Object.keys(bonuses).length) {
      lifeforms[index] = bonuses;
    }
  }
  if (force.recyclers?.cargoBonus) {
    const recyclerIndex = NAME_TO_INDEX.RECYCLER;
    lifeforms[recyclerIndex] = {
      ...(lifeforms[recyclerIndex] || {}),
      cargo: force.recyclers.cargoBonus / 100,
    };
  }
  return {
    classId: CLASS_IDS[force.className] || 0,
    allianceClassId: ALLIANCE_CLASS_IDS[force.allianceClassName] || 0,
    techs: Object.fromEntries(
      Object.entries(WEB_TECHS).map(([field, techId]) => [
        techId,
        force.tech?.[field] || 0,
      ]),
    ),
    lifeforms,
  };
}

export function webFleet(force, units = force.counts) {
  return {
    units,
    coords: [
      force.coords?.galaxy || 1,
      force.coords?.system || 1,
      force.coords?.position || 1,
    ],
    player: webPlayer(force),
  };
}

function coordsValues(coords) {
  if (Array.isArray(coords)) return coords;
  return [coords?.galaxy || 1, coords?.system || 1, coords?.position || 1];
}

function universeValue(universe, snakeName, camelName) {
  return universe[snakeName] ?? universe[camelName];
}

export function flightDistance(origin, target, universe) {
  const [og, os, op] = coordsValues(origin);
  const [tg, ts, tp] = coordsValues(target);
  const galaxies = universeValue(universe, "galaxies", "galaxies");
  const systems = universeValue(universe, "systems", "systems");
  let galaxyDelta = Math.abs(og - tg);
  if (universeValue(universe, "circular_galaxy", "circularGalaxy")) {
    galaxyDelta = Math.min(galaxyDelta, galaxies - galaxyDelta);
  }
  let systemDelta = Math.abs(os - ts);
  if (universeValue(universe, "circular_system", "circularSystem")) {
    systemDelta = Math.min(systemDelta, systems - systemDelta);
  }
  if (galaxyDelta) return 20000 * galaxyDelta;
  if (systemDelta) return 2700 + 95 * systemDelta;
  if (op !== tp) return 1000 + 5 * Math.abs(tp - op);
  return 5;
}

function effectiveShipDriveStats(ship, player) {
  ship = shipObject(ship);
  if (
    ship.name === "SMALL_CARGO" &&
    techLevel(player, TECHS.IMPULSE_DRIVE) < 5
  ) {
    return {
      baseSpeed: 5000,
      driveBonus: 0.1,
      driveTechId: TECHS.COMBUSTION_DRIVE,
      fuelCost: ship.fuel_cost,
    };
  }
  if (
    ship.name === "BOMBER" &&
    techLevel(player, TECHS.HYPERSPACE_DRIVE) >= 8
  ) {
    return {
      baseSpeed: 5000,
      driveBonus: 0.3,
      driveTechId: TECHS.HYPERSPACE_DRIVE,
      fuelCost: ship.fuel_cost,
    };
  }
  if (ship.name === "RECYCLER") {
    if (techLevel(player, TECHS.HYPERSPACE_DRIVE) >= 15) {
      return {
        baseSpeed: 6000,
        driveBonus: 0.3,
        driveTechId: TECHS.HYPERSPACE_DRIVE,
        fuelCost: 900,
      };
    }
    if (techLevel(player, TECHS.IMPULSE_DRIVE) >= 17) {
      return {
        baseSpeed: 4000,
        driveBonus: 0.2,
        driveTechId: TECHS.IMPULSE_DRIVE,
        fuelCost: 600,
      };
    }
  }
  return {
    baseSpeed: ship.base_speed,
    driveBonus: ship.drive_bonus,
    driveTechId: driveTechId(ship),
    fuelCost: ship.fuel_cost,
  };
}

function effectiveShipSpeed(ship, player) {
  ship = shipObject(ship);
  const stats = effectiveShipDriveStats(ship, player);
  const driveBonus = stats.driveTechId
    ? stats.driveBonus * techLevel(player, stats.driveTechId)
    : 0;
  const generalBonus = Number(
    player.classId === PLAYER.GENERAL_CLASS_ID &&
      (
        (
          ship.index < NAME_TO_INDEX.ROCKET_LAUNCHER &&
          !CIVILIAN_NAMES.has(ship.name)
        ) ||
        ship.name === "RECYCLER"
      ) &&
      ship.name !== "DEATHSTAR",
  );
  const collectorBonus = Number(
    player.classId === PLAYER.COLLECTOR_CLASS_ID &&
      (ship.name === "SMALL_CARGO" || ship.name === "LARGE_CARGO"),
  );
  const warriorBonus =
    player.allianceClassId === ALLIANCE.WARRIOR_CLASS_ID ? 0.1 : 0;
  return stats.baseSpeed * (
    1 +
    driveBonus +
    generalBonus +
    collectorBonus +
    warriorBonus +
    lifeformBonus(player, ship, "speed")
  );
}

function effectiveFuelCost(ship, player) {
  ship = shipObject(ship);
  return Math.max(
    0,
    effectiveShipDriveStats(ship, player).fuelCost *
      (1 - lifeformBonus(player, ship, "fuel")),
  );
}

export function effectiveCargoCapacity(ship, player) {
  ship = shipObject(ship);
  return (
    ship.cargo_capacity *
    (1 + 0.05 * techLevel(player, TECHS.HYPERSPACE)) *
    (1 + lifeformBonus(player, ship, "cargo"))
  );
}

export function cargoCapacity(units, player) {
  let capacity = 0;
  for (let index = 0; index < units.length; index++) {
    capacity += (units[index] || 0) * effectiveCargoCapacity(index, player);
  }
  return capacity;
}

export function cargoNeeded(resourceAmount, ship, player, units = []) {
  return Math.ceil(
    Math.max(0, resourceAmount - cargoCapacity(units, player)) /
      effectiveCargoCapacity(ship, player),
  );
}

function flightDurationSeconds(
  distance,
  slowestSpeed,
  speedPercent,
  universe,
  fleetSpeedType = "war_fleet_speed",
  fleetSpeed = null,
) {
  const field = fleetSpeedType.replace(/_([a-z])/g, (_match, char) =>
    char.toUpperCase()
  );
  fleetSpeed ??= universeValue(universe, fleetSpeedType, field);
  return Math.max(
    1,
    Math.round(
      (
        35000 /
          (speedPercent / 10) *
          Math.sqrt((distance * 10) / slowestSpeed) +
        10
      ) / fleetSpeed,
    ),
  );
}

export function fleetFlightStats(
  fleet,
  targetCoords,
  speedPercent,
  universe,
  fleetSpeedType = "war_fleet_speed",
  fleetSpeed = null,
) {
  const indexes = fleet.units
    .map((count, index) => (count > 0 ? index : -1))
    .filter((index) => index >= 0);
  if (!indexes.length) return { duration: 0, fuel: 0 };
  const distance = flightDistance(fleet.coords, targetCoords, universe);
  const speedValues = indexes.map((index) =>
    effectiveShipSpeed(index, fleet.player)
  );
  const slowestSpeed = Math.min(...speedValues.filter((speed) => speed > 0));
  if (!Number.isFinite(slowestSpeed)) return { duration: 0, fuel: 0 };

  let fuel = 0;
  for (const [position, index] of indexes.entries()) {
    fuel +=
      effectiveFuelCost(index, fleet.player) *
      fleet.units[index] *
      distance /
      35000 *
      (
        speedPercent /
          100 *
          Math.sqrt(slowestSpeed / speedValues[position]) +
        1
      ) ** 2;
  }
  if (fleet.player.classId === PLAYER.GENERAL_CLASS_ID) {
    fuel *= 0.75;
  }
  fuel *= universeValue(
    universe,
    "deuterium_consumption_factor",
    "deuteriumConsumptionFactor",
  );
  return {
    duration: flightDurationSeconds(
      distance,
      slowestSpeed,
      speedPercent,
      universe,
      fleetSpeedType,
      fleetSpeed,
    ),
    fuel: 1 + Math.floor(fuel + 0.5),
    distance,
    slowestSpeed,
  };
}

export function recyclerFlightStats(
  fleet,
  targetCoords,
  speedPercent,
  universe,
) {
  const recyclerIndex = NAME_TO_INDEX.RECYCLER;
  const recyclerCount = fleet.units[recyclerIndex] || 0;
  if (!recyclerCount) return { duration: 0, fuel: 0 };
  const units = new Array(SHIPS.length).fill(0);
  units[recyclerIndex] = recyclerCount;
  return fleetFlightStats(
    { ...fleet, units },
    targetCoords,
    speedPercent,
    universe,
  );
}
