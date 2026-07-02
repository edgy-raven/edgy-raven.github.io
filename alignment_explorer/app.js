const state = {
  data: null,
  group: null,
  tab: "examples",
  traceIndex: 0,
  traceModel: null,
  progressMode: "model",
  exampleSamples: new Map(),
};

const PROGRESS_CHART_MAX_POINTS = 260;
const EXAMPLE_SAMPLE_SIZE = 8;
const EXAMPLE_TRACE_SCAN_LIMIT = 96;
const DATA_VERSION = "20260701-11";

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

const modelNames = {
  "deepseek-r1-distill-llama-8b": "Llama 8B",
  "deepseek-r1-distill-qwen-14b": "Qwen 14B",
  "gpt-oss-20b": "GPT OSS 20B",
  "huatuogpt-o1-8b": "Huatuo 8B",
  "qwq-32b": "QWQ 32B",
};

function normalizeData(data) {
  const models = data.models.map((model) => ({
    id: model,
    name: modelNames[model] || model,
  }));
  const dimensionsByModel = {};
  data.taxonomy.groups.flatMap((group) => group.dimension_labels)
    .forEach((dimension) => {
      dimensionsByModel[dimension.model] =
        dimensionsByModel[dimension.model] || [];
      dimensionsByModel[dimension.model].push({
        ...dimension,
        model_short: modelNames[dimension.model] || dimension.model,
      });
    });
  Object.values(dimensionsByModel).forEach((modelDimensions) => {
    modelDimensions.sort((left, right) => left.dimension - right.dimension);
  });
  const traces = data.traces.map((trace) => ({...trace, models: null}));
  traces.forEach((trace) => {
    trace.max_model_rows = Math.max(
      ...models.map((model) => trace.counts[model.id] || 0),
    );
  });
  const groups = data.taxonomy.groups.map((group, index) => {
    const examples = {};
    models.forEach((model) => {
      const modelExamples = group.examples[model.id];
      if (modelExamples && modelExamples.sample.length) {
        examples[model.id] = {
          count: modelExamples.count,
          sample: modelExamples.sample.map((row) =>
            cleanSentenceExample(row, model.name)
          ),
        };
      }
    });
    return {
      group: group.group_index,
      step: index + 1,
      color: groupColor(group.group_index),
      progress: {},
      title: group.title,
      description: group.description,
      fixed: false,
      count: group.count,
      model_counts: Object.fromEntries(
        models.map((model) => [
          model.id,
          group.model_counts[model.id] || 0,
        ]),
      ),
      dimensions: group.dimension_labels.map((dimension) => ({
        model: dimension.model,
        model_short: modelNames[dimension.model] || dimension.model,
        dimension: dimension.dimension,
        dimension_key: `${dimension.model}[${String(
          dimension.dimension,
        ).padStart(2, "0")}]`,
        progress: {},
        role: dimension.role || "supporting",
        weight: dimension.weight,
        title: dimension.title,
        description: dimension.description,
      })),
      examples,
    };
  });
  const traceOptions = Object.fromEntries(models.map((model) => [
    model.id,
    traces.map((trace, index) => `
      <option value="${index}">
        ${trace.pmcid.slice(0, 8)}${
          trace.question_id ? ` · q${trace.question_id}` : ""
        } · ${formatNumber(trace.counts[model.id] || trace.count)} rows
      </option>
    `).join(""),
  ]));
  return {
    version: "clean mean-leak taxonomy · 2026-07-01",
    method_name: "clean mean outside-group leak",
    pair_weighting: "mean outside-group leak",
    progress_prior_bandwidth: 2,
    models,
    groups,
    traces,
    trace_options: traceOptions,
    dimensions_by_model: dimensionsByModel,
    summary: data.summary,
  };
}

function cleanTraceRow(row) {
  return {
    section: row.section ?? row.sentence_index,
    text: row.text,
    group: row.group ?? row.group_index,
    dimension: row.dimension ?? null,
    is_degenerate: Boolean(
      row.is_degenerate || row.group < 0 || row.group_index < 0,
    ),
    model_progress: row.model_progress,
    unified_progress: row.unified_progress,
  };
}

function cleanSentenceExample(row, modelName) {
  return {
    model: row.model,
    model_short: modelName,
    text: row.text,
    dimension: null,
    score: null,
    case: row.case || row.pmcid,
    is_degenerate: false,
  };
}

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

function dimensionColor(dimension) {
  if (dimension === null || dimension < 0) {
    return "#6f6f6f";
  }
  return colorList[dimension % colorList.length];
}

function activeGroup() {
  return state.data.groups.find((group) => group.group === state.group);
}

function groupMap() {
  return new Map(state.data.groups.map((group) => [group.group, group]));
}

function modelDimensionMap(model) {
  return new Map(
    (state.data.dimensions_by_model[model] || []).map((dimension) => [
      dimension.dimension,
      dimension,
    ]),
  );
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

function renderGroupList() {
  const list = $("#group-list");
  list.innerHTML = state.data.groups.map((group) => `
    <button
      class="group-button ${group.group === state.group ? "selected" : ""}"
      type="button"
      data-group="${group.group}"
      style="--group-color: ${group.color}"
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

async function resampleExamples(group) {
  const button = $("#resample-examples");
  button.disabled = true;
  button.textContent = "Sampling";
  try {
    const models = exampleModels(group);
    const poolByModel = Object.fromEntries(
      models.map((model) => [model.id, []]),
    );
    const seenTraceIndexes = new Set();
    const traceLimit = Math.min(
      EXAMPLE_TRACE_SCAN_LIMIT,
      state.data.traces.length,
    );
    while (
      models.some(
        (model) => poolByModel[model.id].length < EXAMPLE_SAMPLE_SIZE,
      )
      && seenTraceIndexes.size < traceLimit
    ) {
      const traceIndex = Math.floor(Math.random() * state.data.traces.length);
      if (seenTraceIndexes.has(traceIndex)) {
        continue;
      }
      seenTraceIndexes.add(traceIndex);
      const trace = await loadTraceCase(traceIndex);
      button.textContent = `Sampling ${seenTraceIndexes.size}/${traceLimit}`;
      for (const model of models) {
        const rows = (trace.models[model.id] || []).filter(
          (row) => !row.is_degenerate && row.group === group.group,
        );
        poolByModel[model.id].push(
          ...sampleExamples(rows, EXAMPLE_SAMPLE_SIZE).map((row) => ({
            model: model.id,
            model_short: model.name,
            text: row.text,
            dimension: row.dimension,
            score: null,
            case: trace.pmcid,
            is_degenerate: false,
          })),
        );
      }
    }
    for (const model of models) {
      const fallback = group.examples[model.id].sample || [];
      state.exampleSamples.set(
        examplePoolKey(group, model.id),
        sampleExamples(
          poolByModel[model.id].length
            ? poolByModel[model.id]
            : fallback,
          Math.min(EXAMPLE_SAMPLE_SIZE, group.examples[model.id].count),
        ),
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
              : example.dimension === null || example.dimension === undefined
                ? escapeHtml(example.model_short)
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
            <p>${formatScore(dimension.weight)}</p>
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
  caseSelect.innerHTML = state.data.trace_options[state.traceModel] || "";
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

  $("#progress-tabs").innerHTML = [
    ["model", "Model Progress"],
    ["unified", "Unified Progress"],
  ].map(([mode, label]) => `
    <button
      class="${state.progressMode === mode ? "selected" : ""}"
      type="button"
      data-progress-mode="${mode}"
    >
      ${label}
    </button>
  `).join("");
  $("#progress-tabs").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.progressMode = button.dataset.progressMode;
      history.replaceState(
        null,
        "",
        state.progressMode === "unified"
          ? "#unified-progress"
          : "#model-progress",
      );
      renderTraces(activeGroup());
    });
  });
}

function renderTraceRail(rows, groupByIndex, dimensionByIndex) {
  $("#trace-rail").innerHTML = rows.map((row) => `
    <span
      class="rail-segment"
      title="${escapeHtml(
        traceRowStyle(row, groupByIndex, dimensionByIndex).label,
      )}"
      style="background: ${
        traceRowStyle(row, groupByIndex, dimensionByIndex).color
      }"
    ></span>
  `).join("");
}

async function loadTraceCase(index) {
  const trace = state.data.traces[index];
  if (!trace.loadPromise) {
    trace.loadPromise = fetch(`${trace.file}?v=${DATA_VERSION}`)
      .then((response) => response.json())
      .then((data) => {
        trace.models = {};
        for (const [model, rows] of Object.entries(data.models)) {
          trace.models[model] = rows.map(cleanTraceRow);
        }
        return trace;
      });
  }
  return trace.loadPromise;
}

function normalizedDistribution(values) {
  const output = values.map((value) => Math.max(0, Number(value)));
  const total = output.reduce((sum, value) => sum + value, 0);
  if (!total) {
    return output.map(() => 1 / output.length);
  }
  return output.map((value) => value / total);
}

function progressModeLabel() {
  return state.progressMode === "unified"
    ? "Unified Progress"
    : "Model Progress";
}

function decodeProgress(progress) {
  if (Array.isArray(progress)) {
    return normalizedDistribution(progress);
  }
  if (typeof progress !== "string" || !progress) {
    return null;
  }
  const bytes = atob(progress);
  return normalizedDistribution(
    Array.from(bytes, (byte) => byte.charCodeAt(0) / 255),
  );
}

function rowProgressDistribution(row) {
  const key = state.progressMode === "unified"
    ? "unified_progress"
    : "model_progress";
  const cacheKey = `${key}_distribution`;
  if (!row[cacheKey]) {
    row[cacheKey] = decodeProgress(row[key]);
  }
  return row[cacheKey];
}

function hydrateTraceProgress(trace, model) {
  const rows = trace.models[model] || [];
  rows.forEach((row) => {
    row.progress_distribution = rowProgressDistribution(row);
  });
}

function traceRowStyle(row, groupByIndex, dimensionByIndex) {
  if (row.is_degenerate) {
    return {color: "#6f6f6f", label: "No-information", suffix: "degenerate"};
  }
  if (state.progressMode === "model") {
    const dimension = dimensionByIndex.get(row.dimension);
    return {
      color: dimensionColor(row.dimension),
      label: dimension ? dimension.title : `dimension ${row.dimension}`,
      suffix: `d${row.dimension}`,
    };
  }
  const group = groupByIndex.get(row.group);
  return {
    color: group ? group.color : groupColor(row.group),
    label: group ? group.title : `group ${row.group}`,
    suffix: row.dimension === null ? "projected" : `d${row.dimension}`,
  };
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
  const dimensionByIndex = modelDimensionMap(state.traceModel);
  $("#trace-meta").textContent =
    `${formatNumber(state.data.summary.traces)} complete cases · ${
      formatNumber(rows.length)
    } rows for ${state.data.models.find(
      (model) => model.id === state.traceModel,
    ).name} · ${progressModeLabel()}`;
  $("#trace-progress-plot").innerHTML = progressChartHtml(
    rows,
    groupByIndex,
    dimensionByIndex,
  );
  renderTraceRail(rows, groupByIndex, dimensionByIndex);
  $("#trace-list").innerHTML = rows.map((row, rowIndex) => {
    const rowStyle = traceRowStyle(row, groupByIndex, dimensionByIndex);
    const rowGroup = groupByIndex.get(row.group);
    const distribution = Array.isArray(row.progress_distribution)
      ? row.progress_distribution
      : null;
    const progress = progressDistributionMean(distribution);
    return `
      <li
        class="trace-row ${row.group === group.group ? "active" : ""}"
        data-row-index="${rowIndex}"
        style="--group-color: ${
          rowGroup ? rowGroup.color : groupColor(row.group)
        }"
      >
        <span class="trace-index">#${row.section}</span>
        <div>
          <p
            class="trace-label"
            style="color: ${rowStyle.color}"
          >
            ${escapeHtml(rowStyle.label)} · ${rowStyle.suffix}
          </p>
          <p>${escapeHtml(row.text)}</p>
        </div>
        <div class="trace-progress">
          <strong>${
            progress === null ? "no progress" : `${Math.round(progress * 100)}%`
          }</strong>
          ${progressDistributionBars(distribution, rowStyle.color)}
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

function progressPoint(row, index) {
  const distribution = Array.isArray(row.progress_distribution)
    ? row.progress_distribution
    : null;
  const progress = progressDistributionMean(distribution);
  return {distribution, index, progress, row};
}

function progressChartPoints(rows) {
  const step = Math.max(1, Math.ceil(rows.length / PROGRESS_CHART_MAX_POINTS));
  const points = rows.flatMap((row, index) =>
    index % step === 0 ? [progressPoint(row, index)] : [],
  );
  if (rows.length > 0 && (rows.length - 1) % step !== 0) {
    points.push(progressPoint(rows[rows.length - 1], rows.length - 1));
  }
  return points;
}

function progressChartHtml(rows, groupByIndex, dimensionByIndex) {
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
  const points = progressChartPoints(rows);
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
        const style = traceRowStyle(
          point.row,
          groupByIndex,
          dimensionByIndex,
        );
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
              fill="${style.color}"
              opacity="${Math.min(0.72, 0.05 + mass * 3.4).toFixed(3)}"
            >
              <title>#${point.row.section} · ${escapeHtml(style.label)} · ${
                progressBinLabel(binIndex, point.distribution.length)
              }: ${Math.round(mass * 100)}%</title>
            </rect>
          `;
        }).join("");
      }).join("")}
      <polyline class="progress-line" points="${line}"></polyline>
      ${points.map((point) => {
        const progress = point.progress === null ? 0 : point.progress;
        const style = traceRowStyle(
          point.row,
          groupByIndex,
          dimensionByIndex,
        );
        const className = point.progress === null ? " degenerate" : "";
        return `
          <circle
            class="progress-dot${className}"
            cx="${x(point).toFixed(1)}"
            cy="${y(progress).toFixed(1)}"
            r="${point.progress === null ? 3 : 4.5}"
            fill="${style.color}"
          >
            <title>#${point.row.section} · ${escapeHtml(style.label)} · ${
              point.progress === null
                ? "no progress"
                : `${Math.round(point.progress * 100)}%`
            }</title>
          </circle>
        `;
      }).join("")}
      ${points.map((point) => {
        const hitWidth = Math.max(8, pointWidth);
        const style = traceRowStyle(
          point.row,
          groupByIndex,
          dimensionByIndex,
        );
        return `
          <rect
            class="progress-hitbox"
            data-row-index="${point.index}"
            x="${(x(point) - hitWidth / 2).toFixed(1)}"
            y="${top}"
            width="${hitWidth.toFixed(1)}"
            height="${plotHeight}"
          >
            <title>#${point.row.section} · ${escapeHtml(style.label)}</title>
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
  $(".detail-pane").style.setProperty("--group-color", group.color);
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
  renderGroupList();
  renderDetail();
}

function bindEvents() {
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
  const dataResponse = await fetch(`data.json?v=${DATA_VERSION}`);
  state.data = normalizeData(await dataResponse.json());
  state.group = state.data.groups[0].group;
  state.traceModel = state.data.models[0].id;
  if (location.hash.slice(1) === "unified-progress") {
    state.tab = "traces";
    state.progressMode = "unified";
  } else if (location.hash.slice(1) === "model-progress") {
    state.tab = "traces";
    state.progressMode = "model";
  } else if (location.hash.slice(1) === "progress") {
    state.tab = "traces";
  } else if (["examples", "dimensions", "traces"].includes(location.hash.slice(1))) {
    state.tab = location.hash.slice(1);
  }
  bindEvents();
  render();
}

init();
