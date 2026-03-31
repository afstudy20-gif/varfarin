import {
  DAYS,
  TARGETS,
  analyzeWarfarinCase,
  describeSchedule,
  expandPattern,
  formatDate,
  formatMg,
  formatNumber,
  formatTablets,
  isoDateToday,
  parseDosePattern,
  sumSchedule,
  tabletsToMg
} from "./warfarin.js";

// ─── Drug Interactions ──────────────────────────────────────────────

const DRUG_INTERACTIONS = [
  { name: "flukonazol", direction: "increase", severity: "major", note: "CYP2C9 inhibitoru; INR'yi belirgin artirir" },
  { name: "metronidazol", direction: "increase", severity: "major", note: "CYP2C9 inhibitoru; INR artisi beklenir" },
  { name: "kotrimoksazol", direction: "increase", severity: "major", note: "Trimetoprim-sulfametoksazol INR'yi artirir" },
  { name: "amiodaron", direction: "increase", severity: "major", note: "CYP2C9/1A2 inhibitoru; uzun sureli etki, doz %30-50 azaltilmali" },
  { name: "fluoksetin", direction: "increase", severity: "moderate", note: "CYP2C9 inhibitoru; INR izlenmeli" },
  { name: "eritromisin", direction: "increase", severity: "moderate", note: "CYP3A4 inhibitoru; INR artisi olabilir" },
  { name: "klaritromisin", direction: "increase", severity: "moderate", note: "CYP3A4 inhibitoru; INR artisi olabilir" },
  { name: "siprofloksasin", direction: "increase", severity: "moderate", note: "CYP1A2 inhibitoru; INR artabilir" },
  { name: "ibuprofen", direction: "increase", severity: "moderate", note: "NSAID; kanama riskini artirir, GIS korumasi dusunulmeli" },
  { name: "naproksen", direction: "increase", severity: "moderate", note: "NSAID; kanama riskini artirir" },
  { name: "diklofenak", direction: "increase", severity: "moderate", note: "NSAID; kanama riskini artirir" },
  { name: "aspirin", direction: "increase", severity: "moderate", note: "Antiplatelet + antikoagulan; kanama riski artar, endikasyon degerlendirilmeli" },
  { name: "piroksikam", direction: "increase", severity: "moderate", note: "NSAID; kanama riskini artirir" },
  { name: "fenofibrat", direction: "increase", severity: "moderate", note: "CYP2C9 inhibitoru; INR izlenmeli" },
  { name: "omeprazol", direction: "increase", severity: "minor", note: "CYP2C19 inhibitoru; hafif INR artisi olabilir" },
  { name: "parasetamol", direction: "increase", severity: "minor", note: "Yuksek dozda (>2 g/gun) INR artabilir" },
  { name: "rifampisin", direction: "decrease", severity: "major", note: "Guclu CYP induktoru; INR belirgin duser, doz 2-3 kat artirilmali" },
  { name: "karbamazepin", direction: "decrease", severity: "major", note: "CYP3A4/2C9 induktoru; INR dusmesi beklenir" },
  { name: "fenitoin", direction: "decrease", severity: "major", note: "CYP induktoru; INR duser" },
  { name: "fenobarbital", direction: "decrease", severity: "moderate", note: "CYP induktoru; INR azalabilir" },
  { name: "kolestiramin", direction: "decrease", severity: "moderate", note: "Warfarin emilimini azaltir; en az 4 saat arayla alinmali" },
  { name: "sukralfat", direction: "decrease", severity: "minor", note: "Warfarin emilimini hafif azaltabilir" },
  { name: "k vitamini", direction: "decrease", severity: "major", note: "Dogrudan antagonist; diyet degisiklikleri INR'yi etkiler" },
  { name: "st john", direction: "decrease", severity: "major", note: "St. John's Wort (sarikantaron); CYP induktoru, INR duser" },
  { name: "sarikantaron", direction: "decrease", severity: "major", note: "CYP induktoru; INR belirgin duser" }
];

function checkDrugInteractions(drugText) {
  if (!drugText || !drugText.trim()) return [];

  const normalized = drugText.toLowerCase()
    .replace(/[çÇ]/g, "c")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[İ]/g, "i")
    .replace(/[ıI]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[üÜ]/g, "u");

  const terms = normalized.split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
  const found = [];

  for (const term of terms) {
    for (const drug of DRUG_INTERACTIONS) {
      if (term.includes(drug.name) || drug.name.includes(term)) {
        if (!found.some((f) => f.name === drug.name)) {
          found.push(drug);
        }
      }
    }
  }

  return found;
}

// ─── Dose History (localStorage) ────────────────────────────────────

const HISTORY_KEY = "varfarin_dose_history";

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function addHistoryEntry(entry) {
  const history = loadHistory();
  history.push(entry);
  if (history.length > 50) history.splice(0, history.length - 50);
  saveHistory(history);
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
}

function calculateTTR(history, target) {
  if (history.length < 2) return null;

  const sorted = [...history]
    .filter((h) => h.date && h.inr)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length < 2) return null;

  let totalDays = 0;
  let inRangeDays = 0;

  for (let i = 0; i < sorted.length - 1; i++) {
    const start = new Date(`${sorted[i].date}T00:00:00`);
    const end = new Date(`${sorted[i + 1].date}T00:00:00`);
    const days = Math.round((end - start) / 86400000);
    if (days <= 0 || days > 90) continue;

    const inr1 = sorted[i].inr;
    const inr2 = sorted[i + 1].inr;

    totalDays += days;

    const both1InRange = inr1 >= target.low && inr1 <= target.high;
    const both2InRange = inr2 >= target.low && inr2 <= target.high;

    if (both1InRange && both2InRange) {
      inRangeDays += days;
    } else if (both1InRange || both2InRange) {
      inRangeDays += days * 0.5;
    }
  }

  if (totalDays === 0) return null;
  return Math.round((inRangeDays / totalDays) * 100);
}

function renderHistory() {
  const section = document.querySelector("#history-section");
  const tableRoot = document.querySelector("#history-table-root");
  const chartRoot = document.querySelector("#history-chart");
  const history = loadHistory();

  if (history.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "";
  const targetKey = document.querySelector("#target-range").value;
  const target = TARGETS[targetKey] ?? TARGETS.standard;
  const ttr = calculateTTR(history, target);

  const ttrHtml = ttr !== null
    ? `<div style="margin-bottom:12px">
        <strong style="font-size:0.84rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted)">TTR (Terapotik Aralikta Kalma)</strong>
        <span class="ttr-badge ${ttr >= 60 ? "ttr-good" : "ttr-warn"}">${ttr}%</span>
        ${ttr < 60 ? '<small style="color:var(--alert);margin-left:8px">TTR < %60: Alternatif antikoagulan degerlendirmesi dusunulebilir</small>' : ""}
       </div>`
    : "";

  const last10 = history.slice(-10).reverse();
  const rows = last10.map((h) => `
    <tr>
      <td>${formatDate(h.date)}</td>
      <td>${formatNumber(h.inr, 1)}</td>
      <td>${formatNumber(h.weeklyDose, 1)}</td>
      <td>${formatNumber(h.recommendation, 1)}</td>
    </tr>
  `).join("");

  tableRoot.innerHTML = `
    ${ttrHtml}
    <table class="history-table">
      <thead>
        <tr>
          <th>Tarih</th>
          <th>INR</th>
          <th>Mevcut Doz</th>
          <th>Onerilen Doz</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  renderHistoryChart(history, target, chartRoot);
}

function renderHistoryChart(history, target, container) {
  const sorted = [...history]
    .filter((h) => h.date && h.inr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-20);

  if (sorted.length < 2) {
    container.innerHTML = "";
    return;
  }

  const canvas = container.querySelector("canvas") || document.createElement("canvas");
  if (!container.contains(canvas)) {
    container.innerHTML = "";
    container.appendChild(canvas);
  }

  const dpr = window.devicePixelRatio || 1;
  const width = container.clientWidth || 600;
  const height = 200;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const inrValues = sorted.map((h) => h.inr);
  const minInr = Math.min(...inrValues, target.low - 0.5);
  const maxInr = Math.max(...inrValues, target.high + 0.5);

  const xScale = (i) => pad.left + (i / (sorted.length - 1)) * cw;
  const yScale = (v) => pad.top + ch - ((v - minInr) / (maxInr - minInr)) * ch;

  const style = getComputedStyle(document.documentElement);
  const goodColor = style.getPropertyValue("--good").trim() || "#235f49";
  const accentColor = style.getPropertyValue("--accent").trim() || "#145c6d";
  const mutedColor = style.getPropertyValue("--muted").trim() || "#5f7278";
  const inkColor = style.getPropertyValue("--ink").trim() || "#20313a";

  ctx.fillStyle = `${goodColor}18`;
  ctx.beginPath();
  ctx.rect(pad.left, yScale(target.high), cw, yScale(target.low) - yScale(target.high));
  ctx.fill();

  ctx.strokeStyle = `${goodColor}60`;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(pad.left, yScale(target.low));
  ctx.lineTo(pad.left + cw, yScale(target.low));
  ctx.moveTo(pad.left, yScale(target.high));
  ctx.lineTo(pad.left + cw, yScale(target.high));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  sorted.forEach((h, i) => {
    const x = xScale(i);
    const y = yScale(h.inr);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  sorted.forEach((h, i) => {
    const x = xScale(i);
    const y = yScale(h.inr);
    const inRange = h.inr >= target.low && h.inr <= target.high;
    ctx.fillStyle = inRange ? goodColor : accentColor;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = mutedColor;
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  const step = Math.max(1, Math.floor(sorted.length / 6));
  sorted.forEach((h, i) => {
    if (i % step === 0 || i === sorted.length - 1) {
      const label = h.date.slice(5);
      ctx.fillText(label, xScale(i), height - 6);
    }
  });

  ctx.textAlign = "right";
  const yTicks = 5;
  for (let t = 0; t <= yTicks; t++) {
    const val = minInr + ((maxInr - minInr) * t) / yTicks;
    ctx.fillStyle = mutedColor;
    ctx.fillText(val.toFixed(1), pad.left - 6, yScale(val) + 4);
  }
}

// ─── DOM References ─────────────────────────────────────────────────

const form = document.querySelector("#warfarin-form");
const patternInput = document.querySelector("#pattern-input");
const parsePatternButton = document.querySelector("#parse-pattern");
const weekGrid = document.querySelector("#week-grid");
const weeklySummary = document.querySelector("#weekly-summary");
const resultRoot = document.querySelector("#result-root");
const currentDateInput = document.querySelector("#current-date");
const tabletStrengthInput = document.querySelector("#tablet-strength");
const themeToggle = document.querySelector("#theme-toggle");
const drugInput = document.querySelector("#drug-input");
const clearHistoryButton = document.querySelector("#clear-history");

// ─── Theme ──────────────────────────────────────────────────────────

function initTheme() {
  const stored = localStorage.getItem("varfarin_theme");
  if (stored) {
    document.documentElement.setAttribute("data-theme", stored);
  } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("varfarin_theme", next);
}

// ─── Weekly Grid ────────────────────────────────────────────────────

function createWeekGrid() {
  weekGrid.innerHTML = "";

  DAYS.forEach((day, index) => {
    const cell = document.createElement("div");
    cell.className = "dose-cell";
    cell.innerHTML = `
      <label>
        <span class="dose-day">${day.short}</span>
        <input
          type="number"
          min="0"
          step="0.5"
          value="1"
          data-day-index="${index}"
          aria-label="${day.long} dozu"
        />
      </label>
    `;
    weekGrid.appendChild(cell);
  });
}

function readWeeklySchedule() {
  return [...weekGrid.querySelectorAll("input")].map((input) => Number(input.value));
}

function writeWeeklySchedule(schedule) {
  const inputs = [...weekGrid.querySelectorAll("input")];
  inputs.forEach((input, index) => {
    input.value = schedule[index] ?? 0;
  });
  updateWeeklySummary();
}

function updateWeeklySummary() {
  const tabletStrengthMg = Number(tabletStrengthInput.value || 5);
  const weeklyTablets = sumSchedule(readWeeklySchedule());
  const weeklyMg = tabletsToMg(weeklyTablets, tabletStrengthMg);
  weeklySummary.textContent = `Haftalik toplam: ${formatNumber(weeklyTablets, 2)} tablet (${formatMg(weeklyMg)})`;
}

// ─── Render Helpers ─────────────────────────────────────────────────

function renderMessage(message, variant = "empty") {
  const className =
    variant === "warning"
      ? "warning-banner"
      : variant === "success"
        ? "success-banner"
        : "empty-state";

  resultRoot.innerHTML = `<div class="${className}">${message}</div>`;
}

function renderHighRisk(result) {
  resultRoot.innerHTML = `
    <div class="result-panel">
      <div class="warning-banner">
        <strong>&#9888; ${result.title}</strong><br />
        ${result.message}
      </div>
      <div class="metric-card">
        <strong>Ne yapilmali?</strong>
        <ul class="reason-list">
          ${result.guidance.map((item) => `<li>${item}</li>`).join("")}
        </ul>
      </div>
    </div>
  `;
  resultRoot.focus();
}

function buildTrendHtml(currentInr, previousInr) {
  if (!Number.isFinite(previousInr)) return "";

  const diff = currentInr - previousInr;
  let arrow, cls;
  if (Math.abs(diff) < 0.15) {
    arrow = "&#8594;";
    cls = "stable";
  } else if (diff > 0) {
    arrow = "&#8593;";
    cls = "up";
  } else {
    arrow = "&#8595;";
    cls = "down";
  }

  return `<span class="inr-trend">(${formatNumber(previousInr, 1)} <span class="trend-arrow ${cls}">${arrow}</span> ${formatNumber(currentInr, 1)})</span>`;
}

function renderResult(result, tabletStrengthMg, interactions) {
  const adjustedText =
    result.adjustmentPercent === 0
      ? "Doz degisikligi yok"
      : `${result.adjustmentPercent > 0 ? "Artis" : "Azalis"} ${Math.abs(result.adjustmentPercent)}%`;

  const nextInrText = result.nextInrDate
    ? `${result.nextInrDays} gun sonra (${formatDate(result.nextInrDate)})`
    : `${result.nextInrDays} gun sonra`;

  const historyHtml = result.historySummary
    ? `
      <div class="metric-card">
        <strong>Ara donem kullanim</strong>
        <span>${result.historySummary.modeledDays} gun boyunca ${formatNumber(result.historySummary.totalTablets, 2)} tablet</span>
      </div>
    `
    : "";

  const trendHtml = buildTrendHtml(result.currentInr, result.previousInr);

  const interactionsHtml = interactions.length > 0
    ? `<div class="interaction-banner">
        <strong>&#9888; Ilac Etkilesim Uyarisi</strong>
        <ul class="reason-list">
          ${interactions.map((d) => `<li><strong>${d.name}</strong> (${d.severity === "major" ? "major" : d.severity === "moderate" ? "orta" : "minOr"}): ${d.note}</li>`).join("")}
        </ul>
      </div>`
    : "";

  resultRoot.innerHTML = `
    <div class="result-panel">
      ${interactionsHtml}

      <div class="result-banner">
        <strong>&#10003; Durum:</strong> Bugunku INR ${formatNumber(result.currentInr, 1)} ve sonuc ${result.statusLabel}. ${trendHtml}<br />
        <strong>Hemen yapilacak:</strong> ${result.immediateAction}
      </div>

      <div class="result-actions">
        <button type="button" class="secondary-button small-button" id="copy-result">Kopyala</button>
        <button type="button" class="secondary-button small-button" id="print-result">Yazdir</button>
      </div>

      <div class="result-grid">
        <div class="metric-card">
          <strong>Temel haftalik doz</strong>
          <span>${formatNumber(result.basisWeeklyDoseTablets, 2)} tablet (${formatMg(result.basisWeeklyDoseMg)})</span>
        </div>
        <div class="metric-card">
          <strong>Onerilen degisim</strong>
          <span>${adjustedText}</span>
        </div>
        <div class="metric-card">
          <strong>Yeni haftalik doz</strong>
          <span>${formatNumber(result.recommendedWeeklyTablets, 2)} tablet (${formatMg(result.recommendedWeeklyMg)})</span>
        </div>
        <div class="metric-card">
          <strong>Sonraki INR</strong>
          <span>${nextInrText}</span>
        </div>
        ${historyHtml}
        <div class="metric-card">
          <strong>Hedef aralik</strong>
          <span>${TARGETS[result.target.key].label}</span>
        </div>
      </div>

      <div class="metric-card">
        <strong>Onerilen 7 gunluk kullanim</strong>
        <div>${describeSchedule(result.recommendedSchedule, tabletStrengthMg)}</div>
        <ul class="schedule-list">
          ${result.recommendedSchedule
            .map((dose, index) => {
              const mg = tabletsToMg(dose, tabletStrengthMg);
              return `<li>${DAYS[index].long}: ${formatTablets(dose)} tablet (${formatMg(mg)})</li>`;
            })
            .join("")}
        </ul>
      </div>

      <div class="metric-card">
        <strong>Kararin gerekcesi</strong>
        <ul class="reason-list">
          ${result.reasons.map((reason) => `<li>${reason}</li>`).join("")}
        </ul>
      </div>

      <div class="success-banner">
        &#10003; Uygulama, yarim tablet adimlariyla dengeli bir 7 gunluk plan uretir. Klinik
        yargiyla mevcut tablet gucune ve hastanin uyum kapasitesine gore sadelestirme yapabilirsiniz.
      </div>
    </div>
  `;

  resultRoot.focus();

  document.querySelector("#copy-result").addEventListener("click", copyResult);
  document.querySelector("#print-result").addEventListener("click", () => window.print());
}

function copyResult() {
  const panel = resultRoot.querySelector(".result-panel");
  if (!panel) return;

  const text = panel.innerText;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector("#copy-result");
    const original = btn.textContent;
    btn.textContent = "Kopyalandi!";
    setTimeout(() => { btn.textContent = original; }, 1500);
  });
}

// ─── Pattern Parsing ────────────────────────────────────────────────

function parsePatternIntoWeek() {
  const tabletStrengthMg = Number(tabletStrengthInput.value || 5);
  const parsed = parseDosePattern(patternInput.value, tabletStrengthMg);

  if (!parsed.ok) {
    renderMessage(parsed.error, "warning");
    return;
  }

  const weeklySchedule = expandPattern(parsed.cycle, 7);
  writeWeeklySchedule(weeklySchedule);
  renderMessage("Patern cozuldu ve 7 gunluk tabloya aktarildi. Isterseniz hucreleri elle duzeltebilirsiniz.", "success");
}

// ─── Form Submit ────────────────────────────────────────────────────

function handleSubmit(event) {
  event.preventDefault();

  const targetKey = document.querySelector("#target-range").value;
  const tabletStrengthMg = Number(document.querySelector("#tablet-strength").value);
  const currentInr = Number(document.querySelector("#current-inr").value);
  const currentDate = document.querySelector("#current-date").value;
  const previousInrRaw = document.querySelector("#previous-inr").value;
  const previousInr = previousInrRaw ? Number(previousInrRaw) : undefined;
  const previousDate = document.querySelector("#previous-date").value;
  const intervalPattern = document.querySelector("#interval-pattern").value;
  const transientFactor = document.querySelector("#transient-factor").value;
  const activeBleeding = document.querySelector("#active-bleeding").checked;
  const weeklySchedule = readWeeklySchedule();

  const result = analyzeWarfarinCase({
    targetKey,
    tabletStrengthMg,
    currentInr,
    currentDate,
    previousInr,
    previousDate,
    weeklySchedule,
    intervalPattern,
    transientFactor,
    activeBleeding
  });

  if (!result.ok) {
    renderMessage(result.errors.join("<br />"), "warning");
    return;
  }

  if (result.highRisk) {
    renderHighRisk(result);
    return;
  }

  const interactions = checkDrugInteractions(drugInput.value);
  renderResult(result, tabletStrengthMg, interactions);

  addHistoryEntry({
    date: currentDate,
    inr: currentInr,
    weeklyDose: result.basisWeeklyDoseTablets,
    recommendation: result.recommendedWeeklyTablets
  });

  renderHistory();
}

// ─── Quick Patterns ─────────────────────────────────────────────────

function handleQuickPattern(event) {
  const btn = event.target.closest("[data-pattern]");
  if (!btn) return;
  patternInput.value = btn.dataset.pattern;
  parsePatternIntoWeek();
}

// ─── Init ───────────────────────────────────────────────────────────

initTheme();
createWeekGrid();
currentDateInput.value = isoDateToday();
writeWeeklySchedule(expandPattern([1], 7));
renderHistory();

weekGrid.addEventListener("input", updateWeeklySummary);
tabletStrengthInput.addEventListener("input", updateWeeklySummary);
parsePatternButton.addEventListener("click", parsePatternIntoWeek);
form.addEventListener("submit", handleSubmit);
themeToggle.addEventListener("click", toggleTheme);
clearHistoryButton.addEventListener("click", clearHistory);
document.querySelector(".quick-patterns").addEventListener("click", handleQuickPattern);
