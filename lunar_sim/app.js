import {
  TECHS as COMBAT_TECHS,
  configureShips as configureCombatService,
  simulateTrialResults,
} from "./combat.mjs?v=20260618-localassets1";
import {
  cargoCapacity as serviceCargoCapacityTotal,
  cargoNeeded as serviceCargoNeeded,
  configureShips as configureShipService,
  effectiveCargoCapacity as serviceCargoCapacity,
  fleetFlightStats as serviceFleetFlightStats,
  flightDistance as serviceFlightDistance,
  recyclerFlightStats as serviceRecyclerFlightStats,
  webFleet,
} from "./ships.mjs?v=20260618-localassets1";

const shipCatalog = await fetch("ship_types.json").then((response) => response.json());
configureShipService(shipCatalog);
configureCombatService(shipCatalog);

const defenseNames = new Set([
  "ROCKET_LAUNCHER",
  "LIGHT_LASER",
  "HEAVY_LASER",
  "GAUSS_CANNON",
  "ION_CANNON",
  "PLASMA_TURRET",
  "SMALL_SHIELD_DOME",
  "LARGE_SHIELD_DOME",
  "SOLAR_SATELLITE",
  "CRAWLER",
]);
const combatShips = shipCatalog.filter((ship) => !defenseNames.has(ship.name));
const planetUnits = shipCatalog.filter((ship) => defenseNames.has(ship.name));
const ogameIdToShip = new Map(shipCatalog.map((ship) => [ship.ogame_id, ship]));
const recyclerIndex = shipCatalog.find((ship) => ship.name === "RECYCLER").index;
const shipMsuValues = shipCatalog.map((ship) =>
  metalStandardUnits({
    metal: ship.metal,
    crystal: ship.crystal,
    deuterium: ship.deuterium,
  })
);
const classById = new Map([
  [0, "none"],
  [1, "collector"],
  [2, "general"],
  [3, "discoverer"],
]);
const allianceClassById = new Map([
  [0, "none"],
  [1, "trader"],
  [2, "researcher"],
  [3, "warrior"],
]);
const combatClassIds = {
  none: 0,
  collector: 1,
  general: 2,
  discoverer: 3,
};
const combatAllianceClassIds = {
  none: 0,
  warrior: 1,
};
const combatLifeformFields = {
  lfWeapon: "weapon",
  lfShield: "shield",
  lfArmor: "armor",
};
const en274Universe = {
  name: "Scorpius",
  code: "en-274",
  fleetDebris: 0.7,
  defenseDebris: 0,
  defenseRepair: 0.7,
  deuteriumInDebris: true,
  deuteriumConsumptionFactor: 0.5,
  warFleetSpeed: 2,
  peacefulFleetSpeed: 8,
  holdingFleetSpeed: 4,
  galaxies: 5,
  systems: 499,
  circularGalaxy: true,
  circularSystem: true,
};
const currentUniverse = { ...en274Universe };
const shipIconUrls = {
  SMALL_CARGO: "assets/ships/small_cargo.webp",
  LARGE_CARGO: "assets/ships/large_cargo.webp",
  LIGHT_FIGHTER: "assets/ships/light_fighter.webp",
  HEAVY_FIGHTER: "assets/ships/heavy_fighter.webp",
  CRUISER: "assets/ships/cruiser.webp",
  BATTLESHIP: "assets/ships/battleship.webp",
  COLONY_SHIP: "assets/ships/colony_ship.webp",
  RECYCLER: "assets/ships/recycler.webp",
  ESPIONAGE_PROBE: "assets/ships/espionage_probe.webp",
  BOMBER: "assets/ships/bomber.webp",
  SOLAR_SATELLITE: "assets/ships/solar_satellite.webp",
  DESTROYER: "assets/ships/destroyer.webp",
  DEATHSTAR: "assets/ships/deathstar.webp",
  BATTLECRUISER: "assets/ships/battlecruiser.webp",
  CRAWLER: "assets/ships/crawler.webp",
  REAPER: "assets/ships/reaper.webp",
  PATHFINDER: "assets/ships/pathfinder.webp",
  ROCKET_LAUNCHER: "assets/ships/rocket_launcher.webp",
  LIGHT_LASER: "assets/ships/light_laser.webp",
  HEAVY_LASER: "assets/ships/heavy_laser.webp",
  GAUSS_CANNON: "assets/ships/gauss_cannon.webp",
  ION_CANNON: "assets/ships/ion_cannon.webp",
  PLASMA_TURRET: "assets/ships/plasma_turret.webp",
  SMALL_SHIELD_DOME: "assets/ships/small_shield_dome.webp",
  LARGE_SHIELD_DOME: "assets/ships/large_shield_dome.webp",
};
const classIconUrls = {
  collector: "assets/classes/collector.webp",
  general: "assets/classes/general.webp",
  discoverer: "assets/classes/discoverer.webp",
};
const allianceIconUrls = {
  trader: "assets/alliances/trader.webp",
  researcher: "assets/alliances/researcher.webp",
  warrior: "assets/alliances/warrior.webp",
};
const techIconUrls = {
  weapon: "assets/tech/weapon.webp",
  shield: "assets/tech/shield.webp",
  armor: "assets/tech/armor.webp",
  combustion: "assets/tech/combustion.webp",
  impulse: "assets/tech/impulse.webp",
  hyperspace: "assets/tech/hyperspace.webp",
  hyperspaceTech: "assets/tech/hyperspacetech.webp",
};
const resourceIconUrls = {
  metal: "assets/resources/metal.webp",
  crystal: "assets/resources/crystal.webp",
  deuterium: "assets/resources/deuterium.webp",
};
const resourceLabels = {
  metal: "Metal",
  crystal: "Crystal",
  deuterium: "Deuterium",
  msu: "MSU",
};
const optimizerProfileShips = {
  tactical: [
    "SMALL_CARGO",
    "LIGHT_FIGHTER",
    "HEAVY_FIGHTER",
    "CRUISER",
    "BATTLESHIP",
    "DESTROYER",
    "BATTLECRUISER",
    "REAPER",
    "PATHFINDER",
  ],
  fast: ["CRUISER", "BATTLECRUISER", "BATTLESHIP", "PATHFINDER"],
  "fast-reapers": [
    "CRUISER",
    "BATTLECRUISER",
    "BATTLESHIP",
    "REAPER",
    "PATHFINDER",
  ],
  "full-fleet": combatShips.map((ship) => ship.name),
};
const optimizerProfiles = Object.fromEntries(
  Object.entries(optimizerProfileShips).map(([name, ships]) => [
    name,
    new Set(ships),
  ]),
);
const optimizerConstants = {
  candidateTrials: 1,
  validationTrials: 2,
  finalTrials: 3,
  seedOffset: 5000000,
  stepSeedOffset: 100000,
  maxSteps: 64,
};
const optimizerTacticalNames = new Set(optimizerProfileShips.tactical);
const lootPercents = new Set(["50", "75", "100"]);
const linkProfileAliases = new Map([
  ["all", "full-fleet"],
  ["full", "full-fleet"],
  ["full-fleet", "full-fleet"],
  ["reapers", "fast-reapers"],
  ["fast-reapers", "fast-reapers"],
  ["fast+reapers", "fast-reapers"],
  ["fast", "fast"],
  ["tactical", "tactical"],
]);
const sideLabels = {
  attacker: "Attacker",
  defender: "Defender",
};
const sideLimits = {
  attacker: 16,
  defender: 5,
};
const forces = {
  attacker: [emptyForce("attacker", 0, true)],
  defender: [emptyForce("defender", 0, true)],
};
const activeForce = {
  attacker: 0,
  defender: 0,
};
let lastResult = null;
const elementCache = new Map();
const pendingIconImages = [];
let iconLoadScheduled = false;
const iconImageBatchSize = 8;

function emptyLifeforms() {
  return shipCatalog.map(() => ({
    lfWeapon: 0,
    lfShield: 0,
    lfArmor: 0,
  }));
}

function normalizeLifeforms(lifeforms) {
  const normalized = emptyLifeforms();
  if (!Array.isArray(lifeforms)) {
    return normalized;
  }
  for (let index = 0; index < Math.min(lifeforms.length, normalized.length); index++) {
    normalized[index].lfWeapon = Number(lifeforms[index]?.lfWeapon) || 0;
    normalized[index].lfShield = Number(lifeforms[index]?.lfShield) || 0;
    normalized[index].lfArmor = Number(lifeforms[index]?.lfArmor) || 0;
  }
  return normalized;
}

function lifeformsFromTech(tech) {
  return shipCatalog.map(() => ({
    lfWeapon: tech.lfWeapon || 0,
    lfShield: tech.lfShield || 0,
    lfArmor: tech.lfArmor || 0,
  }));
}

function query(id) {
  if (!elementCache.has(id)) {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Missing element: #${id}`);
    }
    elementCache.set(id, element);
  }
  return elementCache.get(id);
}

function numberValue(id, fallback = 0) {
  const value = Number(query(id).value);
  return Number.isFinite(value) ? value : fallback;
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function percentOrFactor(value) {
  const number = finiteNumber(value);
  if (number === null) {
    return null;
  }
  return number > 1 ? number / 100 : number;
}

function booleanValue(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Boolean(value);
  }
  const text = String(value).toLowerCase();
  if (["1", "true", "yes", "on"].includes(text)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(text)) {
    return false;
  }
  return null;
}

function emptyCounts() {
  return new Array(shipCatalog.length).fill(0);
}

function defaultCounts(side) {
  const counts = emptyCounts();
  for (const ship of shipCatalog) {
    if (
      side === "attacker" &&
      ["LIGHT_FIGHTER", "CRUISER", "BATTLECRUISER"].includes(ship.name)
    ) {
      counts[ship.index] = 1000000;
    }
    if (
      side === "defender" &&
      ["ROCKET_LAUNCHER", "LIGHT_LASER", "GAUSS_CANNON"].includes(ship.name)
    ) {
      counts[ship.index] = 1000000;
    }
  }
  return counts;
}

function emptyForce(side, index, withDefaults = false) {
  return {
    name: `${sideLabels[side]} ${index + 1}`,
    srKey: "",
    className: "none",
    allianceClassName: "none",
    tech: {
      weapon: 20,
      shield: 20,
      armor: 20,
      combustion: 18,
      impulse: 18,
      hyperspace: 18,
      hyperspaceTech: 18,
      lfWeapon: 0,
      lfShield: 0,
      lfArmor: 0,
    },
    coords: {
      galaxy: 1,
      system: 1,
      position: side === "attacker" ? 1 : 16,
    },
    speed: 100,
    resources: {
      metal: 0,
      crystal: 0,
      deuterium: 0,
    },
    recyclers: {
      count: 0,
      cargoBonus: 0,
    },
    lifeforms: emptyLifeforms(),
    counts: withDefaults ? defaultCounts(side) : emptyCounts(),
  };
}

function shipInitials(ship) {
  return ship.display_name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}

function iconElement(className, url, fallbackText) {
  const icon = document.createElement("span");
  const fallback = document.createElement("span");
  icon.className = className;
  fallback.className = "icon-fallback";
  fallback.textContent = fallbackText;
  if (!url) {
    icon.classList.add("icon-failed");
  } else {
    const image = document.createElement("img");
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("load", () => {
      icon.classList.add("icon-loaded");
    });
    image.addEventListener("error", () => {
      icon.classList.add("icon-failed");
    });
    icon.append(image);
    queueIconImage(image, url);
  }
  icon.append(fallback);
  return icon;
}

function queueIconImage(image, url) {
  pendingIconImages.push([image, url]);
  scheduleIconImageLoading();
}

function scheduleIconImageLoading() {
  if (iconLoadScheduled) {
    return;
  }
  iconLoadScheduled = true;
  if (window.requestIdleCallback) {
    window.requestIdleCallback(loadIconImageBatch, { timeout: 1500 });
  } else {
    window.setTimeout(loadIconImageBatch, 250);
  }
}

function loadIconImageBatch() {
  iconLoadScheduled = false;
  for (
    let index = 0;
    index < iconImageBatchSize && pendingIconImages.length;
    index++
  ) {
    const [image, url] = pendingIconImages.shift();
    image.src = url;
  }
  if (pendingIconImages.length) {
    scheduleIconImageLoading();
  }
}

function shipIconElement(ship) {
  return iconElement("ship-icon", shipIconUrls[ship.name], shipInitials(ship));
}

function isRecycler(ship) {
  return ship.name === "RECYCLER";
}

function resourceMarker(key, label) {
  const marker = document.createElement("span");
  marker.className = "resource-marker";
  marker.title = label;
  marker.setAttribute("aria-label", label);
  if (key === "msu") {
    const badge = document.createElement("span");
    badge.className = "msu-badge";
    badge.textContent = "MSU";
    marker.append(badge);
  } else {
    marker.append(iconElement("resource-icon", resourceIconUrls[key], label[0]));
  }
  return marker;
}

function isShieldDome(ship) {
  return ["SMALL_SHIELD_DOME", "LARGE_SHIELD_DOME"].includes(ship.name);
}

function decorateChoiceIcons() {
  for (const button of document.querySelectorAll("[data-class]")) {
    const className = button.dataset.class;
    const fallback = button.textContent.trim() || button.title[0] || "?";
    button.textContent = "";
    button.append(iconElement("choice-icon", classIconUrls[className], fallback));
  }
  for (const button of document.querySelectorAll("[data-alliance-class]")) {
    const className = button.dataset.allianceClass;
    const fallback = button.textContent.trim() || button.title[0] || "?";
    button.textContent = "";
    button.append(iconElement("choice-icon", allianceIconUrls[className], fallback));
  }
}

function decorateTechIcons() {
  for (const label of document.querySelectorAll("[data-tech]")) {
    const fallback = label.textContent.trim().slice(0, 1);
    label.prepend(iconElement("tech-icon", techIconUrls[label.dataset.tech], fallback));
  }
}

function decorateResourceHeaders() {
  for (const header of document.querySelectorAll("[data-resource-header]")) {
    const key = header.dataset.resourceHeader;
    const label = resourceLabels[key];
    header.textContent = "";
    header.append(resourceMarker(key, label));
  }
}

function renderCountInputs(container, ships) {
  container.textContent = "";
  const fragment = document.createDocumentFragment();
  for (const ship of ships) {
    const row = document.createElement("li");
    const control = document.createElement(isShieldDome(ship) ? "div" : "label");
    const shipMain = document.createElement("span");
    const shipDetails = document.createElement("span");
    const shipMeta = document.createElement("span");
    const name = document.createElement("span");
    const remainingMean = document.createElement("span");
    const remainingRange = document.createElement("span");
    const profileStatus = document.createElement("span");
    const recyclerStatus = document.createElement("span");
    const recyclerHelp = document.createElement("span");
    const resetButton = document.createElement("button");
    let countInput = null;
    row.className = "ship-row";
    row.dataset.shipIndex = String(ship.index);
    if (isRecycler(ship)) {
      row.dataset.recyclerRow = "true";
    }
    control.className = "ship-control-row";
    shipMain.className = "ship-main";
    shipDetails.className = "ship-details";
    shipMeta.className = "ship-meta";
    name.className = "label-text";
    name.textContent = ship.display_name;
    remainingMean.className = "remaining";
    remainingMean.dataset.remainingMeanIndex = String(ship.index);
    remainingRange.className = "remaining-range";
    remainingRange.dataset.remainingRangeIndex = String(ship.index);
    profileStatus.className = "profile-status";
    profileStatus.dataset.profileStatusIndex = String(ship.index);
    recyclerStatus.className = "recycler-status";
    recyclerHelp.className = "recycler-help";
    recyclerHelp.textContent = "?";
    recyclerHelp.setAttribute("aria-hidden", "true");
    shipMeta.append(profileStatus, recyclerStatus, recyclerHelp);
    shipDetails.append(name, remainingRange, shipMeta);
    shipMain.append(shipIconElement(ship), shipDetails);
    control.append(shipMain, remainingMean);
    resetButton.type = "button";
    resetButton.className = "count-reset";
    resetButton.textContent = "x";
    resetButton.title = `Reset ${ship.display_name} to 0`;
    resetButton.setAttribute("aria-label", `Reset ${ship.display_name} to 0`);
    if (isShieldDome(ship)) {
      const option = document.createElement("span");
      const input = document.createElement("input");
      countInput = input;
      option.className = "shield-radio-option shield-single-option";
      input.type = "radio";
      input.name = `${container.id}-${ship.index}`;
      input.value = "1";
      input.dataset.shipIndex = String(ship.index);
      input.ariaLabel = ship.display_name;
      option.addEventListener("pointerdown", () => {
        input.dataset.wasChecked = input.checked ? "true" : "false";
      });
      option.addEventListener("click", (event) => {
        if (event.target !== input) {
          input.dataset.wasChecked = input.checked ? "true" : "false";
          input.click();
        }
      });
      input.addEventListener("click", () => {
        if (input.dataset.wasChecked === "true") {
          input.checked = false;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
        input.dataset.wasChecked = "";
      });
      option.append(input);
      control.append(option);
    } else {
      const input = document.createElement("input");
      countInput = input;
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.value = "0";
      input.dataset.shipIndex = String(ship.index);
      control.append(input);
    }
    resetButton.addEventListener("click", () => {
      if (countInput.type === "radio") {
        countInput.checked = false;
      } else {
        countInput.value = "0";
      }
      countInput.dispatchEvent(new Event("input", { bubbles: true }));
      countInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    row.append(control, resetButton);
    fragment.append(row);
  }
  container.append(fragment);
}

function readCountsFrom(containers) {
  const counts = emptyCounts();
  for (const container of containers) {
    for (const input of container.querySelectorAll("[data-ship-index]")) {
      if (input.type === "radio" && !input.checked) {
        continue;
      }
      counts[Number(input.dataset.shipIndex)] = Number(input.value) || 0;
    }
  }
  return counts;
}

function writeCountsTo(containers, counts) {
  for (const container of containers) {
    for (const input of container.querySelectorAll("[data-ship-index]")) {
      const count = counts[Number(input.dataset.shipIndex)] || 0;
      if (input.type === "radio") {
        input.checked = input.value === (count > 0 ? "1" : "0");
      } else {
        input.value = String(count);
      }
    }
  }
}

function defenseHasCounts() {
  return [...query("defense-inputs").querySelectorAll("[data-ship-index]")]
    .some((input) => {
      if (input.type === "radio") {
        return input.checked;
      }
      return Number(input.value) > 0;
    });
}

function syncDefensePanelOpen() {
  query("defense-panel").open = defenseHasCounts();
}

function splitLinkList(value) {
  return String(value || "")
    .split(/[,\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function linkList(params, longName, shortName) {
  return [
    ...params.getAll(longName),
    ...params.getAll(shortName),
  ].flatMap(splitLinkList);
}

function compactNumber(value) {
  if (!value || value === "-") {
    return 0;
  }
  const number = Number.parseInt(value, 36);
  return Number.isFinite(number) ? number : 0;
}

function compactList(value) {
  if (!value || value === "-") {
    return [];
  }
  return value.split(".").map(compactNumber);
}

function compactForceList(value) {
  return String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function compactResources(value) {
  const [metal, crystal, deuterium] = compactList(value);
  return {
    metal: metal || 0,
    crystal: crystal || 0,
    deuterium: deuterium || 0,
  };
}

function compactUnits(value) {
  const counts = emptyCounts();
  if (!value || value === "-") {
    return counts;
  }
  for (const part of value.split(".")) {
    if (part.length < 2) {
      continue;
    }
    const index = compactNumber(part.slice(0, 1));
    if (index >= 0 && index < counts.length) {
      counts[index] = compactNumber(part.slice(1));
    }
  }
  return counts;
}

function compactTech(value) {
  const tech = compactList(value);
  return {
    weapon: tech[0] || 0,
    shield: tech[1] || 0,
    armor: tech[2] || 0,
    combustion: tech[3] || 0,
    impulse: tech[4] || 0,
    hyperspace: tech[5] || 0,
    hyperspaceTech: tech[6] || 0,
    lfWeapon: (tech[7] || 0) / 100,
    lfShield: (tech[8] || 0) / 100,
    lfArmor: (tech[9] || 0) / 100,
  };
}

function compactForce(side, encoded, index) {
  const [classCode, allianceCode, coords, tech, resources, units] =
    encoded.split("~");
  const force = emptyForce(side, index);
  const coordValues = compactList(coords);
  force.className = classById.get(compactNumber(classCode)) || "none";
  force.allianceClassName =
    allianceClassById.get(compactNumber(allianceCode)) || "none";
  force.coords = {
    galaxy: coordValues[0] || 1,
    system: coordValues[1] || 1,
    position: coordValues[2] || (side === "attacker" ? 1 : 16),
  };
  force.tech = compactTech(tech);
  force.lifeforms = lifeformsFromTech(force.tech);
  force.resources = compactResources(resources);
  force.counts = compactUnits(units);
  ensureRecyclerState(force);
  if (!recyclerFights(side, index)) {
    force.recyclers.count = force.counts[recyclerIndex] || 0;
    force.counts[recyclerIndex] = 0;
  }
  return force;
}

function writeCompactForces(side, encodedForces) {
  const limitedForces = encodedForces.slice(0, sideLimits[side]);
  if (!limitedForces.length) {
    return false;
  }
  forces[side] = limitedForces.map((encoded, index) =>
    compactForce(side, encoded, index),
  );
  activeForce[side] = 0;
  return encodedForces.length > limitedForces.length;
}

function appendCompactRecyclers(encodedForces) {
  if (!encodedForces.length) {
    return false;
  }
  let truncated = false;
  for (const encoded of encodedForces) {
    if (forces.attacker.length >= sideLimits.attacker) {
      truncated = true;
      continue;
    }
    const force = compactForce("attacker", encoded, forces.attacker.length);
    force.counts = emptyCounts();
    forces.attacker.push(force);
  }
  return truncated;
}

function writeLinkedForces(side, keys) {
  const limitedKeys = keys.slice(0, sideLimits[side]);
  if (!limitedKeys.length) {
    return false;
  }
  forces[side] = limitedKeys.map((key, index) => ({
    ...emptyForce(side, index),
    srKey: key,
  }));
  activeForce[side] = 0;
  return keys.length > limitedKeys.length;
}

function setSelectValue(id, value) {
  const select = query(id);
  if ([...select.options].some((option) => option.value === value)) {
    select.value = value;
  }
}

function setNumericValue(id, value) {
  if (value === null || value === undefined || value === "") {
    return;
  }
  const number = Number(value);
  if (Number.isFinite(number)) {
    query(id).value = String(number);
  }
}

function setLootPercent(value) {
  if (value === null || value === undefined || value === "") {
    return;
  }
  const percent = String(Math.trunc(Number(value)));
  query("loot-percent").value = lootPercents.has(percent) ? percent : "50";
}

function setBooleanChecked(id, value) {
  if (value === null || value === undefined || value === "") {
    return;
  }
  query(id).checked = !["0", "false", "off", "no"].includes(
    String(value).toLowerCase(),
  );
}

function normalizeLinkProfile(value) {
  if (!value) {
    return null;
  }
  return linkProfileAliases.get(String(value).toLowerCase()) || null;
}

function applyLinkParams() {
  const params = new URLSearchParams(window.location.search);
  if (![...params.keys()].length) {
    return;
  }
  const statusMessages = [];
  const compactAttackers = compactForceList(params.get("A"));
  const compactDefenders = compactForceList(params.get("D"));
  if (writeCompactForces("attacker", compactAttackers)) {
    statusMessages.push(`Only ${sideLimits.attacker} attackers were loaded`);
  } else if (
    !compactAttackers.length &&
    writeLinkedForces("attacker", linkList(params, "attackers", "a"))
  ) {
    statusMessages.push(`Only ${sideLimits.attacker} attackers were loaded`);
  }
  if (writeCompactForces("defender", compactDefenders)) {
    statusMessages.push(`Only ${sideLimits.defender} defenders were loaded`);
  } else if (
    !compactDefenders.length &&
    writeLinkedForces("defender", linkList(params, "defenders", "d"))
  ) {
    statusMessages.push(`Only ${sideLimits.defender} defenders were loaded`);
  }
  const compactRecyclers = compactForceList(params.get("R"));
  if (appendCompactRecyclers(compactRecyclers)) {
    statusMessages.push(`Only ${sideLimits.attacker} attacker/support tabs were loaded`);
  } else {
    const recyclerKeys = linkList(params, "recyclers", "r");
    if (recyclerKeys.length) {
      statusMessages.push("Recycler support keys need fleet-encoded links");
    }
  }
  setSelectValue("command-mode", params.get("mode") || "simulate");
  if (params.has("profile") || params.has("p")) {
    setSelectValue(
      "optimizer-speed",
      normalizeLinkProfile(params.get("profile") || params.get("p")),
    );
  }
  setLootPercent(params.get("loot"));
  setNumericValue("trial-count", params.get("sims"));
  setNumericValue("worker-count", params.get("workers"));
  setNumericValue("fleet-debris", params.get("fleetDebris") || params.get("fd"));
  setNumericValue(
    "defense-debris",
    params.get("defenseDebris") || params.get("dd"),
  );
  setNumericValue("defense-repair", params.get("repair"));
  setBooleanChecked("rapid-fire", params.get("rf"));
  if (["attacker", "defender"].includes(params.get("collector"))) {
    document.querySelector(
      `[name='debris-collector'][value='${params.get("collector")}']`,
    ).checked = true;
  }
  if (statusMessages.length) {
    query("status").value = statusMessages.join("; ");
  }
}

function recyclerFights(side, forceIndex) {
  return side === "defender" && forceIndex === 0;
}

function storeRecyclerCount(side, force, forceIndex) {
  if (recyclerFights(side, forceIndex)) {
    force.recyclers.count = 0;
    return;
  }
  force.recyclers.count = force.counts[recyclerIndex] || 0;
  force.counts[recyclerIndex] = 0;
}

function displayCounts(side, force, forceIndex) {
  const counts = [...force.counts];
  if (!recyclerFights(side, forceIndex)) {
    counts[recyclerIndex] = force.recyclers?.count || 0;
  }
  return counts;
}

function refreshRecyclerRows() {
  const collector = debrisCollector();
  for (const [side, container] of [
    ["attacker", query("attacker-inputs")],
    ["defender", query("defender-inputs")],
  ]) {
    const fights = recyclerFights(side, activeForce[side]);
    const mission = side === collector;
    const text = fights ? "combat" : (mission ? "mission" : "idle");
    const title = fights
      ? "Defender 1 recyclers take part in this battle like stationary ships."
      : (
        mission
          ? "Separate recycle mission. These recyclers do not take part in combat; they add debris collection capacity for this side."
          : "This side is not collecting debris, so these recyclers are not used for debris collection capacity."
      );
    for (const row of container.querySelectorAll("[data-recycler-row]")) {
      const status = row.querySelector(".recycler-status");
      const help = row.querySelector(".recycler-help");
      row.classList.toggle("recycler-combat", fights);
      row.classList.toggle("recycler-mission", !fights);
      row.title = title;
      status.textContent = text;
      status.title = title;
      help.title = title;
      help.setAttribute("aria-label", title);
      help.removeAttribute("aria-hidden");
      row.querySelector("[data-ship-index]").title = title;
    }
  }
}

function sideCountContainers(side) {
  if (side === "attacker") {
    return [query("attacker-inputs")];
  }
  return [query("defender-inputs"), query("defense-inputs")];
}

function readTech(side) {
  return {
    weapon: numberValue(`${side}-weapon`),
    shield: numberValue(`${side}-shield`),
    armor: numberValue(`${side}-armor`),
    combustion: numberValue(`${side}-combustion`),
    impulse: numberValue(`${side}-impulse`),
    hyperspace: numberValue(`${side}-hyperspace`),
    hyperspaceTech: numberValue(`${side}-hyperspace-tech`),
    lfWeapon: numberValue(`${side}-lf-weapon`),
    lfShield: numberValue(`${side}-lf-shield`),
    lfArmor: numberValue(`${side}-lf-armor`),
  };
}

function writeTech(side, tech) {
  query(`${side}-weapon`).value = String(tech.weapon || 0);
  query(`${side}-shield`).value = String(tech.shield || 0);
  query(`${side}-armor`).value = String(tech.armor || 0);
  query(`${side}-combustion`).value = String(tech.combustion || 0);
  query(`${side}-impulse`).value = String(tech.impulse || 0);
  query(`${side}-hyperspace`).value = String(tech.hyperspace || 0);
  query(`${side}-hyperspace-tech`).value = String(tech.hyperspaceTech || 0);
  query(`${side}-lf-weapon`).value = String(tech.lfWeapon || 0);
  query(`${side}-lf-shield`).value = String(tech.lfShield || 0);
  query(`${side}-lf-armor`).value = String(tech.lfArmor || 0);
}

function readCoords(side) {
  return {
    galaxy: numberValue(`${side}-galaxy`, 1),
    system: numberValue(`${side}-system`, 1),
    position: numberValue(`${side}-position`, 1),
  };
}

function writeCoords(side, coords) {
  query(`${side}-galaxy`).value = String(coords.galaxy || 1);
  query(`${side}-system`).value = String(coords.system || 1);
  query(`${side}-position`).value = String(coords.position || 1);
}

function readResources() {
  return {
    metal: numberValue("resource-metal"),
    crystal: numberValue("resource-crystal"),
    deuterium: numberValue("resource-deuterium"),
  };
}

function writeResources(resources) {
  query("resource-metal").value = String(resources.metal || 0);
  query("resource-crystal").value = String(resources.crystal || 0);
  query("resource-deuterium").value = String(resources.deuterium || 0);
}

function writeUniverseSettings() {
  query("fleet-debris").value = String(
    Math.round((currentUniverse.fleetDebris || 0) * 10000) / 100,
  );
  query("defense-debris").value = String(
    Math.round((currentUniverse.defenseDebris || 0) * 10000) / 100,
  );
  query("defense-repair").value = String(
    Math.round((currentUniverse.defenseRepair || 0) * 10000) / 100,
  );
}

function ensureRecyclerState(force) {
  if (!force.recyclers) {
    force.recyclers = { count: 0, cargoBonus: 0 };
  }
}

function ensureLifeformState(force) {
  force.lifeforms = normalizeLifeforms(force.lifeforms);
}

function readClass(side) {
  return (
    document.querySelector(
      `.player-classes[data-side="${side}"] [data-class].selected`,
    )
      ?.dataset.class || "none"
  );
}

function writeClass(side, className) {
  for (const button of document.querySelectorAll(
    `.player-classes[data-side="${side}"] [data-class]`,
  )) {
    button.classList.toggle("selected", button.dataset.class === (className || "none"));
  }
}

function readAllianceClass(side) {
  return (
    document.querySelector(
      `.player-classes[data-side="${side}"] [data-alliance-class].selected`,
    )
      ?.dataset.allianceClass || "none"
  );
}

function writeAllianceClass(side, className) {
  for (const button of document.querySelectorAll(
    `.player-classes[data-side="${side}"] [data-alliance-class]`,
  )) {
    button.classList.toggle(
      "selected",
      button.dataset.allianceClass === (className || "none"),
    );
  }
}

function active(side) {
  return forces[side][activeForce[side]];
}

function saveActiveForce(side) {
  const force = active(side);
  force.srKey = query(`${side}-sr-key`).value.trim();
  force.className = readClass(side);
  force.allianceClassName = readAllianceClass(side);
  force.tech = readTech(side);
  force.coords = readCoords(side);
  force.speed = numberValue(`${side}-speed`, force.speed || 100);
  ensureRecyclerState(force);
  ensureLifeformState(force);
  force.counts = readCountsFrom(sideCountContainers(side));
  storeRecyclerCount(side, force, activeForce[side]);
  if (side === "defender") {
    force.resources = readResources();
  }
}

function loadActiveForce(side) {
  const force = active(side);
  query(`${side}-sr-key`).value = force.srKey || "";
  writeClass(side, force.className);
  writeAllianceClass(side, force.allianceClassName);
  writeTech(side, force.tech);
  writeCoords(side, force.coords);
  query(`${side}-speed`).value = String(force.speed || (side === "attacker" ? 100 : 0));
  ensureRecyclerState(force);
  ensureLifeformState(force);
  writeCountsTo(
    sideCountContainers(side),
    displayCounts(side, force, activeForce[side]),
  );
  if (side === "defender") {
    writeResources(force.resources);
    syncDefensePanelOpen();
  }
  refreshRecyclerRows();
}

function renderTabs(side) {
  const list = query(`${side}-tabs`);
  list.textContent = "";
  forces[side].forEach((force, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = force.name;
    button.className = index === activeForce[side] ? "active" : "";
    button.addEventListener("click", () => {
      saveActiveForce(side);
      activeForce[side] = index;
      renderTabs(side);
      loadActiveForce(side);
      if (lastResult) {
        renderActiveRemaining(lastResult);
      }
    });
    item.append(button);
    list.append(item);
  });

  const addItem = document.createElement("li");
  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "add-force";
  addButton.textContent = "+";
  addButton.addEventListener("click", () => addForce(side));
  addItem.append(addButton);
  list.append(addItem);
  query(`remove-${side}`).hidden = forces[side].length <= 1;
}

function addForce(side) {
  saveActiveForce(side);
  if (forces[side].length >= sideLimits[side]) {
    query("status").value = `${sideLabels[side]} limit is ${sideLimits[side]}`;
    return;
  }
  forces[side].push(emptyForce(side, forces[side].length));
  activeForce[side] = forces[side].length - 1;
  renderTabs(side);
  loadActiveForce(side);
}

function removeActiveForce(side) {
  if (forces[side].length <= 1) {
    return;
  }
  forces[side].splice(activeForce[side], 1);
  forces[side].forEach((force, index) => {
    force.name = `${sideLabels[side]} ${index + 1}`;
  });
  activeForce[side] = Math.max(0, activeForce[side] - 1);
  renderTabs(side);
  loadActiveForce(side);
}

function clearSide(side, shipsOnly = false) {
  const force = active(side);
  force.counts = emptyCounts();
  if (!shipsOnly) {
    const empty = emptyForce(side, activeForce[side]);
    force.srKey = "";
    force.className = empty.className;
    force.allianceClassName = empty.allianceClassName;
    force.tech = empty.tech;
    force.coords = empty.coords;
    force.speed = empty.speed;
    force.resources = empty.resources;
    force.recyclers = empty.recyclers;
    force.lifeforms = empty.lifeforms;
  }
  loadActiveForce(side);
  lastResult = null;
  clearResultDisplay();
}

function normalizeSrKey(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  try {
    const url = new URL(trimmed);
    return url.pathname.split("/").filter(Boolean).pop() || trimmed;
  } catch (_error) {
    return trimmed;
  }
}

function srApiUrl(srKey) {
  return `https://ogame.squareqrow.com/api/report/${encodeURIComponent(srKey)}`;
}

function normalizeReportPayload(payload) {
  if (payload.RESULT_DATA?.details) {
    return payload.RESULT_DATA;
  }
  if (payload.details) {
    return payload;
  }
  throw new Error("Report JSON has no report details");
}

async function fetchSrReport(srKey) {
  let response;
  try {
    response = await fetch(srApiUrl(srKey));
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "SR lookup was blocked. Paste the report JSON instead.",
      );
    }
    throw error;
  }
  if (!response.ok) {
    throw new Error(`SR lookup failed: ${response.status}`);
  }
  const payload = await response.json();
  return normalizeReportPayload(payload);
}

function pastedSrReport(side) {
  const value = query(`${side}-sr-json`).value.trim();
  if (!value) {
    throw new Error(`Paste ${sideLabels[side].toLowerCase()} report JSON first`);
  }
  return normalizeReportPayload(JSON.parse(value));
}

function reportCounts(report, includeDefenses) {
  const counts = emptyCounts();
  const details = report.details;
  for (const unit of details.ships || []) {
    const ship = ogameIdToShip.get(Number(unit.ship_type));
    if (ship) {
      counts[ship.index] += Number(unit.count) || 0;
    }
  }
  if (includeDefenses) {
    for (const unit of details.defense || details.defenses || []) {
      const unitId = Number(unit.defense_type ?? unit.ship_type);
      const ship = ogameIdToShip.get(unitId);
      if (ship) {
        counts[ship.index] += Number(unit.count) || 0;
      }
    }
  }
  return counts;
}

function reportTech(report) {
  const techs = new Map(
    (report.details.research || []).map((item) => [
      Number(item.research_type),
      Number(item.level) || 0,
    ]),
  );
  return {
    weapon: techs.get(109) || 0,
    shield: techs.get(110) || 0,
    armor: techs.get(111) || 0,
    hyperspaceTech: techs.get(114) || 0,
    combustion: techs.get(115) || 0,
    impulse: techs.get(117) || 0,
    hyperspace: techs.get(118) || 0,
  };
}

function reportClass(report) {
  const classId = Number(report.generic?.defender_character_class_id || 0);
  return classById.get(classId) || "none";
}

function reportAllianceClass(report) {
  const rawClass =
    report.generic?.defender_alliance_class_id ??
    report.generic?.alliance_class_id ??
    report.generic?.defender_alliance_class ??
    report.generic?.alliance_class ??
    0;
  const classId = Number(rawClass);
  if (Number.isFinite(classId)) {
    return allianceClassById.get(classId) || "none";
  }
  const className = String(rawClass).toLowerCase();
  if (className.includes("trader")) {
    return "trader";
  }
  if (className.includes("researcher")) {
    return "researcher";
  }
  if (className.includes("warrior")) {
    return "warrior";
  }
  return "none";
}

function reportCoords(report) {
  const coordText = report.generic?.defender_planet_coordinates || "";
  const match = String(coordText).match(/(\d+):(\d+):(\d+)/);
  if (!match) {
    return null;
  }
  return {
    galaxy: Number(match[1]),
    system: Number(match[2]),
    position: Number(match[3]),
  };
}

function reportResources(report) {
  const resources = report.details.resources || {};
  if (Array.isArray(resources)) {
    const values = { metal: 0, crystal: 0, deuterium: 0 };
    for (const item of resources) {
      values[String(item.resource_type).toLowerCase()] = Number(item.amount) || 0;
    }
    return values;
  }
  return {
    metal: Number(resources.metal) || 0,
    crystal: Number(resources.crystal) || 0,
    deuterium: Number(resources.deuterium) || 0,
  };
}

function reportUniverseSource(report) {
  return {
    ...(report.server || {}),
    ...(report.serverData || {}),
    ...(report.universe || {}),
    ...(report.settings || {}),
    ...(report.details?.server || {}),
    ...(report.details?.serverData || {}),
    ...(report.details?.universe || {}),
    ...(report.details?.settings || {}),
    ...(report.generic?.server || {}),
    ...(report.generic?.serverData || {}),
    ...(report.generic?.universe || {}),
    ...(report.generic?.settings || {}),
    ...(report.generic || {}),
  };
}

function applyNumberSetting(target, field, value) {
  const number = finiteNumber(value);
  if (number !== null) {
    target[field] = number;
  }
}

function applyFactorSetting(target, field, value) {
  const number = percentOrFactor(value);
  if (number !== null) {
    target[field] = number;
  }
}

function applyBooleanSetting(target, field, value) {
  const boolean = booleanValue(value);
  if (boolean !== null) {
    target[field] = boolean;
  }
}

function reportUniverseSettings(report) {
  const source = reportUniverseSource(report);
  const settings = {};
  const name = firstValue(source.name, source.server_name, source.universe_name);
  const code = firstValue(source.code, source.universe, source.server);
  if (name) {
    settings.name = String(name);
  }
  if (code) {
    settings.code = String(code);
  }
  applyNumberSetting(settings, "galaxies", firstValue(
    source.galaxies,
    source.galaxy_count,
    source.nb_galaxies,
  ));
  applyNumberSetting(settings, "systems", firstValue(
    source.systems,
    source.system_count,
    source.nb_systems,
  ));
  applyNumberSetting(settings, "warFleetSpeed", firstValue(
    source.speedFleetWar,
    source.speed_fleet_war,
    source.fleetSpeedWar,
    source.warFleetSpeed,
    source.war_fleet_speed,
  ));
  applyNumberSetting(settings, "peacefulFleetSpeed", firstValue(
    source.speedFleetPeaceful,
    source.speed_fleet_peaceful,
    source.fleetSpeedPeaceful,
    source.peacefulFleetSpeed,
    source.peaceful_fleet_speed,
  ));
  applyNumberSetting(settings, "holdingFleetSpeed", firstValue(
    source.speedFleetHolding,
    source.speed_fleet_holding,
    source.fleetSpeedHolding,
    source.holdingFleetSpeed,
    source.holding_fleet_speed,
  ));
  applyFactorSetting(settings, "fleetDebris", firstValue(
    source.debrisFactor,
    source.debris_factor,
    source.fleetDebris,
    source.fleet_debris,
    source.fleet_debris_factor,
  ));
  applyFactorSetting(settings, "defenseDebris", firstValue(
    source.debrisFactorDef,
    source.debris_factor_def,
    source.defenseDebris,
    source.defense_debris,
    source.defense_debris_factor,
  ));
  applyFactorSetting(settings, "defenseRepair", firstValue(
    source.defenseRepair,
    source.defense_repair,
    source.defense_repair_factor,
    source.repairFactor,
    source.repair_factor,
  ));
  applyFactorSetting(settings, "deuteriumConsumptionFactor", firstValue(
    source.globalDeuteriumSaveFactor,
    source.deuteriumConsumptionFactor,
    source.deuterium_consumption_factor,
  ));
  applyBooleanSetting(settings, "deuteriumInDebris", firstValue(
    source.deuteriumInDebris,
    source.deuterium_in_debris,
  ));
  applyBooleanSetting(settings, "circularGalaxy", firstValue(
    source.donutGalaxy,
    source.circularGalaxy,
    source.circular_galaxy,
  ));
  applyBooleanSetting(settings, "circularSystem", firstValue(
    source.donutSystem,
    source.circularSystem,
    source.circular_system,
  ));
  return settings;
}

function applyReportUniverseSettings(report) {
  const settings = reportUniverseSettings(report);
  if (!Object.keys(settings).length) {
    return false;
  }
  Object.assign(currentUniverse, settings);
  writeUniverseSettings();
  return true;
}

function reportName(report, side, index) {
  return (
    report.generic?.defender_user_name ||
    report.generic?.defender_name ||
    report.generic?.defender_player_name ||
    `${sideLabels[side]} ${index + 1}`
  );
}

function applyReportToForce(force, report, side, index, srKey) {
  force.name = reportName(report, side, index);
  force.srKey = srKey;
  force.className = reportClass(report);
  force.allianceClassName = reportAllianceClass(report);
  force.tech = reportTech(report);
  force.counts = reportCounts(report, side === "defender");
  force.coords = reportCoords(report) || force.coords;
  if (side === "defender") {
    force.resources = reportResources(report);
  }
}

async function loadSrInto(side) {
  const srKey = normalizeSrKey(query(`${side}-sr-key`).value);
  if (!srKey) {
    query("status").value = `Enter a ${sideLabels[side].toLowerCase()} SR key`;
    return;
  }
  saveActiveForce(side);
  query(`${side}-sr-key`).value = srKey;
  query("status").value = `Loading ${sideLabels[side].toLowerCase()} SR`;
  const startedAt = performance.now();
  const report = await fetchSrReport(srKey);
  applyReportUniverseSettings(report);
  applyReportToForce(active(side), report, side, activeForce[side], srKey);
  renderTabs(side);
  loadActiveForce(side);
  lastResult = null;
  clearResultDisplay();
  query("status").value =
    `Loaded ${sideLabels[side].toLowerCase()} SR in ` +
    `${(performance.now() - startedAt).toFixed(0)} ms`;
}

function loadPastedReportInto(side) {
  saveActiveForce(side);
  const report = pastedSrReport(side);
  const srKey = normalizeSrKey(query(`${side}-sr-key`).value) || "pasted";
  applyReportUniverseSettings(report);
  applyReportToForce(active(side), report, side, activeForce[side], srKey);
  renderTabs(side);
  loadActiveForce(side);
  lastResult = null;
  clearResultDisplay();
  query("status").value = `Loaded pasted ${sideLabels[side].toLowerCase()} report`;
}

function summarize(values) {
  const samples = Array.from(
    { length: shipCatalog.length },
    () => [],
  );
  const mean = new Array(shipCatalog.length).fill(0);
  for (const row of values) {
    for (let index = 0; index < row.length; index++) {
      samples[index].push(row[index]);
      mean[index] += row[index];
    }
  }
  const low = new Array(shipCatalog.length).fill(0);
  const high = new Array(shipCatalog.length).fill(0);
  for (let index = 0; index < shipCatalog.length; index++) {
    mean[index] /= Math.max(1, values.length);
    samples[index].sort((left, right) => left - right);
    if (samples[index].length) {
      low[index] = percentile(samples[index], 0.05);
      high[index] = percentile(samples[index], 0.95);
    }
  }
  return { low, mean, high };
}

function summarizeSampleChunks(chunks) {
  const totalSamples = chunks.reduce(
    (total, chunk) => total + chunk.trials,
    0,
  );
  const low = new Array(shipCatalog.length).fill(0);
  const mean = new Array(shipCatalog.length).fill(0);
  const high = new Array(shipCatalog.length).fill(0);
  if (!totalSamples) {
    return { low, mean, high };
  }
  const samples = new Float64Array(totalSamples);
  for (let shipIndex = 0; shipIndex < shipCatalog.length; shipIndex++) {
    let offset = 0;
    let sum = 0;
    for (const chunk of chunks) {
      const start = shipIndex * chunk.trials;
      const values = chunk.values.subarray(start, start + chunk.trials);
      samples.set(values, offset);
      for (let index = 0; index < values.length; index++) {
        sum += values[index];
      }
      offset += values.length;
    }
    samples.sort();
    mean[shipIndex] = sum / totalSamples;
    low[shipIndex] = percentile(samples, 0.05);
    high[shipIndex] = percentile(samples, 0.95);
  }
  return { low, mean, high };
}

function summarizeSurvivors(sampleChunks, legacyRows) {
  return sampleChunks.length
    ? summarizeSampleChunks(sampleChunks)
    : summarize(legacyRows);
}

function summarizeForceSurvivors(sampleChunks, legacyRows, forceCount) {
  const summaries = [];
  for (let forceIndex = 0; forceIndex < forceCount; forceIndex++) {
    summaries.push(
      summarizeSurvivors(
        sampleChunks[forceIndex] || [],
        legacyRows.map((trialForces) =>
          trialForces[forceIndex] || emptyCounts()
        ),
      ),
    );
  }
  return summaries;
}

function percentile(sortedValues, fraction) {
  if (!sortedValues.length) {
    return 0;
  }
  const position = (sortedValues.length - 1) * fraction;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const weight = position - lowerIndex;
  return (
    sortedValues[lowerIndex] * (1 - weight) +
    sortedValues[upperIndex] * weight
  );
}

function formatCount(value) {
  if (!Number.isFinite(value)) {
    return "/";
  }
  if (Math.abs(value) >= 1000000000) {
    return `${(value / 1000000000).toLocaleString(undefined, { maximumFractionDigits: 2 })}B`;
  }
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`;
  }
  if (Math.abs(value) >= 10000) {
    return Math.round(value).toLocaleString();
  }
  if (Math.abs(value) < 10 && value % 1) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return Math.round(value).toLocaleString();
}

function formatSigned(value) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatCount(value)}`;
}

function metalStandardUnits(values) {
  return (
    (values.metal || 0) +
    1.5 * (values.crystal || 0) +
    3 * (values.deuterium || 0)
  );
}

function aggregateCounts(forceList) {
  const counts = emptyCounts();
  for (const force of forceList) {
    for (let index = 0; index < counts.length; index++) {
      counts[index] += force.counts[index] || 0;
    }
  }
  return counts;
}

function emptyResourceValues() {
  return { metal: 0, crystal: 0, deuterium: 0 };
}

function cloneForce(force) {
  return {
    ...force,
    tech: { ...force.tech },
    coords: { ...force.coords },
    resources: { ...(force.resources || emptyResourceValues()) },
    recyclers: { ...(force.recyclers || { count: 0, cargoBonus: 0 }) },
    lifeforms: normalizeLifeforms(force.lifeforms).map((lifeform) => ({
      ...lifeform,
    })),
    counts: [...force.counts],
  };
}

function cloneScenario(scenario) {
  return {
    ...scenario,
    settings: { ...scenario.settings },
    attackers: scenario.attackers.map(cloneForce),
    defenders: scenario.defenders.map(cloneForce),
  };
}

function sumNestedCounts(forceCounts) {
  const counts = emptyCounts();
  for (const force of forceCounts) {
    for (let index = 0; index < force.length; index++) {
      counts[index] += force[index] || 0;
    }
  }
  return counts;
}

function emptySimulationStats() {
  return {
    completed: 0,
    attackerWin: 0,
    draw: 0,
    defenderWin: 0,
    totalRounds: 0,
    minRounds: Number.POSITIVE_INFINITY,
    maxRounds: 0,
    attackerSurvivors: [],
    defenderSurvivors: [],
    attackerForceSurvivors: [],
    defenderForceSurvivors: [],
    attackerSurvivorSampleChunks: [],
    defenderSurvivorSampleChunks: [],
    attackerForceSurvivorSampleChunks: [],
    defenderForceSurvivorSampleChunks: [],
  };
}

function addTrialResults(stats, trialResults) {
  stats.completed += trialResults.length;
  for (const result of trialResults) {
    stats.attackerWin += result.atkWin;
    stats.draw += result.draw;
    stats.defenderWin += result.defWin;
    stats.totalRounds += result.rounds;
    stats.minRounds = Math.min(stats.minRounds, result.rounds);
    stats.maxRounds = Math.max(stats.maxRounds, result.rounds);
    stats.attackerSurvivors.push(sumNestedCounts(result.atkSurvivors));
    stats.defenderSurvivors.push(sumNestedCounts(result.defSurvivors));
    stats.attackerForceSurvivors.push(result.atkSurvivors);
    stats.defenderForceSurvivors.push(result.defSurvivors);
  }
}

function addWorkerResult(stats, data) {
  stats.completed += data.completed;
  stats.attackerWin += data.attackerWin;
  stats.draw += data.draw;
  stats.defenderWin += data.defenderWin;
  stats.totalRounds += data.totalRounds || 0;
  stats.minRounds = Math.min(stats.minRounds, data.minRounds || 0);
  stats.maxRounds = Math.max(stats.maxRounds, data.maxRounds || 0);
  if (data.attackerSurvivorSamples) {
    stats.attackerSurvivorSampleChunks.push({
      trials: data.completed,
      values: data.attackerSurvivorSamples,
    });
    stats.defenderSurvivorSampleChunks.push({
      trials: data.completed,
      values: data.defenderSurvivorSamples,
    });
    for (let index = 0; index < data.attackerForceSurvivorSamples.length; index++) {
      if (!stats.attackerForceSurvivorSampleChunks[index]) {
        stats.attackerForceSurvivorSampleChunks[index] = [];
      }
      stats.attackerForceSurvivorSampleChunks[index].push({
        trials: data.completed,
        values: data.attackerForceSurvivorSamples[index],
      });
    }
    for (let index = 0; index < data.defenderForceSurvivorSamples.length; index++) {
      if (!stats.defenderForceSurvivorSampleChunks[index]) {
        stats.defenderForceSurvivorSampleChunks[index] = [];
      }
      stats.defenderForceSurvivorSampleChunks[index].push({
        trials: data.completed,
        values: data.defenderForceSurvivorSamples[index],
      });
    }
    return;
  }
  stats.attackerSurvivors.push(...(data.attackerSurvivors || []));
  stats.defenderSurvivors.push(...(data.defenderSurvivors || []));
  stats.attackerForceSurvivors.push(...(data.attackerForceSurvivors || []));
  stats.defenderForceSurvivors.push(...(data.defenderForceSurvivors || []));
}

function resultFromSimulationStats(scenario, stats, timing) {
  const completed = Math.max(1, stats.completed);
  const attackerSurvivorStats = summarizeSurvivors(
    stats.attackerSurvivorSampleChunks,
    stats.attackerSurvivors,
  );
  const defenderSurvivorStats = summarizeSurvivors(
    stats.defenderSurvivorSampleChunks,
    stats.defenderSurvivors,
  );
  return {
    scenario,
    attackerWinRate: stats.attackerWin / completed,
    drawRate: stats.draw / completed,
    defenderWinRate: stats.defenderWin / completed,
    originalAttackers: aggregateCounts(scenario.attackers),
    originalDefenders: aggregateCounts(scenario.defenders),
    originalAttackerForces: scenario.attackers.map((force) => force.counts),
    originalDefenderForces: scenario.defenders.map((force) => force.counts),
    attackerSurvivors: stats.attackerSurvivors,
    defenderSurvivors: stats.defenderSurvivors,
    attackerForceSurvivors: stats.attackerForceSurvivors,
    defenderForceSurvivors: stats.defenderForceSurvivors,
    attackerSurvivorStats,
    defenderSurvivorStats,
    attackerForceSurvivorStats: summarizeForceSurvivors(
      stats.attackerForceSurvivorSampleChunks,
      stats.attackerForceSurvivors,
      scenario.attackers.length,
    ),
    defenderForceSurvivorStats: summarizeForceSurvivors(
      stats.defenderForceSurvivorSampleChunks,
      stats.defenderForceSurvivors,
      scenario.defenders.length,
    ),
    rounds: {
      mean: stats.totalRounds / completed,
      low: Number.isFinite(stats.minRounds) ? stats.minRounds : 0,
      high: stats.maxRounds,
    },
    timing,
  };
}

function combatLifeformsFromTech(tech) {
  const values = {};
  for (let index = 0; index < (tech.lifeforms || []).length; index++) {
    const bonuses = {};
    for (const [source, target] of Object.entries(combatLifeformFields)) {
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

function combatPlayerFromForce(force) {
  return {
    classId: combatClassIds[force.className] || 0,
    allianceClassId: combatAllianceClassIds[force.allianceClassName] || 0,
    techs: {
      [COMBAT_TECHS.WEAPON]: force.tech?.weapon || 0,
      [COMBAT_TECHS.SHIELD]: force.tech?.shield || 0,
      [COMBAT_TECHS.ARMOUR]: force.tech?.armor || 0,
    },
    lifeforms: combatLifeformsFromTech({
      lifeforms: normalizeLifeforms(force.lifeforms),
    }),
  };
}

function combatFleetFromForce(force) {
  return {
    units: force.counts,
    player: combatPlayerFromForce(force),
  };
}

function combatScenarioFromScenario(scenario) {
  return {
    attacker: {
      memberFleets: scenario.attackers.map(combatFleetFromForce),
    },
    defender: {
      memberFleets: scenario.defenders.map(combatFleetFromForce),
    },
  };
}

function simulateScenarioDirect(scenario, trials, seed) {
  const startedAt = performance.now();
  const stats = emptySimulationStats();
  addTrialResults(
    stats,
    simulateTrialResults(
      combatScenarioFromScenario(scenario),
      trials,
      seed,
      { rapidFire: scenario.settings?.rapidFire !== false },
    ),
  );
  const elapsedMs = performance.now() - startedAt;
  return resultFromSimulationStats(scenario, stats, {
    elapsedMs,
    workerMs: elapsedMs,
    slowestWorkerMs: elapsedMs,
    trials,
    workers: 1,
    chunks: [trials],
  });
}

function resultAttackerCost(result, withRecyclers = true) {
  const attackerStats = result.attackerSurvivorStats;
  const defenderStats = result.defenderSurvivorStats;
  const attackerLossCounts = lossCounts(result.originalAttackers, attackerStats.mean);
  const defenderLossCounts = lossCounts(result.originalDefenders, defenderStats.mean);
  const attackerLosses = resourceValues(attackerLossCounts);
  const defenderLosses = resourceValues(
    defenderLossCounts,
    result.scenario.settings.defenseRepair,
  );
  const debris = debrisValues(
    attackerLossCounts.map((count, index) => count + defenderLossCounts[index]),
    result.scenario.settings,
  );
  const possibleLoot = scaleValues(
    sumResources(result.scenario.defenders),
    result.scenario.lootPercent / 100,
  );
  const loot = scaleValues(possibleLoot, result.attackerWinRate);
  const mission = missionSummary(result.scenario);
  const collector = withRecyclers ? result.scenario.settings.debrisCollector : "";
  const attackerDebris = collector === "attacker"
    ? debris
    : emptyResourceValues();
  const attackerFuel = resourceValue(
    mission.attackFuel + (collector === "attacker" ? mission.recyclerFuel : 0),
  );
  return (
    metalStandardUnits(addValues(attackerLosses, attackerFuel)) -
    metalStandardUnits(attackerDebris) -
    metalStandardUnits(loot)
  );
}

function isOptimizeMode(mode) {
  return mode === "optimize-profit";
}

function shipMsu(ship) {
  return shipMsuValues[ship.index] || 0;
}

function optimizerProfileShipList(speedProfile) {
  const profile = optimizerProfile(speedProfile);
  return shipCatalog.filter((ship) => profile.has(ship.name));
}

function optimizerConfigForScenario(scenario) {
  const profileShips = optimizerProfileShipList(scenario.speedProfile);
  if (scenario.mode === "optimize-profit") {
    return {
      target: "attacker",
      sign: -1,
      candidateShips: profileShips,
      stepRatio: 0.001,
      minStepRatio: 0,
      stepFromGap: false,
      maxMsu: null,
      scoreSign: 1,
    };
  }
  throw new Error(`Unknown optimization mode: ${scenario.mode}`);
}

function optimizerConstraintMsu(forceList, target) {
  let total = 0;
  for (const ship of shipCatalog) {
    if (
      !optimizerTacticalNames.has(ship.name) &&
      !(target === "defender" && ship.name === "DEATHSTAR")
    ) {
      continue;
    }
    for (const force of forceList) {
      total += (force.counts[ship.index] || 0) * shipMsu(ship);
    }
  }
  return total;
}

function optimizerTargetForces(scenario, target) {
  return target === "attacker" ? scenario.attackers : scenario.defenders;
}

function optimizerTargetForce(scenario, target) {
  return optimizerTargetForces(scenario, target)[0];
}

function optimizerStepMsu(optimization) {
  const targetMsu = optimizerConstraintMsu(
    optimizerTargetForces(optimization.scenario, optimization.config.target),
    optimization.config.target,
  );
  const opponentTarget = optimization.config.target === "attacker"
    ? "defender"
    : "attacker";
  const opponentMsu = optimizerConstraintMsu(
    optimizerTargetForces(optimization.scenario, opponentTarget),
    opponentTarget,
  );
  const basisMsu = optimization.config.stepFromGap
    ? Math.abs(opponentMsu - targetMsu)
    : targetMsu;
  let stepMsu = Math.max(
    basisMsu * optimization.config.stepRatio,
    targetMsu * optimization.config.minStepRatio,
  );
  if (optimization.config.maxMsu !== null) {
    const availableMsu = optimization.config.maxMsu - targetMsu;
    if (availableMsu <= 0) {
      return null;
    }
    stepMsu = Math.min(stepMsu, availableMsu);
  }
  return stepMsu;
}

function optimizerCandidateCount(optimization, ship, stepMsu) {
  let count = Math.floor(stepMsu / shipMsu(ship));
  if (optimization.config.sign < 0) {
    count = Math.min(
      count,
      optimizerTargetForces(
        optimization.scenario,
        optimization.config.target,
      ).reduce(
        (total, force) => total + (force.counts[ship.index] || 0),
        0,
      ),
    );
  } else if (optimization.config.maxMsu !== null) {
    const currentMsu = optimizerConstraintMsu(
      optimizerTargetForces(
        optimization.scenario,
        optimization.config.target,
      ),
      optimization.config.target,
    );
    const availableMsu = optimization.config.maxMsu - currentMsu;
    count = Math.min(count, Math.max(0, Math.floor(availableMsu / shipMsu(ship))));
  }
  return count;
}

function optimizerStepCandidates(optimization, shipIndex, ship, stepMsu) {
  const candidates = [];
  const count = optimizerCandidateCount(optimization, ship, stepMsu);
  if (count > 0) {
    candidates.push([[ship, count]]);
  }
  const halfStepMsu = stepMsu / 2;
  const halfCount = optimizerCandidateCount(optimization, ship, halfStepMsu);
  if (halfCount <= 0) {
    return candidates;
  }
  for (
    let secondIndex = shipIndex + 1;
    secondIndex < optimization.config.candidateShips.length;
    secondIndex++
  ) {
    const secondShip = optimization.config.candidateShips[secondIndex];
    const secondCount = optimizerCandidateCount(
      optimization,
      secondShip,
      halfStepMsu,
    );
    if (secondCount > 0) {
      candidates.push([[ship, halfCount], [secondShip, secondCount]]);
    }
  }
  return candidates;
}

function optimizerCandidates(optimization, stepMsu) {
  const candidates = [];
  for (let index = 0; index < optimization.config.candidateShips.length; index++) {
    for (const changes of optimizerStepCandidates(
      optimization,
      index,
      optimization.config.candidateShips[index],
      stepMsu,
    )) {
      if (optimization.config.maxMsu !== null) {
        const candidate = optimizerScenarioWithChanges(
          optimization.scenario,
          optimization.config,
          changes,
        );
        const candidateMsu = optimizerConstraintMsu(
          optimizerTargetForces(candidate, optimization.config.target),
          optimization.config.target,
        );
        if (candidateMsu > optimization.config.maxMsu) {
          continue;
        }
      }
      candidates.push(changes);
    }
  }
  return candidates;
}

function optimizerScenarioWithChanges(scenario, config, changes) {
  const candidate = cloneScenario(scenario);
  const force = optimizerTargetForce(candidate, config.target);
  for (const [ship, count] of changes) {
    force.counts[ship.index] = Math.max(
      0,
      (force.counts[ship.index] || 0) + config.sign * count,
    );
  }
  return candidate;
}

function optimizerOpponents(scenario, config) {
  const realOpponentForces = config.target === "attacker"
    ? scenario.defenders
    : scenario.attackers;
  return [realOpponentForces.map(cloneForce)];
}

function optimizerMatchupScenario(optimization, candidateScenario, opponentIndex) {
  const matchup = cloneScenario(candidateScenario);
  const opponentForces = optimization.opponents[opponentIndex].map(cloneForce);
  if (optimization.config.target === "attacker") {
    matchup.defenders = opponentForces;
  } else {
    matchup.attackers = opponentForces;
    matchup.defenders.forEach((force) => {
      force.resources = emptyResourceValues();
    });
  }
  return matchup;
}

async function yieldToBrowser() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function optimizerAverageCost(
  optimization,
  candidateScenario,
  trials,
  seed,
  withRecyclers = true,
) {
  const costs = [];
  for (let index = 0; index < optimization.opponents.length; index++) {
    const result = simulateScenarioDirect(
      optimizerMatchupScenario(optimization, candidateScenario, index),
      trials,
      seed + index * 10000,
    );
    costs.push(resultAttackerCost(result, withRecyclers));
    await yieldToBrowser();
  }
  return costs.reduce((total, cost) => total + cost, 0) / costs.length;
}

function optimizerCandidateSeed(changes, baseSeed, sign) {
  let seed = baseSeed;
  if (sign < 0) {
    seed += 50000000;
  }
  changes.forEach(([ship, count], index) => {
    seed += (index + 1) * 1000003 * ship.index + count;
  });
  return seed;
}

async function optimizerScoreCandidate(optimization, changes, baseSeed) {
  const candidate = optimizerScenarioWithChanges(
    optimization.scenario,
    optimization.config,
    changes,
  );
  const cost = await optimizerAverageCost(
    optimization,
    candidate,
    optimizerConstants.candidateTrials,
    optimizerCandidateSeed(changes, baseSeed, optimization.config.sign),
    false,
  );
  return {
    score: optimization.config.scoreSign * cost,
    changes,
  };
}

async function optimizerImprovement(optimization, stepMsu) {
  const candidates = optimizerCandidates(optimization, stepMsu);
  if (!candidates.length) {
    return null;
  }
  const cheapSeed = 1 +
    optimization.history.length * optimizerConstants.stepSeedOffset;
  const results = [];
  for (let index = 0; index < candidates.length; index++) {
    query("status").value =
      `Optimizing step ${optimization.history.length + 1}: ` +
      `${index + 1} / ${candidates.length} candidates`;
    results.push(
      await optimizerScoreCandidate(optimization, candidates[index], cheapSeed),
    );
  }
  results.sort((left, right) => left.score - right.score);
  const historySeedOffset =
    optimization.history.length * optimizerConstants.stepSeedOffset;
  const seed = 1 + optimizerConstants.seedOffset + historySeedOffset;
  for (let index = 0; index < results.length; index++) {
    if (results[index].score >= optimization.bestScore) {
      break;
    }
    query("status").value =
      `Validating step ${optimization.history.length + 1}: ${index + 1}`;
    const candidate = optimizerScenarioWithChanges(
      optimization.scenario,
      optimization.config,
      results[index].changes,
    );
    const totalCost = await optimizerAverageCost(
      optimization,
      candidate,
      optimizerConstants.validationTrials,
      seed + (index + 1) * 10000,
    );
    const totalScore = optimization.config.scoreSign * totalCost;
    if (totalScore < optimization.bestScore) {
      return {
        scenario: candidate,
        score: totalScore,
        changes: results[index].changes,
      };
    }
  }
  return null;
}

async function optimizeScenario(scenario) {
  if (!isOptimizeMode(scenario.mode)) {
    return {
      scenario,
      optimization: null,
    };
  }
  if (scenario.attackers.length > 1 || scenario.defenders.length > 1) {
    throw new Error("Optimization does not support ACS fleets.");
  }
  const optimization = {
    scenario: cloneScenario(scenario),
    config: optimizerConfigForScenario(scenario),
    opponents: [],
    history: [],
    baselineCost: 0,
    bestScore: 0,
    finalCost: 0,
  };
  optimization.opponents = optimizerOpponents(
    optimization.scenario,
    optimization.config,
  );
  query("status").value = "Calculating optimization baseline";
  optimization.baselineCost = await optimizerAverageCost(
    optimization,
    optimization.scenario,
    optimizerConstants.finalTrials,
    1 + optimizerConstants.seedOffset,
  );
  optimization.bestScore =
    optimization.config.scoreSign * optimization.baselineCost;

  while (optimization.history.length < optimizerConstants.maxSteps) {
    const stepMsu = optimizerStepMsu(optimization);
    if (stepMsu === null || stepMsu <= 0) {
      break;
    }
    const improvement = await optimizerImprovement(optimization, stepMsu);
    if (!improvement) {
      break;
    }
    optimization.scenario = improvement.scenario;
    optimization.bestScore = improvement.score;
    optimization.history.push(improvement.changes);
  }

  query("status").value = "Calculating optimized final cost";
  optimization.finalCost = await optimizerAverageCost(
    optimization,
    optimization.scenario,
    optimizerConstants.finalTrials,
    1 + optimizerConstants.seedOffset,
  );
  return {
    scenario: optimization.scenario,
    optimization: {
      target: optimization.config.target,
      action: optimization.config.sign > 0 ? "Add" : "Remove",
      steps: optimization.history.length,
      baselineCost: optimization.baselineCost,
      finalCost: optimization.finalCost,
      history: optimization.history.map((changes) =>
        changes.map(([ship, count]) => ({
          shipName: ship.name,
          displayName: ship.display_name,
          count,
          msu: count * shipMsu(ship),
        }))
      ),
    },
  };
}

function applyOptimizedScenario(scenario, optimization) {
  if (!optimization) {
    return;
  }
  const side = optimization.target;
  const source = optimizerTargetForce(scenario, side);
  forces[side][0] = {
    ...forces[side][0],
    counts: [...source.counts],
    recyclers: { ...(source.recyclers || { count: 0, cargoBonus: 0 }) },
  };
  if (activeForce[side] === 0) {
    loadActiveForce(side);
  }
}

function optimizerProfile(speedProfile) {
  return optimizerProfiles[speedProfile] || optimizerProfiles.tactical;
}

function profileAllowsShip(side, ship, forceIndex, speedProfile) {
  if (isRecycler(ship)) {
    return recyclerFights(side, forceIndex) || side === debrisCollector();
  }
  if (side === "defender") {
    return true;
  }
  return optimizerProfile(speedProfile).has(ship.name);
}

function optimizerCounts(side, counts, forceIndex, speedProfile) {
  return counts.map((count, index) =>
    profileAllowsShip(side, shipCatalog[index], forceIndex, speedProfile)
      ? count
      : 0,
  );
}

function combatCountsForScenario(side, force, forceIndex, speedProfile) {
  const counts = [...force.counts];
  if (!recyclerFights(side, forceIndex)) {
    counts[recyclerIndex] = 0;
  }
  return optimizerCounts(side, counts, forceIndex, speedProfile);
}

function refreshProfileUsage() {
  const speedProfile = query("optimizer-speed").value;
  for (const [side, container] of [
    ["attacker", query("attacker-inputs")],
    ["defender", query("defender-inputs")],
  ]) {
    for (const row of container.querySelectorAll(".ship-row")) {
      const ship = shipCatalog[Number(row.dataset.shipIndex)];
      const used = profileAllowsShip(
        side,
        ship,
        activeForce[side],
        speedProfile,
      );
      const status = row.querySelector(".profile-status");
      row.classList.toggle("profile-unused", !used);
      if (!used && !isRecycler(ship)) {
        row.title = "Excluded by optimizer speed profile";
      } else if (!isRecycler(ship)) {
        row.title = "";
      }
      status.textContent = "";
    }
  }
}

function timingMs(elapsedMs) {
  return `${elapsedMs.toFixed(0)} ms`;
}

function timingLineText(timing) {
  return `${formatCount(timing.trials)} trials · elapsed ${timingMs(timing.elapsedMs)}`;
}

function renderTimingLine(timing) {
  const line = query("timing-line");
  line.value = timingLineText(timing);
  line.hidden = false;
}

function clearTimingLine() {
  const line = query("timing-line");
  line.value = "";
  line.hidden = true;
}

function debrisCollector() {
  return document.querySelector("[name='debris-collector']:checked")?.value ||
    "attacker";
}

function scenarioForSimulation() {
  saveActiveForce("attacker");
  saveActiveForce("defender");
  const mode = query("command-mode").value;
  const speedProfile = query("optimizer-speed").value;
  return {
    mode,
    speedProfile,
    lootPercent: numberValue("loot-percent", 50),
    trials: Math.max(1, numberValue("trial-count", 1)),
    workers: Math.max(0, numberValue("worker-count", 0)),
    settings: {
      rapidFire: query("rapid-fire").checked,
      fleetDebris: numberValue("fleet-debris", currentUniverse.fleetDebris * 100) /
        100,
      defenseDebris:
        numberValue("defense-debris", currentUniverse.defenseDebris * 100) / 100,
      defenseRepair:
        numberValue("defense-repair", currentUniverse.defenseRepair * 100) / 100,
      deuteriumInDebris: currentUniverse.deuteriumInDebris,
      debrisCollector: debrisCollector(),
    },
    attackers: forces.attacker.map((force, index) => ({
      ...force,
      counts: combatCountsForScenario("attacker", force, index, speedProfile),
    })),
    defenders: forces.defender.map((force, index) => ({
      ...force,
      counts: combatCountsForScenario("defender", force, index, speedProfile),
    })),
  };
}

function workerCount(requested, trials) {
  if (requested > 0) {
    return Math.min(requested, trials);
  }
  return Math.min(
    Math.max(1, Math.ceil((navigator.hardwareConcurrency || 1) / 2)),
    trials,
  );
}

function splitTrials(trials, workers) {
  const base = Math.floor(trials / workers);
  const extra = trials % workers;
  return Array.from({ length: workers }, (_value, index) =>
    base + (index === workers - 1 ? extra : 0),
  ).filter((count) => count > 0);
}

function simulationRequest(scenario, chunkTrials, workerIndex) {
  return {
    trials: chunkTrials,
    seed: 1000003 * (workerIndex + 1),
    ships: shipCatalog,
    settings: scenario.settings,
    attackerForces: scenario.attackers.map((force) => ({
      tech: {
        ...force.tech,
        className: force.className,
        allianceClassName: force.allianceClassName,
        lifeforms: normalizeLifeforms(force.lifeforms),
      },
      counts: force.counts,
    })),
    defenderForces: scenario.defenders.map((force) => ({
      tech: {
        ...force.tech,
        className: force.className,
        allianceClassName: force.allianceClassName,
        lifeforms: normalizeLifeforms(force.lifeforms),
      },
      counts: force.counts,
    })),
  };
}

function sumResources(forceList) {
  return forceList.reduce(
    (total, force) => ({
      metal: total.metal + (force.resources?.metal || 0),
      crystal: total.crystal + (force.resources?.crystal || 0),
      deuterium: total.deuterium + (force.resources?.deuterium || 0),
    }),
    { metal: 0, crystal: 0, deuterium: 0 },
  );
}

function valueRows(values) {
  return [
    ["metal", "Metal", values.metal || 0],
    ["crystal", "Crystal", values.crystal || 0],
    ["deuterium", "Deuterium", values.deuterium || 0],
    ["msu", "MSU", metalStandardUnits(values)],
  ];
}

function resourceValues(counts, repairFactor = 0) {
  const values = { metal: 0, crystal: 0, deuterium: 0 };
  for (const ship of shipCatalog) {
    const repaired = defenseNames.has(ship.name) ? repairFactor : 0;
    const count = (counts[ship.index] || 0) * (1 - repaired);
    values.metal += count * ship.metal;
    values.crystal += count * ship.crystal;
    values.deuterium += count * ship.deuterium;
  }
  return values;
}

function debrisValues(losses, settings) {
  const values = { metal: 0, crystal: 0, deuterium: 0 };
  for (const ship of shipCatalog) {
    const factor = defenseNames.has(ship.name)
      ? settings.defenseDebris
      : settings.fleetDebris;
    values.metal += (losses[ship.index] || 0) * ship.metal * factor;
    values.crystal += (losses[ship.index] || 0) * ship.crystal * factor;
    if (settings.deuteriumInDebris) {
      values.deuterium += (losses[ship.index] || 0) * ship.deuterium * factor;
    }
  }
  return values;
}

function addValues(...items) {
  return items.reduce(
    (total, item) => ({
      metal: total.metal + (item.metal || 0),
      crystal: total.crystal + (item.crystal || 0),
      deuterium: total.deuterium + (item.deuterium || 0),
    }),
    { metal: 0, crystal: 0, deuterium: 0 },
  );
}

function negateValues(values) {
  return {
    metal: -(values.metal || 0),
    crystal: -(values.crystal || 0),
    deuterium: -(values.deuterium || 0),
  };
}

function scaleValues(values, scale) {
  return {
    metal: (values.metal || 0) * scale,
    crystal: (values.crystal || 0) * scale,
    deuterium: (values.deuterium || 0) * scale,
  };
}

function resourceValue(deuterium) {
  return { metal: 0, crystal: 0, deuterium };
}

function flightDistance(origin, target) {
  return serviceFlightDistance(origin, target, currentUniverse);
}

function forceFlightStats(force, targetCoords) {
  return serviceFleetFlightStats(
    webFleet(force),
    targetCoords,
    force.speed || 100,
    currentUniverse,
  );
}

function recyclerCapacity(force) {
  return serviceCargoCapacity(recyclerIndex, webFleet(force).player);
}

function forceRecyclerStats(force, targetCoords) {
  return serviceRecyclerFlightStats(
    webFleet(force),
    targetCoords,
    force.speed || 100,
    currentUniverse,
  );
}

function missionForces(scenario) {
  return scenario.settings.debrisCollector === "defender"
    ? scenario.defenders.slice(1)
    : scenario.attackers;
}

function missionSummary(scenario) {
  const targetCoords = scenario.defenders[0]?.coords || {
    galaxy: 1,
    system: 1,
    position: 16,
  };
  let attackDuration = 0;
  let attackFuel = 0;
  for (const force of scenario.attackers) {
    const stats = forceFlightStats(force, targetCoords);
    attackDuration = Math.max(attackDuration, stats.duration);
    attackFuel += stats.fuel;
  }
  let recyclerDuration = 0;
  let recyclerFuel = 0;
  for (const force of missionForces(scenario)) {
    const stats = forceRecyclerStats(force, targetCoords);
    recyclerDuration = Math.max(recyclerDuration, stats.duration);
    recyclerFuel += stats.fuel;
  }
  return {
    attackDuration,
    attackFuel,
    recyclerDuration,
    recyclerFuel,
  };
}

function formatDuration(seconds) {
  if (!seconds) {
    return "-";
  }
  const days = Math.floor(seconds / 86400);
  let remaining = seconds % 86400;
  const hours = Math.floor(remaining / 3600);
  remaining %= 3600;
  const minutes = Math.floor(remaining / 60);
  const finalSeconds = remaining % 60;
  const parts = [];
  if (days) {
    parts.push(`${days}d`);
  }
  if (hours || parts.length) {
    parts.push(`${hours}h`);
  }
  if (minutes || parts.length) {
    parts.push(`${minutes}m`);
  }
  parts.push(`${finalSeconds}s`);
  return parts.join(" ");
}

function renderResourceResult(tbody, losses, profit) {
  tbody.textContent = "";
  const profitRows = new Map(
    valueRows(profit).map(([key, _label, value]) => [key, value]),
  );
  for (const [name, label, lossValue] of valueRows(losses)) {
    const row = document.createElement("tr");
    const resourceCell = document.createElement("td");
    const lossCell = document.createElement("td");
    const profitCell = document.createElement("td");
    const profitValue = profitRows.get(name) || 0;
    resourceCell.append(resourceMarker(name, label));
    lossCell.textContent = formatCount(lossValue);
    profitCell.textContent = formatSigned(profitValue);
    profitCell.className = profitValue >= 0 ? "profit" : "loss";
    if (name === "msu") {
      row.className = "total";
    }
    row.append(resourceCell, lossCell, profitCell);
    tbody.append(row);
  }
}

function renderProfitBreakdown(tbody, rows) {
  tbody.textContent = "";
  for (const [label, values] of rows) {
    const row = document.createElement("tr");
    const labelCell = document.createElement("td");
    labelCell.textContent = label;
    row.append(labelCell);
    for (const [_key, _resourceLabel, value] of valueRows(values)) {
      const cell = document.createElement("td");
      cell.textContent = formatSigned(value);
      cell.className = value >= 0 ? "profit" : "loss";
      row.append(cell);
    }
    if (label === "Net profit") {
      row.className = "total";
    }
    tbody.append(row);
  }
}

function recyclerSummary(scenario, debris) {
  const debrisTotal = debris.metal + debris.crystal + debris.deuterium;
  let sentRecyclers = 0;
  let sentCapacity = 0;
  let bestCapacity = 20000;
  for (const force of missionForces(scenario)) {
    const capacity = recyclerCapacity(force);
    sentRecyclers += force.recyclers?.count || 0;
    sentCapacity += (force.recyclers?.count || 0) * capacity;
    bestCapacity = Math.max(bestCapacity, capacity);
  }
  return {
    needed: Math.ceil(debrisTotal / bestCapacity),
    sent: sentRecyclers,
    capacity: sentCapacity,
    missingCapacity: Math.max(0, debrisTotal - sentCapacity),
    insufficient: sentCapacity < debrisTotal,
  };
}

function effectiveCargoCapacity(ship, force) {
  return serviceCargoCapacity(ship.index, webFleet(force).player);
}

function plunderRequirementRows(scenario, missingCapacity) {
  return ["SMALL_CARGO", "LARGE_CARGO", "PATHFINDER"].map((shipName) => {
    const ship = shipCatalog.find((candidate) => candidate.name === shipName);
    return {
      ship,
      needed: Math.min(
        ...scenario.attackers.map((force) =>
          serviceCargoNeeded(
            missingCapacity,
            ship.index,
            webFleet(force).player,
          )
        ),
      ),
    };
  });
}

function plunderSummary(scenario, possibleLoot) {
  const neededCapacity = (
    possibleLoot.metal + possibleLoot.crystal + possibleLoot.deuterium
  );
  const sentCapacity = scenario.attackers.reduce(
    (capacity, force) =>
      capacity + serviceCargoCapacityTotal(force.counts, webFleet(force).player),
    0,
  );
  const missingCapacity = Math.max(0, neededCapacity - sentCapacity);
  return {
    needed: neededCapacity,
    sent: sentCapacity,
    requirements: plunderRequirementRows(scenario, missingCapacity),
    missingCapacity,
    insufficient: sentCapacity < neededCapacity,
  };
}

function shipSummaryLabel(ship) {
  const label = document.createElement("span");
  label.className = "summary-ship-label";
  label.append(shipIconElement(ship));
  label.append(document.createTextNode(ship.display_name));
  return label;
}

function shipIconLabel(ship) {
  const label = document.createElement("span");
  label.className = "summary-ship-label icon-only-label";
  label.title = ship.display_name;
  label.setAttribute("aria-label", ship.display_name);
  label.append(shipIconElement(ship));
  return label;
}

function resourceValueNode(values) {
  const container = document.createElement("span");
  container.className = "summary-resource-values";
  for (const [key, label, value] of valueRows(values).slice(0, 3)) {
    const item = document.createElement("span");
    item.className = "summary-resource-value";
    item.append(resourceMarker(key, label));
    item.append(document.createTextNode(formatCount(value)));
    container.append(item);
  }
  return container;
}

function resourceSummaryLabel(key, label) {
  const item = document.createElement("span");
  item.className = "summary-resource-label";
  item.append(resourceMarker(key, label));
  return item;
}

function statusGlyph(ok, title) {
  const glyph = document.createElement("span");
  glyph.className = ok ? "status-glyph status-ok" : "status-glyph status-warning";
  glyph.textContent = ok ? "✓" : "!";
  glyph.title = title;
  glyph.setAttribute("aria-label", title);
  return glyph;
}

function labelWithStatus(text, status) {
  const label = document.createElement("span");
  label.className = "label-with-status";
  label.append(document.createTextNode(text));
  label.append(status);
  return label;
}

function appendCollectionRow(
  tbody,
  label,
  value,
  status,
  className,
  showStatusCell = true,
) {
  const row = document.createElement("tr");
  const name = document.createElement("td");
  const amount = document.createElement("td");
  if (label instanceof Node) {
    name.append(label);
  } else {
    name.textContent = label;
  }
  if (value instanceof Node) {
    amount.append(value);
  } else {
    amount.textContent = typeof value === "number" ? formatCount(value) : value;
  }
  if (className) {
    row.className = className;
  }
  row.append(name, amount);
  if (showStatusCell) {
    const statusCell = document.createElement("td");
    statusCell.className = "collection-status-cell";
    if (status) {
      statusCell.append(status);
    }
    row.append(statusCell);
  }
  tbody.append(row);
  return row;
}

function appendPlunderRow(tbody, possible, requirement) {
  const row = document.createElement("tr");
  const possibleLabel = document.createElement("td");
  const possibleAmount = document.createElement("td");
  const requirementLabel = document.createElement("td");
  const requirementAmount = document.createElement("td");
  possibleLabel.append(resourceSummaryLabel(possible[0], possible[1]));
  possibleAmount.textContent = formatCount(possible[2]);
  requirementLabel.append(shipIconLabel(requirement.ship));
  requirementAmount.textContent = formatCount(requirement.needed);
  row.append(
    possibleLabel,
    possibleAmount,
    requirementLabel,
    requirementAmount,
  );
  tbody.append(row);
}

function renderDebrisResults(debris, recyclers) {
  const tbody = query("planet-results");
  const className = recyclers.insufficient
    ? "collection-warning"
    : "collection-ok";
  const statusTitle = recyclers.insufficient
    ? `Sent recyclers are short by ${formatCount(recyclers.missingCapacity)} capacity.`
    : "Sent recyclers can collect the expected debris field.";
  tbody.textContent = "";
  for (const [key, label, value] of valueRows(debris).slice(0, 3)) {
    appendCollectionRow(
      tbody,
      resourceSummaryLabel(key, label),
      value,
      null,
      "",
      false,
    );
  }
  appendCollectionRow(
    tbody,
    "Recyclers needed",
    recyclers.needed,
    null,
    className,
    false,
  );
  appendCollectionRow(
    tbody,
    labelWithStatus(
      "Recyclers sent",
      statusGlyph(!recyclers.insufficient, statusTitle),
    ),
    recyclers.sent,
    null,
    className,
    false,
  );
}

function renderPlunderResults(possibleLoot, plunder) {
  const plunderTbody = query("plunder-results");
  const capacityTbody = query("plunder-capacity-results");
  const className = plunder.insufficient
    ? "collection-warning"
    : "collection-ok";
  const statusTitle = plunder.insufficient
    ? `Current attacking cargo capacity is short by ${formatCount(plunder.missingCapacity)} for max possible plunder.`
    : "Current attacking cargo capacity can carry the max possible plunder.";
  const possibleRows = valueRows(possibleLoot).slice(0, 3);
  plunderTbody.textContent = "";
  capacityTbody.textContent = "";
  for (let index = 0; index < possibleRows.length; index++) {
    appendPlunderRow(plunderTbody, possibleRows[index], plunder.requirements[index]);
  }
  appendCollectionRow(
    capacityTbody,
    "Current capacity",
    plunder.sent,
    statusGlyph(!plunder.insufficient, statusTitle),
    className,
  );
}

function lossCounts(original, meanSurvivors) {
  return original.map((count, index) => Math.max(0, count - meanSurvivors[index]));
}

function clearRemaining() {
  for (const row of document.querySelectorAll(".ship-row")) {
    row.classList.remove("survivor-row-expanded");
  }
  for (const element of document.querySelectorAll(
    "[data-remaining-mean-index], [data-remaining-range-index]",
  )) {
    element.textContent = "";
    element.removeAttribute("title");
  }
}

function hasSurvivorStats(stats, index) {
  return (
    (stats.low[index] || 0) !== 0 ||
    (stats.mean[index] || 0) !== 0 ||
    (stats.high[index] || 0) !== 0
  );
}

function survivorResultText(stats, original, index) {
  const low = stats.low[index] || 0;
  const mean = stats.mean[index] || 0;
  const high = stats.high[index] || 0;
  if (!hasSurvivorDisplay(stats, original, index)) {
    return "";
  }
  if (Math.abs(low - high) < 1e-9) {
    return `${formatCount(mean)}; ${formatCount(low)}`;
  }
  return `${formatCount(mean)}; ${formatCount(low)} ~ ${formatCount(high)}`;
}

function renderRemaining(container, stats, original) {
  for (const element of container.querySelectorAll("[data-remaining-mean-index]")) {
    const index = Number(element.dataset.remainingMeanIndex);
    const text = survivorMeanText(stats, original, index);
    element.textContent = text;
    if (text) {
      element.title = `Mean survivors: ${survivorResultText(stats, original, index)}`;
    } else {
      element.removeAttribute("title");
    }
  }
  for (const element of container.querySelectorAll("[data-remaining-range-index]")) {
    const index = Number(element.dataset.remainingRangeIndex);
    const text = survivorRangeText(stats, original, index);
    element.textContent = text;
    if (text) {
      element.title = `Survivor range: ${survivorResultText(stats, original, index)}`;
    } else {
      element.removeAttribute("title");
    }
  }
}

function hasSurvivorDisplay(stats, original, index) {
  return (original[index] || 0) !== 0 || hasSurvivorStats(stats, index);
}

function survivorRangeText(stats, original, index) {
  if (!hasSurvivorDisplay(stats, original, index)) {
    return "";
  }
  return `${formatCount(stats.low[index] || 0)} ~ ` +
    `${formatCount(stats.high[index] || 0)}`;
}

function survivorMeanText(stats, original, index) {
  if (!hasSurvivorDisplay(stats, original, index)) {
    return "";
  }
  return `${formatCount(stats.mean[index] || 0)} ←`;
}

function syncSurvivorRowAlignment(
  attackerStats,
  defenderStats,
  originalAttackers,
  originalDefenders,
) {
  for (const ship of combatShips) {
    const expanded = hasSurvivorDisplay(
      attackerStats,
      originalAttackers,
      ship.index,
    ) || hasSurvivorDisplay(defenderStats, originalDefenders, ship.index);
    for (const side of ["attacker", "defender"]) {
      const row = query(`${side}-inputs`)
        .querySelector(`[data-ship-index="${ship.index}"]`);
      if (row) {
        row.classList.toggle("survivor-row-expanded", expanded);
      }
    }
  }
}

function syncDefenseSurvivorRows(defenderStats, originalDefenders) {
  for (const ship of planetUnits) {
    const row = query("defense-inputs")
      .querySelector(`[data-ship-index="${ship.index}"]`);
    if (row) {
      row.classList.toggle(
        "survivor-row-expanded",
        hasSurvivorDisplay(defenderStats, originalDefenders, ship.index),
      );
    }
  }
}

function originalForceCounts(result, side, index) {
  const key = side === "attacker"
    ? "originalAttackerForces"
    : "originalDefenderForces";
  const aggregateKey = side === "attacker"
    ? "originalAttackers"
    : "originalDefenders";
  return result[key]?.[index] || result[aggregateKey];
}

function activeSurvivorStats(result, side) {
  const original = originalForceCounts(result, side, activeForce[side]);
  const key = side === "attacker"
    ? "attackerForceSurvivorStats"
    : "defenderForceSurvivorStats";
  const aggregateKey = side === "attacker"
    ? "attackerSurvivorStats"
    : "defenderSurvivorStats";
  return {
    original,
    stats: result[key]?.[activeForce[side]] || result[aggregateKey],
  };
}

function renderActiveRemaining(result) {
  const attacker = activeSurvivorStats(result, "attacker");
  const defender = activeSurvivorStats(result, "defender");
  renderRemaining(query("attacker-inputs"), attacker.stats, attacker.original);
  renderRemaining(query("defender-inputs"), defender.stats, defender.original);
  renderRemaining(query("defense-inputs"), defender.stats, defender.original);
  syncSurvivorRowAlignment(
    attacker.stats,
    defender.stats,
    attacker.original,
    defender.original,
  );
  syncDefenseSurvivorRows(defender.stats, defender.original);
}

function roundSummary(rounds) {
  if (!rounds) {
    return "";
  }
  const mean = rounds.mean.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (rounds.low === rounds.high) {
    return mean;
  }
  return `${mean} (${rounds.low}-${rounds.high})`;
}

function formatMissionTiming(rows) {
  if (!rows.length) {
    return "-";
  }
  return rows
    .map(([label, duration]) => `${label}: ${formatDuration(duration)}`)
    .join("\n");
}

function formatMissionFuel(rows) {
  if (!rows.length) {
    return "-";
  }
  return rows
    .map(([label, _duration, fuel]) => `${label}: ${formatCount(fuel)}`)
    .join("\n");
}

function renderMissionLines(attackerRows, defenderRows) {
  query("attacker-flight-time").textContent = formatMissionTiming(attackerRows);
  query("attacker-fuel").textContent = formatMissionFuel(attackerRows);
  query("defender-flight-time").textContent = formatMissionTiming(defenderRows);
  query("defender-fuel").textContent = formatMissionFuel(defenderRows);
}

function clearMissionLines() {
  for (const id of [
    "attacker-flight-time",
    "attacker-fuel",
    "defender-flight-time",
    "defender-fuel",
  ]) {
    query(id).textContent = "-";
  }
}

function clearResultDisplay() {
  for (const id of [
    "attacker-win",
    "defender-win",
    "draw-rate",
    "rounds-result",
    "mode-result",
  ]) {
    query(id).textContent = "";
  }
  for (const id of [
    "attacker-profit-results",
    "defender-profit-results",
    "attacker-breakdown-results",
    "defender-breakdown-results",
    "planet-results",
    "plunder-results",
    "plunder-capacity-results",
  ]) {
    query(id).textContent = "";
  }
  renderOptimizerResult(null);
  clearRemaining();
  clearMissionLines();
  clearTimingLine();
  query("results").hidden = true;
}

function invalidateResultDisplay() {
  const hadResult = lastResult || !query("results").hidden;
  lastResult = null;
  if (hadResult) {
    clearResultDisplay();
  }
}

function appendSummaryRow(tbody, label, value) {
  const row = document.createElement("tr");
  const labelCell = document.createElement("td");
  const valueCell = document.createElement("td");
  labelCell.textContent = label;
  valueCell.textContent = value;
  row.append(labelCell, valueCell);
  tbody.append(row);
}

function renderOptimizerResult(optimization) {
  const tab = query("optimizer-result-tab");
  const summaryBody = query("optimizer-summary-results");
  const changeBody = query("optimizer-change-results");
  summaryBody.textContent = "";
  changeBody.textContent = "";
  if (!optimization) {
    tab.hidden = true;
    setResultTab("overview");
    return;
  }

  tab.hidden = false;
  appendSummaryRow(
    summaryBody,
    "Target",
    optimization.target === "attacker" ? "Attacker" : "Defender",
  );
  appendSummaryRow(summaryBody, "Action", optimization.action);
  appendSummaryRow(summaryBody, "Accepted steps", formatCount(optimization.steps));
  appendSummaryRow(
    summaryBody,
    "Baseline cost",
    `${formatCount(optimization.baselineCost)} MSU`,
  );
  appendSummaryRow(
    summaryBody,
    "Final cost",
    `${formatCount(optimization.finalCost)} MSU`,
  );

  let hasChanges = false;
  optimization.history.forEach((changes, stepIndex) => {
    for (const change of changes) {
      hasChanges = true;
      const row = document.createElement("tr");
      const stepCell = document.createElement("td");
      const actionCell = document.createElement("td");
      const shipCell = document.createElement("td");
      const countCell = document.createElement("td");
      const msuCell = document.createElement("td");
      stepCell.textContent = String(stepIndex + 1);
      actionCell.textContent = optimization.action;
      shipCell.textContent = change.displayName;
      countCell.textContent = formatCount(change.count);
      msuCell.textContent = formatCount(change.msu);
      row.append(stepCell, actionCell, shipCell, countCell, msuCell);
      changeBody.append(row);
    }
  });
  if (!hasChanges) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No accepted changes.";
    row.append(cell);
    changeBody.append(row);
  }
}

function renderResult(result) {
  const attackerStats = result.attackerSurvivorStats;
  const defenderStats = result.defenderSurvivorStats;
  const attackerLossCounts = lossCounts(result.originalAttackers, attackerStats.mean);
  const defenderLossCounts = lossCounts(result.originalDefenders, defenderStats.mean);
  const attackerLosses = resourceValues(attackerLossCounts);
  const defenderLosses = resourceValues(
    defenderLossCounts,
    result.scenario.settings.defenseRepair,
  );
  const debris = debrisValues(
    attackerLossCounts.map((count, index) => count + defenderLossCounts[index]),
    result.scenario.settings,
  );
  const possibleLoot = scaleValues(
    sumResources(result.scenario.defenders),
    result.scenario.lootPercent / 100,
  );
  const loot = scaleValues(possibleLoot, result.attackerWinRate);
  const collector = result.scenario.settings.debrisCollector;
  const attackerDebris = collector === "attacker"
    ? debris
    : { metal: 0, crystal: 0, deuterium: 0 };
  const defenderDebris = collector === "defender"
    ? debris
    : { metal: 0, crystal: 0, deuterium: 0 };
  const mission = missionSummary(result.scenario);
  const attackerFuel = resourceValue(
    mission.attackFuel + (collector === "attacker" ? mission.recyclerFuel : 0),
  );
  const defenderFuel = resourceValue(
    collector === "defender" ? mission.recyclerFuel : 0,
  );
  const attackerProfit = addValues(
    loot,
    attackerDebris,
    negateValues(attackerLosses),
    negateValues(attackerFuel),
  );
  const defenderProfit = addValues(
    defenderDebris,
    negateValues(defenderLosses),
    negateValues(loot),
    negateValues(defenderFuel),
  );
  const recyclers = recyclerSummary(result.scenario, debris);
  const plunder = plunderSummary(result.scenario, possibleLoot);
  const attackerMissionRows = [["Attack", mission.attackDuration, mission.attackFuel]];
  const defenderMissionRows = [];
  if (mission.recyclerFuel || mission.recyclerDuration) {
    if (collector === "defender") {
      defenderMissionRows.push([
        "Recycle",
        mission.recyclerDuration,
        mission.recyclerFuel,
      ]);
    } else {
      attackerMissionRows.push([
        "Recycle",
        mission.recyclerDuration,
        mission.recyclerFuel,
      ]);
    }
  }
  const attackerBreakdownRows = [
    ["Plunder", loot],
    ["Debris", attackerDebris],
    ["Combat losses", negateValues(attackerLosses)],
    ["Attack fuel", resourceValue(-mission.attackFuel)],
  ];
  if (collector === "attacker" && (mission.recyclerFuel || mission.recyclerDuration)) {
    attackerBreakdownRows.push([
      "Recycler fuel",
      resourceValue(-mission.recyclerFuel),
    ]);
  }
  attackerBreakdownRows.push(["Net profit", attackerProfit]);
  const defenderBreakdownRows = [
    ["Plunder", negateValues(loot)],
    ["Debris", defenderDebris],
    ["Combat losses", negateValues(defenderLosses)],
  ];
  if (collector === "defender" && (mission.recyclerFuel || mission.recyclerDuration)) {
    defenderBreakdownRows.push([
      "Recycler fuel",
      resourceValue(-mission.recyclerFuel),
    ]);
  }
  defenderBreakdownRows.push(["Net profit", defenderProfit]);

  query("attacker-win").textContent = `${(100 * result.attackerWinRate).toFixed(1)}%`;
  query("defender-win").textContent = `${(100 * result.defenderWinRate).toFixed(1)}%`;
  query("draw-rate").textContent = `${(100 * result.drawRate).toFixed(1)}%`;
  query("rounds-result").textContent = roundSummary(result.rounds);
  query("mode-result").textContent = modeLabel(result.scenario.mode);
  renderResourceResult(
    query("attacker-profit-results"),
    addValues(attackerLosses, attackerFuel),
    attackerProfit,
  );
  renderResourceResult(
    query("defender-profit-results"),
    addValues(defenderLosses, defenderFuel, loot),
    defenderProfit,
  );
  renderMissionLines(attackerMissionRows, defenderMissionRows);
  renderProfitBreakdown(
    query("attacker-breakdown-results"),
    attackerBreakdownRows,
  );
  renderProfitBreakdown(
    query("defender-breakdown-results"),
    defenderBreakdownRows,
  );
  renderDebrisResults(debris, recyclers);
  renderPlunderResults(possibleLoot, plunder);
  renderOptimizerResult(result.optimization || null);
  renderActiveRemaining(result);
  query("results").hidden = false;
}

function modeLabel(value) {
  return {
    simulate: "Simulate",
    "optimize-profit": "Optimize Profit",
  }[value] || value;
}

function setRunDisabled(disabled) {
  query("run-button").disabled = disabled;
}

async function runSimulation() {
  const startedAt = performance.now();
  setRunDisabled(true);
  clearResultDisplay();
  const baseScenario = scenarioForSimulation();
  const optimized = await optimizeScenario(baseScenario);
  applyOptimizedScenario(optimized.scenario, optimized.optimization);
  const scenario = optimized.scenario;
  const workers = workerCount(scenario.workers, scenario.trials);
  const chunks = splitTrials(scenario.trials, workers);
  const stats = emptySimulationStats();
  let workerMs = 0;
  let slowestWorkerMs = 0;

  query("status").value = `Running ${scenario.trials} simulations on ${chunks.length} workers`;

  await Promise.all(
    chunks.map(
      (chunkTrials, workerIndex) =>
        new Promise((resolve, reject) => {
          const worker = new Worker("worker.js?v=20260618-localassets1", {
            type: "module",
          });
          worker.onmessage = (event) => {
            const workerElapsedMs = event.data.elapsedMs || 0;
            workerMs += workerElapsedMs;
            slowestWorkerMs = Math.max(slowestWorkerMs, workerElapsedMs);
            addWorkerResult(stats, event.data);
            query("status").value =
              `${stats.completed} / ${scenario.trials} simulations`;
            worker.terminate();
            resolve();
          };
          worker.onerror = (event) => {
            worker.terminate();
            reject(event.error || event.message);
          };
          worker.postMessage(simulationRequest(scenario, chunkTrials, workerIndex));
        }),
    ),
  );

  const elapsedMs = performance.now() - startedAt;
  lastResult = resultFromSimulationStats(
    scenario,
    stats,
    {
      elapsedMs,
      workerMs,
      slowestWorkerMs,
      trials: scenario.trials,
      workers: chunks.length,
      chunks,
    },
  );
  lastResult.optimization = optimized.optimization;
  renderResult(lastResult);
  lastResult.timing.elapsedMs = performance.now() - startedAt;
  renderTimingLine(lastResult.timing);
  query("status").value = timingLineText(lastResult.timing);
  setRunDisabled(false);
}

function setResultTab(tab) {
  for (const item of document.querySelectorAll("[data-result-tab]")) {
    item.classList.toggle("active", item.dataset.resultTab === tab);
  }
  for (const view of document.querySelectorAll("[data-result-view]")) {
    const active = view.dataset.resultView === tab;
    view.hidden = !active;
    view.classList.toggle("active", active);
  }
}

function initialize() {
  decorateChoiceIcons();
  decorateTechIcons();
  decorateResourceHeaders();
  renderCountInputs(query("attacker-inputs"), combatShips);
  renderCountInputs(query("defender-inputs"), combatShips);
  renderCountInputs(query("defense-inputs"), planetUnits);
  applyLinkParams();
  renderTabs("attacker");
  renderTabs("defender");
  loadActiveForce("attacker");
  loadActiveForce("defender");
  refreshProfileUsage();
  clearResultDisplay();

  for (const side of ["attacker", "defender"]) {
    query(`load-${side}-sr`).addEventListener("click", () => {
      loadSrInto(side).catch((error) => {
        query("status").value = String(error.message || error);
      });
    });
    query(`load-${side}-json`).addEventListener("click", () => {
      try {
        loadPastedReportInto(side);
      } catch (error) {
        query("status").value = String(error.message || error);
      }
    });
    query(`remove-${side}`).addEventListener("click", () => removeActiveForce(side));
    query(`clear-${side}`).addEventListener("click", () => clearSide(side));
    query(`clear-${side}-ships`).addEventListener("click", () => clearSide(side, true));
  }

  for (const section of [
    query("simulate-form"),
    document.querySelector(".command-strip"),
  ].filter(Boolean)) {
    section.addEventListener("input", (event) => {
      invalidateResultDisplay();
      if (event.target && query("defense-inputs").contains(event.target)) {
        syncDefensePanelOpen();
      }
    });
    section.addEventListener("change", (event) => {
      invalidateResultDisplay();
      if (event.target?.name === "debris-collector") {
        refreshRecyclerRows();
        refreshProfileUsage();
      }
      if (event.target && query("defense-inputs").contains(event.target)) {
        syncDefensePanelOpen();
      }
    });
  }
  query("optimizer-speed").addEventListener("change", () => {
    refreshProfileUsage();
    invalidateResultDisplay();
  });
  for (const button of document.querySelectorAll(".class-buttons button")) {
    button.addEventListener("click", () => {
      for (const sibling of button.parentElement.querySelectorAll("button")) {
        sibling.classList.toggle("selected", sibling === button);
      }
      invalidateResultDisplay();
    });
  }
  for (const item of document.querySelectorAll("[data-result-tab]")) {
    item.addEventListener("click", () => setResultTab(item.dataset.resultTab));
  }
  query("run-button").addEventListener("click", () => {
    runSimulation().catch((error) => {
      query("status").value = String(error.message || error);
      setRunDisabled(false);
    });
  });
}

initialize();
