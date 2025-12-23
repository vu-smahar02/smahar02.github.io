// --- Fake data (replace later with your real categorized monthly totals) ---
const months = ["Aug 2025", "Sep 2025", "Oct 2025", "Nov 2025", "Dec 2025", "Jan 2026"];

const categories = [
  "Rent",
  "Utilities",
  "Household/Groceries",
  "Dining Out",
  "Travel",
  "Subscriptions",
  "Miscellaneous"
];

const trend = {
  "Rent": [1000, 1000, 1000, 1000, 1000, 1000],
  "Utilities": [135, 75, 60, 50, 45, 59],
  "Household/Groceries": [560, 430, 320, 220, 110, 105],
  "Dining Out": [200, 350, 205, 305, 250, 220],
  "Travel": [600, 300, 100, 400, 450, 200],
  "Subscriptions": [10, 25, 25, 25, 25, 20],
  "Miscellaneous": [200, 250, 105, 60, 75, 35]
};

const currentMonth = months[months.length - 1];

// --- Chart palette (separate from the Villanova UI colors) ---
const CHART_PALETTE = [
  "#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F", "#EDC948", "#B07AA1"
];

const CATEGORY_COLORS = Object.fromEntries(
  categories.map((c, i) => [c, CHART_PALETTE[i % CHART_PALETTE.length]])
);

// --- UI state ---
const state = { selected: new Set(categories) };

// --- DOM helpers ---
const $ = (id) => document.getElementById(id);

function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
}

let toastTimer = null;
function showToast(msg) {
  const el = $("toast");
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.textContent = ""), 2200);
}

function selectedCategories() {
  return categories.filter((c) => state.selected.has(c));
}

function colorFor(cat) {
  return CATEGORY_COLORS[cat];
}

function currentTotals() {
  const idx = months.length - 1;
  const totals = {};
  categories.forEach((c) => (totals[c] = trend[c][idx] ?? 0));
  return totals;
}

// --- Legend ---
function renderLegend() {
  const wrap = $("categoryLegend");
  wrap.innerHTML = "";

  categories.forEach((cat) => {
    const row = document.createElement("div");
    row.className = "legend-item";

    const left = document.createElement("div");
    left.className = "legend-left";

    const dot = document.createElement("div");
    dot.className = "legend-dot";
    dot.style.background = colorFor(cat);

    const label = document.createElement("div");
    label.className = "legend-label";
    label.textContent = cat;

    left.appendChild(dot);
    left.appendChild(label);

    const sw = document.createElement("button");
    sw.type = "button";
    sw.className = "legend-switch";
    sw.setAttribute("aria-label", `Toggle ${cat}`);
    sw.dataset.on = state.selected.has(cat) ? "true" : "false";

    const knob = document.createElement("div");
    knob.className = "legend-knob";
    sw.appendChild(knob);

    sw.addEventListener("click", () => {
      const isOn = sw.dataset.on === "true";

      if (isOn) {
        if (state.selected.size <= 2) {
          showToast("Select at least two categories at all times.");
          return;
        }
        state.selected.delete(cat);
        sw.dataset.on = "false";
      } else {
        state.selected.add(cat);
        sw.dataset.on = "true";
      }

      updateAll();
    });

    row.appendChild(left);
    row.appendChild(sw);
    wrap.appendChild(row);
  });
}

function setupLegendCollapse() {
  const btn = $("legendToggleBtn");
  const body = $("categoryLegend");

  btn.addEventListener("click", () => {
    const isHidden = body.style.display === "none";
    body.style.display = isHidden ? "" : "none";
    btn.textContent = isHidden ? "Hide" : "Show";
    btn.setAttribute("aria-expanded", isHidden ? "true" : "false");
  });
}

// --- Charts ---
let pieChart = null;
let barChart = null;
let lineChart = null;

function buildCharts() {
  pieChart = new Chart($("pieChart"), {
    type: "doughnut",
    data: {
      labels: [],
      datasets: [{ data: [], backgroundColor: [], borderColor: "#ffffff", borderWidth: 2 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const label = ctx.label || "";
              const value = ctx.parsed || 0;
              const total = (ctx.dataset.data || []).reduce((a, b) => a + Number(b || 0), 0);
              const pct = total > 0 ? Math.round((value / total) * 100) : 0;
              return ` ${label}: ${money(value)} (${pct}%)`;
            }
          }
        }
      },
      cutout: "58%"
    }
  });

  barChart = new Chart($("barChart"), {
    type: "bar",
    data: {
      labels: [],
      datasets: [{ label: "Current month", data: [], backgroundColor: [], borderColor: [], borderWidth: 1 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
            y: { beginAtZero: true, ticks: { callback: (v) => `$${v}` } },
            x: {
                ticks: {
                autoSkip: false,     // <-- show all labels
                maxRotation: 45,     // rotate if needed
                minRotation: 45
                }
            }
            },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${money(ctx.parsed.y)}` } }
      }
    }
  });

  lineChart = new Chart($("lineChart"), {
    type: "line",
    data: { labels: months, datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      scales: {
        y: { beginAtZero: true, ticks: { callback: (v) => `$${v}` } }
      },
      plugins: {
        legend: { position: "top", labels: { usePointStyle: true, boxWidth: 10 } },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${money(ctx.parsed.y)}` } }
      },
      elements: {
        line: { tension: 0.25, borderWidth: 3 },
        point: { radius: 3, hoverRadius: 5 }
      }
    }
  });
}

function updateKpi() {
  const totals = currentTotals();
  const selected = selectedCategories();
  const total = selected.reduce((sum, c) => sum + (totals[c] || 0), 0);

  $("kpiTotal").textContent = money(total);
  $("kpiMonth").textContent = currentMonth;
}

function updatePie() {
  const totals = currentTotals();
  const selected = selectedCategories();

  pieChart.data.labels = selected;
  pieChart.data.datasets[0].data = selected.map((c) => totals[c] || 0);
  pieChart.data.datasets[0].backgroundColor = selected.map(colorFor);
  pieChart.update();
}

function updateBar() {
  const totals = currentTotals();
  const selected = selectedCategories();

  barChart.data.labels = selected;
  barChart.data.datasets[0].data = selected.map((c) => totals[c] || 0);
  barChart.data.datasets[0].backgroundColor = selected.map(colorFor);
  barChart.data.datasets[0].borderColor = selected.map(colorFor);
  barChart.update();
}

function updateLine() {
  const selected = selectedCategories();

  lineChart.data.labels = months;
  lineChart.data.datasets = selected.map((cat) => ({
    label: cat,
    data: trend[cat],
    borderColor: colorFor(cat),
    backgroundColor: colorFor(cat),
    fill: false
  }));

  lineChart.update();
}

function updateAll() {
  updateKpi();
  updatePie();
  updateBar();
  updateLine();
}

// --- Init ---
renderLegend();
buildCharts();
updateAll();