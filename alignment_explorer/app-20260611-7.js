const state = {
  data: null,
  results: null,
  group: null,
  tab: "examples",
  model: "all",
  query: "",
  traceIndex: 0,
  traceModel: null,
};

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
  return colorList[groupIndex % colorList.length];
}

function activeGroup() {
  return state.data.groups.find((group) => group.group === state.group);
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
    `${state.data.version} · ${state.data.groups.length} groups`;
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
      <span class="step-badge">${String(group.step).padStart(2, "0")}</span>
      <span>
        <span class="group-name">${group.title}</span>
        <span class="group-meta">${group.dimensions.length} dimensions</span>
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

function examplesForGroup(group) {
  const examples = [];
  for (const model of state.data.models) {
    if (state.model !== "all" && state.model !== model.id) {
      continue;
    }
    for (const example of group.examples[model.id] || []) {
      examples.push(example);
    }
  }
  return examples;
}

function renderExamples(group) {
  const examples = examplesForGroup(group);
  $("#panel-examples").innerHTML = `
    <div class="example-grid">
      ${examples.map((example) => `
        <article class="example-card">
          <h3>${escapeHtml(example.model_short)} · d${example.dimension}</h3>
          <p>${escapeHtml(example.text)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function renderDimensions(group) {
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

function traceRows() {
  const trace = state.data.traces[state.traceIndex];
  return trace.models[state.traceModel] || [];
}

function renderTraceControls() {
  const caseSelect = $("#case-select");
  caseSelect.innerHTML = state.data.traces.map((trace, index) => `
    <option value="${index}">${trace.pmcid.slice(0, 8)} · q${trace.question_id}</option>
  `).join("");
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

function renderTraces(group) {
  renderTraceControls();
  const rows = traceRows();
  renderTraceRail(rows);
  const groupByIndex = new Map(
    state.data.groups.map((item) => [item.group, item]),
  );
  $("#trace-list").innerHTML = rows.map((row) => {
    const rowGroup = groupByIndex.get(row.group);
    return `
      <li class="trace-row ${row.group === group.group ? "active" : ""}">
        <span class="trace-index">#${row.section}</span>
        <div>
          <p
            class="trace-label"
            style="color: ${groupColor(row.group)}"
          >
            ${escapeHtml(rowGroup ? rowGroup.title : `group ${row.group}`)} · d${row.dimension}
          </p>
          <p>${escapeHtml(row.text)}</p>
        </div>
      </li>
    `;
  }).join("");
}

function renderPanels(group) {
  $("#panel-examples").hidden = state.tab !== "examples";
  $("#panel-dimensions").hidden = state.tab !== "dimensions";
  $("#panel-traces").hidden = state.tab !== "traces";
  $("#tab-examples").classList.toggle("selected", state.tab === "examples");
  $("#tab-dimensions").classList.toggle("selected", state.tab === "dimensions");
  $("#tab-traces").classList.toggle("selected", state.tab === "traces");
  renderExamples(group);
  renderDimensions(group);
  renderTraces(group);
}

function renderDetail() {
  const group = activeGroup();
  $("#detail-step").textContent = group.fixed
    ? `Step ${String(group.step).padStart(2, "0")} · fixed anchor`
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
    state.tab = "examples";
    renderPanels(activeGroup());
  });
  $("#tab-dimensions").addEventListener("click", () => {
    state.tab = "dimensions";
    renderPanels(activeGroup());
  });
  $("#tab-traces").addEventListener("click", () => {
    state.tab = "traces";
    renderPanels(activeGroup());
  });
  $("#case-select").addEventListener("change", (event) => {
    state.traceIndex = Number(event.target.value);
    renderTraces(activeGroup());
  });
}

async function init() {
  const [dataResponse, resultsResponse] = await Promise.all([
    fetch("data-20260611-7.json"),
    fetch("results-20260611-7.json"),
  ]);
  state.data = await dataResponse.json();
  state.results = await resultsResponse.json();
  state.group = state.data.groups[0].group;
  state.traceModel = state.data.models[0].id;
  bindEvents();
  render();
}

init();
