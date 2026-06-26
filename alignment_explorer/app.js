const state = {
  data: null,
  results: null,
  group: null,
  tab: "examples",
  model: "all",
  query: "",
  traceIndex: 0,
  traceModel: null,
  examplePools: new Map(),
  exampleSamples: new Map(),
  traceCases: new Map(),
};

const PROGRESS_CHART_MAX_POINTS = 260;

const colorList = [
  "#1f7a72",
  "#395f8f",
  "#936f1d",
  "#a84848",
  "#4f7f3f",
  "#75539b",
  "#8a5f2a",
  "#a33f6b",
  "#315f56",
  "#554f47",
];

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[char]));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatScore(value) {
  return value === null || value === undefined ? "-" : value.toFixed(3);
}

function groupColor(groupIndex) {
  if (groupIndex < 0) {
    return "#6f6f6f";
  }
  return colorList[groupIndex % colorList.length];
}

function activeGroup() {
  return state.data.groups.find((group) => group.group === state.group);
}

function groupMap() {
  return new Map(state.data.groups.map((group) => [group.group, group]));
}

function visibleGroups() {
  const query = state.query.trim().toLowerCase();
  return state.data.groups.filter((group) => {
    const text = [
      group.title,
      group.description,
      ...group.dimensions.map((dimension) => dimension.title),
    ].join(" ").toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesModel =
      state.model === "all"
      || group.dimensions.some((dimension) => dimension.model === state.model);
    return matchesQuery && matchesModel;
  });
}

function renderMetrics() {
  $("#dataset-note").textContent =
    `${state.data.version} · ${state.data.summary.groups} groups`;
  $("#metric-groups").textContent = `${state.data.summary.groups} groups`;
  $("#metric-annotations").textContent =
    `${formatNumber(state.data.summary.annotations)} annotations`;
  $("#metric-weighting").textContent =
    `${state.data.summary.pair_weighting} matching`;
}

function renderResults() {
  $("#results-title").textContent = state.results.title;
  $("#results-summary").textContent = state.results.summary;
  $("#results-grid").innerHTML = state.results.rows.map((row) => `
    <article class="result-card ${row.promoted ? "selected" : ""}">
      <div>
        <strong>${escapeHtml(row.label)}</strong>
        <span>${escapeHtml(row.status)}</span>
      </div>
      <dl>
        <div>
          <dt>All-score F1</dt>
          <dd>${formatScore(row.all_score_f1)}</dd>
        </div>
        <div>
          <dt>Push/pull</dt>
          <dd>${formatScore(row.bounded_push_pull)}</dd>
        </div>
        <div>
          <dt>Coverage</dt>
          <dd>${escapeHtml(row.coverage)}</dd>
        </div>
      </dl>
      <p>${escapeHtml(row.note)}</p>
    </article>
  `).join("");
  $("#results-note").textContent = state.results.note;
}

function renderControls() {
  const select = $("#model-select");
  select.innerHTML = [
    `<option value="all">All models</option>`,
    ...state.data.models.map(
      (model) => `<option value="${model.id}">${model.name}</option>`,
    ),
  ].join("");
  select.value = state.model;
}

function renderGroupList() {
  const list = $("#group-list");
  list.innerHTML = visibleGroups().map((group) => `
    <button
      class="group-button ${group.group === state.group ? "selected" : ""}"
      type="button"
      data-group="${group.group}"
    >
      <span class="step-badge">${
        group.reserved ? "D" : String(group.step).padStart(2, "0")
      }</span>
      <span>
        <span class="group-name">${group.title}</span>
        <span class="group-meta">${
          group.reserved
            ? "reserved transition state"
            : `${group.dimensions.length} dimensions`
        }</span>
      </span>
      <span class="group-meta">${formatNumber(group.count)}</span>
    </button>
  `).join("");
  list.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.group = Number(button.dataset.group);
      render();
    });
  });
}

function renderModelBars(group) {
  const maxCount = Math.max(...Object.values(group.model_counts));
  $("#model-bars").innerHTML = state.data.models.map((model) => {
    const count = group.model_counts[model.id] || 0;
    const width = maxCount ? (count / maxCount) * 100 : 0;
    return `
      <div class="model-bar">
        <strong>${model.name}</strong>
        <span class="bar-track">
          <span class="bar-fill" style="width: ${width}%"></span>
        </span>
        <span>${formatNumber(count)}</span>
      </div>
    `;
  }).join("");
}

function examplePoolKey(group, model) {
  return `${group.group}|${model}`;
}

function exampleModels(group) {
  return state.data.models
    .filter((model) => state.model === "all" || state.model === model.id)
    .filter((model) => group.examples[model.id]);
}

function examplesForGroup(group) {
  const examples = [];
  for (const model of exampleModels(group)) {
    const key = examplePoolKey(group, model.id);
    const modelExamples =
      state.exampleSamples.get(key) || group.examples[model.id].sample || [];
    for (const example of modelExamples) {
      examples.push(example);
    }
  }
  return examples;
}

function sampleExamples(rows, count) {
  const pool = [...rows];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, count);
}

async function loadExamplePool(group, model) {
  const key = examplePoolKey(group, model.id);
  if (!state.examplePools.has(key)) {
    const response = await fetch(`${group.examples[model.id].path}?v=20260616-3`);
    state.examplePools.set(key, await response.json());
  }
  return state.examplePools.get(key);
}

async function resampleExamples(group) {
  const button = $("#resample-examples");
  button.disabled = true;
  button.textContent = "Sampling";
  try {
    for (const model of exampleModels(group)) {
      const pool = await loadExamplePool(group, model);
      state.exampleSamples.set(
        examplePoolKey(group, model.id),
        sampleExamples(pool, 8),
      );
    }
    renderExamples(group);
  } finally {
    const currentButton = $("#resample-examples");
    if (currentButton) {
      currentButton.disabled = false;
      currentButton.textContent = "Resample";
    }
  }
}

function renderExamples(group) {
  const examples = examplesForGroup(group);
  $("#panel-examples").innerHTML = `
    <div class="example-toolbar">
      <button id="resample-examples" type="button">Resample</button>
      <span>${formatNumber(examples.length)} shown</span>
    </div>
    <div class="example-grid">
      ${examples.map((example) => `
        <article class="example-card">
          <h3>${
            example.is_degenerate
              ? `${escapeHtml(example.model_short)} · degenerate`
              : `${escapeHtml(example.model_short)} · d${example.dimension}`
          }</h3>
          <p>${escapeHtml(example.text)}</p>
        </article>
      `).join("")}
    </div>
  `;
  $("#resample-examples").addEventListener("click", () => {
    resampleExamples(group);
  });
}

function renderDimensions(group) {
  if (group.reserved) {
    $("#panel-dimensions").innerHTML = `
      <div class="empty-panel">
        Reserved projection state. No activation dimensions are assigned here.
      </div>
    `;
    return;
  }
  $("#panel-dimensions").innerHTML = `
    <div class="dimension-table">
      ${group.dimensions.map((dimension) => `
        <article class="dimension-row">
          <div>
            <strong>${escapeHtml(dimension.model_short)}</strong>
            <p>d${dimension.dimension}</p>
          </div>
          <div>
            <span class="role role-${dimension.role}">
              ${dimension.role}
            </span>
            <p>${dimension.centrality.toFixed(3)}</p>
          </div>
          <div>
            <p class="dimension-title">${escapeHtml(dimension.title)}</p>
            <p class="dimension-description">${escapeHtml(dimension.description)}</p>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderTraceControls() {
  const caseSelect = $("#case-select");
  caseSelect.innerHTML = state.data.traces.map((trace, index) => {
    const count = trace.counts[state.traceModel] || trace.count;
    return `
      <option value="${index}">
        ${trace.pmcid.slice(0, 8)} · q${trace.question_id} · ${formatNumber(count)} rows
      </option>
    `;
  }).join("");
  caseSelect.value = String(state.traceIndex);

  $("#model-tabs").innerHTML = state.data.models.map((model) => `
    <button
      class="${state.traceModel === model.id ? "selected" : ""}"
      type="button"
      data-model="${model.id}"
    >
      ${model.name}
    </button>
  `).join("");
  $("#model-tabs").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.traceModel = button.dataset.model;
      renderTraces(activeGroup());
    });
  });
}

function renderTraceRail(rows) {
  $("#trace-rail").innerHTML = rows.map((row) => `
    <span
      class="rail-segment"
      title="group ${row.group}"
      style="background: ${groupColor(row.group)}"
    ></span>
  `).join("");
}

async function loadTraceCase(index) {
  const trace = state.data.traces[index];
  if (!state.traceCases.has(trace.id)) {
    const response = await fetch(`${trace.path}?v=20260626-9`);
    state.traceCases.set(trace.id, await response.json());
  }
  return state.traceCases.get(trace.id);
}

function normalizedDistribution(values) {
  const output = values.map((value) => Math.max(0, Number(value)));
  const total = output.reduce((sum, value) => sum + value, 0);
  if (!total) {
    return output.map(() => 1 / output.length);
  }
  return output.map((value) => value / total);
}

function progressTransitionDistribution(previousDistribution, traceLength) {
  const binCount = previousDistribution.length;
  const bandwidth = state.data.progress_prior_bandwidth || 2.0;
  const expectedStep = (binCount - 1) / Math.max(traceLength - 1, 1);
  const distribution = Array.from({length: binCount}, () => 0);
  previousDistribution.forEach((sourceMass, sourceIndex) => {
    const center = Math.min(binCount - 1, sourceIndex + expectedStep);
    const weights = normalizedDistribution(
      distribution.map((_value, targetIndex) =>
        Math.exp(-Math.abs(targetIndex - center) / bandwidth),
      ),
    );
    weights.forEach((weight, targetIndex) => {
      distribution[targetIndex] += sourceMass * weight;
    });
  });
  return normalizedDistribution(distribution);
}

function hydrateTraceProgress(trace, model) {
  trace.progressModels ||= {};
  if (trace.progressModels[model]) {
    return;
  }
  const rows = trace.models[model] || [];
  const firstProgressModel = Object.values(
    state.data.dimension_progress_likelihood,
  )[0];
  const binCount = Object.values(firstProgressModel)[0].length;
  let previousDistribution = null;
  rows.forEach((row) => {
    const stateLikelihood = row.is_degenerate
      ? state.data.degenerate_progress_likelihood[model]
      : state.data.dimension_progress_likelihood[model][
        String(row.dimension)
      ];
    const priorDistribution = previousDistribution === null
      ? [1, ...Array.from({length: binCount - 1}, () => 0)]
      : progressTransitionDistribution(previousDistribution, rows.length);
    row.progress_distribution = normalizedDistribution(
      priorDistribution.map((prior, index) => prior * stateLikelihood[index]),
    );
    previousDistribution = row.progress_distribution;
  });
  trace.progressModels[model] = true;
}

async function renderTraces(group) {
  renderTraceControls();
  const traceIndex = state.traceIndex;
  $("#trace-meta").textContent = "Loading trace";
  $("#trace-progress-plot").innerHTML = "";
  $("#trace-rail").innerHTML = "";
  $("#trace-list").innerHTML = `
    <li class="trace-row">
      <span class="trace-index">-</span>
      <div>
        <p class="trace-label">Loading trace</p>
      </div>
    </li>
  `;
  const trace = await loadTraceCase(traceIndex);
  if (traceIndex !== state.traceIndex || state.tab !== "traces") {
    return;
  }
  hydrateTraceProgress(trace, state.traceModel);
  const rows = trace.models[state.traceModel] || [];
  const groupByIndex = groupMap();
  $("#trace-meta").textContent =
    `${formatNumber(state.data.summary.traces)} complete cases · ${
      formatNumber(rows.length)
    } rows for ${state.data.models.find(
      (model) => model.id === state.traceModel,
    ).name}`;
  $("#trace-progress-plot").innerHTML = progressChartHtml(rows, groupByIndex);
  renderTraceRail(rows);
  $("#trace-list").innerHTML = rows.map((row, rowIndex) => {
    const rowGroup = groupByIndex.get(row.group);
    const labelSuffix = row.is_degenerate ? "degenerate" : `d${row.dimension}`;
    const distribution = Array.isArray(row.progress_distribution)
      ? row.progress_distribution
      : null;
    const progress = progressDistributionMean(distribution);
    const color = groupColor(row.group);
    return `
      <li
        class="trace-row ${row.group === group.group ? "active" : ""}"
        data-row-index="${rowIndex}"
      >
        <span class="trace-index">#${row.section}</span>
        <div>
          <p
            class="trace-label"
            style="color: ${color}"
          >
            ${escapeHtml(rowGroup ? rowGroup.title : `group ${row.group}`)} · ${labelSuffix}
          </p>
          <p>${escapeHtml(row.text)}</p>
        </div>
        <div class="trace-progress">
          <strong>${
            progress === null ? "no progress" : `${Math.round(progress * 100)}%`
          }</strong>
          ${progressDistributionBars(distribution, color)}
        </div>
      </li>
    `;
  }).join("");
}

function scrollToTraceRow(rowIndex) {
  const currentRow = $("#trace-list .trace-row.focused");
  if (currentRow) {
    currentRow.classList.remove("focused");
  }
  const row = $(`#trace-list .trace-row[data-row-index="${rowIndex}"]`);
  if (!row) {
    return;
  }
  row.classList.add("focused");
  row.scrollIntoView({block: "center", behavior: "smooth"});
}

function progressDistributionMean(distribution) {
  if (!distribution) {
    return null;
  }
  const total = distribution.reduce((sum, value) => sum + value, 0);
  if (!total) {
    return null;
  }
  return distribution.reduce(
    (sum, value, index) =>
      sum + value * ((index + 0.5) / distribution.length),
    0,
  ) / total;
}

function progressBinLabel(index, count) {
  const start = Math.round((index / count) * 100);
  const end = Math.round(((index + 1) / count) * 100);
  return `${start}-${end}%`;
}

function progressDistributionBars(distribution, color) {
  if (!distribution) {
    return `<span class="state-distribution empty"></span>`;
  }
  const maxMass = Math.max(...distribution, 0.001);
  return `
    <span class="state-distribution">
      ${distribution.map((mass, index) => `
        <i
          style="
            height: ${Math.max(8, (mass / maxMass) * 100)}%;
            background: ${color};
            opacity: ${Math.min(0.9, 0.18 + mass * 3.2)};
          "
          title="${progressBinLabel(index, distribution.length)}: ${
            Math.round(mass * 100)
          }%"
        ></i>
      `).join("")}
    </span>
  `;
}

function progressPoint(row, index, groupsByIndex) {
  const group = groupsByIndex.get(row.group);
  const distribution = Array.isArray(row.progress_distribution)
    ? row.progress_distribution
    : null;
  const progress = progressDistributionMean(distribution);
  return {distribution, group, index, progress, row};
}

function progressChartPoints(rows, groupsByIndex) {
  const step = Math.max(1, Math.ceil(rows.length / PROGRESS_CHART_MAX_POINTS));
  const points = rows.flatMap((row, index) =>
    index % step === 0 ? [progressPoint(row, index, groupsByIndex)] : [],
  );
  if (rows.length > 0 && (rows.length - 1) % step !== 0) {
    points.push(
      progressPoint(rows[rows.length - 1], rows.length - 1, groupsByIndex),
    );
  }
  return points;
}

function progressChartHtml(rows, groupsByIndex) {
  const width = 920;
  const height = 330;
  const left = 44;
  const right = 16;
  const top = 16;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxIndex = Math.max(rows.length - 1, 1);
  const x = (point) => left + (point.index / maxIndex) * plotWidth;
  const y = (progress) => top + (1 - progress) * plotHeight;
  const points = progressChartPoints(rows, groupsByIndex);
  const semanticPoints = points.filter((point) => point.progress !== null);
  const pointWidth = Math.max(
    4,
    Math.min(12, (plotWidth / Math.max(points.length, 1)) * 0.7),
  );
  const line = semanticPoints.map((point) =>
    `${x(point).toFixed(1)},${y(point.progress).toFixed(1)}`
  ).join(" ");
  const sampled = points.length < rows.length
    ? `<span>${formatNumber(points.length)} charted rows</span>`
    : "";
  return `
    <svg class="progress-chart" viewBox="0 0 ${width} ${height}" role="img">
      <g class="progress-grid">
        ${[0, 0.25, 0.5, 0.75, 1].map((value) => `
          <line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}"></line>
          <text x="8" y="${y(value) + 4}">${Math.round(value * 100)}%</text>
        `).join("")}
      </g>
      <polyline class="progress-position" points="${left},${height - bottom} ${width - right},${top}"></polyline>
      ${points.map((point) => {
        if (!point.distribution) {
          return "";
        }
        const color = groupColor(point.row.group);
        const rowGroup = point.group;
        const title = rowGroup ? rowGroup.title : "No-information";
        return point.distribution.map((mass, binIndex) => {
          const binStart = binIndex / point.distribution.length;
          const binEnd = (binIndex + 1) / point.distribution.length;
          return `
            <rect
              class="progress-mass"
              x="${(x(point) - pointWidth / 2).toFixed(1)}"
              y="${y(binEnd).toFixed(1)}"
              width="${pointWidth.toFixed(1)}"
              height="${Math.max(1, y(binStart) - y(binEnd)).toFixed(1)}"
              fill="${color}"
              opacity="${Math.min(0.72, 0.05 + mass * 3.4).toFixed(3)}"
            >
              <title>#${point.row.section} · ${escapeHtml(title)} · ${
                progressBinLabel(binIndex, point.distribution.length)
              }: ${Math.round(mass * 100)}%</title>
            </rect>
          `;
        }).join("");
      }).join("")}
      <polyline class="progress-line" points="${line}"></polyline>
      ${points.map((point) => {
        const progress = point.progress === null ? 0 : point.progress;
        const rowGroup = point.group;
        const color = groupColor(point.row.group);
        const title = rowGroup ? rowGroup.title : "No-information";
        const className = point.progress === null ? " degenerate" : "";
        return `
          <circle
            class="progress-dot${className}"
            cx="${x(point).toFixed(1)}"
            cy="${y(progress).toFixed(1)}"
            r="${point.progress === null ? 3 : 4.5}"
            fill="${color}"
          >
            <title>#${point.row.section} · ${escapeHtml(title)} · ${
              point.progress === null
                ? "no progress"
                : `${Math.round(point.progress * 100)}%`
            }</title>
          </circle>
        `;
      }).join("")}
      ${points.map((point) => {
        const hitWidth = Math.max(8, pointWidth);
        const rowGroup = point.group;
        const title = rowGroup ? rowGroup.title : "No-information";
        return `
          <rect
            class="progress-hitbox"
            data-row-index="${point.index}"
            x="${(x(point) - hitWidth / 2).toFixed(1)}"
            y="${top}"
            width="${hitWidth.toFixed(1)}"
            height="${plotHeight}"
          >
            <title>#${point.row.section} · ${escapeHtml(title)}</title>
          </rect>
        `;
      }).join("")}
      <text class="axis-label" x="${width / 2}" y="${height - 6}">sentence order</text>
    </svg>
    <div class="progress-legend">
      <span><i class="legend-line"></i>estimated progress</span>
      <span><i class="legend-mass"></i>phase distribution</span>
      <span><i class="legend-position"></i>sentence position</span>
      <span><i class="legend-dot"></i>no-information row</span>
      ${sampled}
    </div>
  `;
}

function renderPanels(group) {
  $("#panel-examples").hidden = state.tab !== "examples";
  $("#panel-dimensions").hidden = state.tab !== "dimensions";
  $("#panel-traces").hidden = state.tab !== "traces";
  $("#tab-examples").classList.toggle("selected", state.tab === "examples");
  $("#tab-dimensions").classList.toggle("selected", state.tab === "dimensions");
  $("#tab-traces").classList.toggle("selected", state.tab === "traces");
  if (state.tab === "examples") {
    renderExamples(group);
  } else if (state.tab === "dimensions") {
    renderDimensions(group);
  } else if (state.tab === "traces") {
    renderTraces(group);
  }
}

function setTab(tab) {
  state.tab = tab;
  history.replaceState(null, "", `#${tab}`);
  renderPanels(activeGroup());
}

function renderDetail() {
  const group = activeGroup();
  $("#detail-step").textContent = group.fixed
    ? `Step ${String(group.step).padStart(2, "0")} · fixed anchor`
    : group.reserved
      ? "Reserved transition state"
      : `Step ${String(group.step).padStart(2, "0")}`;
  $("#detail-title").textContent = group.title;
  $("#detail-count").textContent = `${formatNumber(group.count)} rows`;
  $("#detail-description").textContent = group.description;
  renderModelBars(group);
  renderPanels(group);
}

function render() {
  renderMetrics();
  renderResults();
  renderControls();
  renderGroupList();
  renderDetail();
}

function bindEvents() {
  $("#search-input").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderGroupList();
  });
  $("#model-select").addEventListener("change", (event) => {
    state.model = event.target.value;
    render();
  });
  $("#tab-examples").addEventListener("click", () => {
    setTab("examples");
  });
  $("#tab-dimensions").addEventListener("click", () => {
    setTab("dimensions");
  });
  $("#tab-traces").addEventListener("click", () => {
    setTab("traces");
  });
  $("#case-select").addEventListener("change", (event) => {
    state.traceIndex = Number(event.target.value);
    renderTraces(activeGroup());
  });
  $("#trace-progress-plot").addEventListener("click", (event) => {
    const target = event.target.closest("[data-row-index]");
    if (target) {
      scrollToTraceRow(Number(target.dataset.rowIndex));
    }
  });
}

async function init() {
  const [dataResponse, resultsResponse] = await Promise.all([
    fetch("data.json?v=20260626-9"),
    fetch("results.json?v=20260616-3"),
  ]);
  state.data = await dataResponse.json();
  state.results = await resultsResponse.json();
  state.group = state.data.groups[0].group;
  state.traceModel = state.data.models[0].id;
  if (location.hash.slice(1) === "progress") {
    state.tab = "traces";
  } else if (["examples", "dimensions", "traces"].includes(location.hash.slice(1))) {
    state.tab = location.hash.slice(1);
  }
  bindEvents();
  render();
}

init();
