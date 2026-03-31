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

const form = document.querySelector("#warfarin-form");
const patternInput = document.querySelector("#pattern-input");
const parsePatternButton = document.querySelector("#parse-pattern");
const weekGrid = document.querySelector("#week-grid");
const weeklySummary = document.querySelector("#weekly-summary");
const resultRoot = document.querySelector("#result-root");
const currentDateInput = document.querySelector("#current-date");
const tabletStrengthInput = document.querySelector("#tablet-strength");

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
        <strong>${result.title}</strong><br />
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
}

function renderResult(result, tabletStrengthMg) {
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

  resultRoot.innerHTML = `
    <div class="result-panel">
      <div class="result-banner">
        <strong>Durum:</strong> Bugunku INR ${formatNumber(result.currentInr, 1)} ve sonuc ${result.statusLabel}.<br />
        <strong>Hemen yapilacak:</strong> ${result.immediateAction}
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
        Uygulama, yarim tablet adimlariyla dengeli bir 7 gunluk plan uretir. Klinik
        yargiyla mevcut tablet gucune ve hastanin uyum kapasitesine gore sadelestirme yapabilirsiniz.
      </div>
    </div>
  `;
}

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

  renderResult(result, tabletStrengthMg);
}

createWeekGrid();
currentDateInput.value = isoDateToday();
writeWeeklySchedule(expandPattern([1], 7));

weekGrid.addEventListener("input", updateWeeklySummary);
tabletStrengthInput.addEventListener("input", updateWeeklySummary);
parsePatternButton.addEventListener("click", parsePatternIntoWeek);
form.addEventListener("submit", handleSubmit);
