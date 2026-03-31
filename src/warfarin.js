export const DAYS = [
  { key: "mon", short: "Pzt", long: "Pazartesi" },
  { key: "tue", short: "Sali", long: "Sali" },
  { key: "wed", short: "Cars", long: "Carsamba" },
  { key: "thu", short: "Pers", long: "Persembe" },
  { key: "fri", short: "Cuma", long: "Cuma" },
  { key: "sat", short: "Cmt", long: "Cumartesi" },
  { key: "sun", short: "Paz", long: "Pazar" }
];

export const TARGETS = {
  standard: { key: "standard", label: "2.0 - 3.0", low: 2.0, high: 3.0 },
  high: { key: "high", label: "2.5 - 3.5", low: 2.5, high: 3.5 }
};

const LOW_STATES = new Set(["slightlyLow", "low", "veryLow"]);
const HIGH_STATES = new Set(["slightlyHigh", "mildHigh", "high", "veryHigh"]);

const DAY_ALIASES = {
  pazartesi: 0,
  pzt: 0,
  sali: 1,
  sal: 1,
  carsamba: 2,
  car: 2,
  persembe: 3,
  per: 3,
  cuma: 4,
  cum: 4,
  cumartesi: 5,
  cmt: 5,
  pazar: 6,
  paz: 6
};

export function normalizeTurkish(text = "") {
  const map = {
    c: /[cç]/g,
    g: /[gğ]/g,
    i: /[ıi]/g,
    o: /[oö]/g,
    s: /[sş]/g,
    u: /[uü]/g
  };

  let normalized = String(text).toLowerCase();
  Object.entries(map).forEach(([replacement, pattern]) => {
    normalized = normalized.replace(pattern, replacement);
  });

  return normalized.replace(/\s+/g, " ").trim();
}

export function roundToStep(value, step = 0.5) {
  return Math.round(value / step) * step;
}

export function formatNumber(value, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1
  }).format(value);
}

export function formatTablets(value) {
  if (Math.abs(value - 0.5) < 0.001) {
    return "yarim";
  }

  if (Math.abs(value - 0.25) < 0.001) {
    return "ceyrek";
  }

  return formatNumber(value, 2);
}

export function formatMg(value) {
  return `${formatNumber(value, 2)} mg`;
}

export function isoDateToday() {
  const now = new Date();
  const pad = (chunk) => String(chunk).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function formatDate(isoDate) {
  if (!isoDate) {
    return "-";
  }

  const date = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

export function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(startIso, endIso) {
  if (!startIso || !endIso) {
    return null;
  }

  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  const diff = end.getTime() - start.getTime();

  return Math.round(diff / 86400000);
}

function parseNumericToken(token) {
  return Number.parseFloat(String(token).replace(",", "."));
}

function parseDoseFragment(fragment, tabletStrengthMg) {
  if (!fragment) {
    return null;
  }

  const raw = String(fragment).trim();
  const normalized = normalizeTurkish(raw);
  if (!normalized) {
    return null;
  }

  if (normalized.includes("bir bucuk")) {
    return 1.5;
  }

  const mgMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*mg\b/);
  if (mgMatch) {
    return parseNumericToken(mgMatch[1]) / tabletStrengthMg;
  }

  if (normalized.includes("yarim")) {
    const numberBeforeHalf = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:adet|tablet)?\s*yarim/);
    if (numberBeforeHalf) {
      return parseNumericToken(numberBeforeHalf[1]) + 0.5;
    }
    return 0.5;
  }

  if (normalized.includes("ceyrek")) {
    return 0.25;
  }

  const numberMatch = normalized.match(/(\d+(?:[.,]\d+)?)/);
  if (numberMatch) {
    return parseNumericToken(numberMatch[1]);
  }

  if (/\bbir\b/.test(normalized)) {
    return 1;
  }

  return null;
}

function parseNamedDaySchedule(text, tabletStrengthMg) {
  const normalized = normalizeTurkish(text);
  const aliasPattern = Object.keys(DAY_ALIASES)
    .sort((left, right) => right.length - left.length)
    .join("|");
  const regex = new RegExp(
    `(?:^|[\\s,;]+)(${aliasPattern})\\s*:?\\s*(yarim|ceyrek|bir bucuk|\\d+(?:[.,]\\d+)?\\s*(?:mg|adet|tablet)?)`,
    "g"
  );
  const schedule = Array(7).fill(null);
  let match = regex.exec(normalized);

  while (match) {
    const dayIndex = DAY_ALIASES[match[1]];
    const dose = parseDoseFragment(match[2], tabletStrengthMg);
    if (dayIndex !== undefined && dose !== null) {
      schedule[dayIndex] = dose;
    }
    match = regex.exec(normalized);
  }

  if (schedule.every((dose) => dose !== null)) {
    return schedule;
  }

  return null;
}

function parseTokenList(text, tabletStrengthMg) {
  const regex = /(yarim|ceyrek|bir bucuk|\d+(?:[.,]\d+)?\s*(?:mg|adet|tablet)?)/gi;
  const tokens = [];
  let match = regex.exec(text);

  while (match) {
    tokens.push(match[0]);
    match = regex.exec(text);
  }

  return tokens
    .map((token) => parseDoseFragment(token, tabletStrengthMg))
    .filter((token) => token !== null);
}

export function parseDosePattern(text, tabletStrengthMg = 5) {
  if (!text || !String(text).trim()) {
    return { ok: false, error: "Doz paterni bos birakildi." };
  }

  const namedSchedule = parseNamedDaySchedule(text, tabletStrengthMg);
  if (namedSchedule) {
    return { ok: true, cycle: namedSchedule, source: "named-days" };
  }

  const normalized = normalizeTurkish(text);

  if (normalized.includes("her gun")) {
    const afterPhrase = normalized.split("her gun").slice(1).join(" ").trim();
    const dose = parseDoseFragment(afterPhrase, tabletStrengthMg);
    if (dose !== null) {
      return { ok: true, cycle: [dose], source: "daily" };
    }
  }

  const alternatingParts = normalized
    .split(/(?:^|\s)(?:1|bir)\s*gun\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (alternatingParts.length >= 2) {
    const firstDose = parseDoseFragment(alternatingParts[0], tabletStrengthMg);
    const secondDose = parseDoseFragment(alternatingParts[1], tabletStrengthMg);
    if (firstDose !== null && secondDose !== null) {
      return { ok: true, cycle: [firstDose, secondDose], source: "alternating" };
    }
  }

  const list = parseTokenList(text, tabletStrengthMg);
  if (list.length > 0) {
    return { ok: true, cycle: list, source: "list" };
  }

  return {
    ok: false,
    error: "Patern cozulemedi. 7 gunluk tabloyu elle doldurabilirsiniz."
  };
}

export function expandPattern(cycle, days = 7) {
  if (!Array.isArray(cycle) || cycle.length === 0) {
    return [];
  }

  return Array.from({ length: days }, (_, index) => cycle[index % cycle.length]);
}

export function sumSchedule(schedule) {
  return schedule.reduce((total, value) => total + Number(value || 0), 0);
}

export function tabletsToMg(tablets, tabletStrengthMg) {
  return Number(tablets) * Number(tabletStrengthMg);
}

function toFixedPercent(value) {
  return value > 0 ? `+%${formatNumber(value, 0)}` : `-%${formatNumber(Math.abs(value), 0)}`;
}

export function buildBalancedSchedule(totalWeeklyTablets, dayCount = 7) {
  const roundedTotal = Math.max(0, roundToStep(totalWeeklyTablets, 0.5));
  const average = roundedTotal / dayCount;
  const low = Math.max(0, Math.floor(average * 2) / 2);
  const high = roundToStep(low + 0.5, 0.5);
  const highCount = Math.round((roundedTotal - low * dayCount) / 0.5);

  if (highCount <= 0) {
    return Array(dayCount).fill(low);
  }

  if (highCount >= dayCount) {
    return Array(dayCount).fill(high);
  }

  const schedule = Array(dayCount).fill(low);
  for (let index = 0; index < highCount; index += 1) {
    const position = Math.floor(((index + 0.5) * dayCount) / highCount);
    schedule[Math.min(position, dayCount - 1)] = high;
  }

  return schedule;
}

function classifyInr(currentInr, target) {
  const lowGap = target.low - currentInr;
  const highGap = currentInr - target.high;

  if (lowGap > 0.5) {
    return "veryLow";
  }

  if (lowGap >= 0.3) {
    return "low";
  }

  if (lowGap > 0) {
    return "slightlyLow";
  }

  if (highGap <= 0) {
    return "inRange";
  }

  if (highGap < 0.3) {
    return "slightlyHigh";
  }

  if (highGap < 0.5) {
    return "mildHigh";
  }

  if (highGap < 1.0) {
    return "high";
  }

  return "veryHigh";
}

function describeStatus(status, target) {
  switch (status) {
    case "veryLow":
      return `hedef altinda belirgin (${target.low - 0.5} altinda)`;
    case "low":
      return "hedef altinda";
    case "slightlyLow":
      return "hedefin hafif altinda";
    case "inRange":
      return "hedef aralikta";
    case "slightlyHigh":
      return "hedefin hafif ustunde";
    case "mildHigh":
      return "hedef ustunde";
    case "high":
      return "hedef ustunde belirgin";
    case "veryHigh":
      return "cok yuksek";
    default:
      return "-";
  }
}

function chooseDoseAdjustment(status, previousStatus, transientFactor) {
  const sameDirectionLow = LOW_STATES.has(status) && LOW_STATES.has(previousStatus);
  const sameDirectionHigh = HIGH_STATES.has(status) && HIGH_STATES.has(previousStatus);
  const previousInRange = previousStatus === "inRange";

  switch (status) {
    case "veryLow":
      if (transientFactor === "low") return 10;
      if (sameDirectionLow) return 20;
      if (previousInRange) return 10;
      return 15;
    case "low":
      if (transientFactor === "low") return 5;
      if (sameDirectionLow) return 15;
      if (previousInRange) return 5;
      return 10;
    case "slightlyLow":
      if (transientFactor === "low" || previousInRange) return 0;
      if (sameDirectionLow) return 10;
      return 5;
    case "inRange":
      return 0;
    case "slightlyHigh":
      if (transientFactor === "high" || previousInRange) return 0;
      if (sameDirectionHigh) return -10;
      return -5;
    case "mildHigh":
      if (transientFactor === "high") return -5;
      if (sameDirectionHigh) return -10;
      return -5;
    case "high":
      if (transientFactor === "high") return -10;
      if (sameDirectionHigh) return -15;
      return -10;
    case "veryHigh":
      if (transientFactor === "high") return -10;
      return -15;
    default:
      return 0;
  }
}

function buildImmediateAction(status, adjustmentPercent, target, currentInr) {
  if (status === "veryLow") {
    return "Bir kerelik 1.5-2 gunluk doz yuklemesi klinik olarak dusunulebilir; sonra asagidaki bakim planina gecilir.";
  }

  if (status === "low") {
    return "Gerekirse bir kerelik 1.5 gunluk doz yuklemesi dusunulebilir; sonra asagidaki bakim planina gecilir.";
  }

  if (status === "slightlyLow") {
    if (adjustmentPercent === 0) {
      return "Mevcut bakim dozu korunabilir; dozu degistirmeden yakin INR kontrolu uygundur.";
    }
    return "Kucuk bir haftalik artis ve yakin INR kontrolu uygundur.";
  }

  if (status === "inRange") {
    return `Mevcut haftalik doz korunur; hedef INR ${target.label} icinde.`;
  }

  if (status === "slightlyHigh") {
    if (adjustmentPercent === 0) {
      return "Tek hafif yukseklikte doz degistirmeden izlem dusunulebilir.";
    }
    return "Kucuk bir haftalik azalis ve yakin INR kontrolu uygundur.";
  }

  if (status === "mildHigh") {
    return "0.5-1 doz atlama klinik olarak dusunulebilir; sonra asagidaki azaltilmis plana gecilir.";
  }

  if (status === "high") {
    return "1 doz atlama dusunulur; sonra asagidaki azaltilmis bakim planina gecilir.";
  }

  if (status === "veryHigh") {
    if (currentInr >= 5) {
      return "Bu esikte otomatik ayaktan doz onerisi durdurulur; yuksek INR yonetimi ve kanama degerlendirmesi gerekir.";
    }
    return "Doz gecici tutulur; INR terapotik araliga yaklasinca azaltilmis bakim planina gecilir.";
  }

  return "-";
}

function chooseNextInrDays(status, previousStatus, adjustmentPercent) {
  switch (status) {
    case "veryLow":
      return 7;
    case "low":
      return 7;
    case "slightlyLow":
      return previousStatus === "inRange" && adjustmentPercent === 0 ? 10 : 7;
    case "inRange":
      return previousStatus === "inRange" ? 28 : 21;
    case "slightlyHigh":
      return previousStatus === "inRange" && adjustmentPercent === 0 ? 10 : 7;
    case "mildHigh":
      return 7;
    case "high":
      return 5;
    case "veryHigh":
      return 2;
    default:
      return 7;
  }
}

function explainAdjustment(status, adjustmentPercent, previousStatus, transientFactor, usedHistory) {
  const reasons = [];

  if (usedHistory) {
    reasons.push("Ara donem gercek kullanim verildigi icin temel doz hesabinda o kullanimdan turetilen haftalik esdeger doz baz alindi.");
  } else {
    reasons.push("Gercek ara donem kullanim girilmedigi icin mevcut 7 gunluk plan temel haftalik doz olarak kullanildi.");
  }

  if (previousStatus === "inRange" && (status === "slightlyLow" || status === "slightlyHigh")) {
    reasons.push("Onceki INR hedefte oldugu ve sapma hafif oldugu icin kilavuzdaki watchful waiting mantigi korundu.");
  } else if (LOW_STATES.has(status) && LOW_STATES.has(previousStatus)) {
    reasons.push("Art arda dusuk yone giden INR oldugu icin ayar bandinin daha yuksek ucu secildi.");
  } else if (HIGH_STATES.has(status) && HIGH_STATES.has(previousStatus)) {
    reasons.push("Art arda yuksek yone giden INR oldugu icin ayar bandinin daha guclu azaltma ucu secildi.");
  }

  if (transientFactor === "low" && LOW_STATES.has(status)) {
    reasons.push("Dusuk INR'yi aciklayabilecek gecici neden isaretlendigi icin kalici haftalik artis daha temkinli tutuldu.");
  }

  if (transientFactor === "high" && HIGH_STATES.has(status)) {
    reasons.push("Yuksek INR'yi aciklayabilecek gecici neden isaretlendigi icin kalici haftalik azalis daha temkinli tutuldu.");
  }

  if (adjustmentPercent === 0) {
    reasons.push("Bu karar, kucuk sapmada dozu sabit tutup tekrar INR bakma secenegini acik bir secenek olarak korur.");
  } else {
    reasons.push(`Bakim dozu karari toplam haftalik dozun ${toFixedPercent(adjustmentPercent)} ayarlanmasi mantigi ile verildi.`);
  }

  return reasons;
}

export function describeSchedule(schedule, tabletStrengthMg) {
  const unique = [...new Set(schedule)];
  if (unique.length === 1) {
    return `Her gun ${formatTablets(unique[0])} tablet (${formatMg(tabletsToMg(unique[0], tabletStrengthMg))})`;
  }

  const dayLines = schedule.map((dose, index) => {
    return `${DAYS[index].short}: ${formatTablets(dose)} tablet`;
  });

  return dayLines.join(" | ");
}

export function analyzeWarfarinCase({
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
}) {
  const target = TARGETS[targetKey] ?? TARGETS.standard;
  const errors = [];

  if (!Number.isFinite(currentInr)) {
    errors.push("Bugunku INR sayisal olmali.");
  }

  if (!Number.isFinite(tabletStrengthMg) || tabletStrengthMg <= 0) {
    errors.push("Tablet gucu sifirdan buyuk olmali.");
  }

  if (!Array.isArray(weeklySchedule) || weeklySchedule.length !== 7) {
    errors.push("Haftalik doz tablosu 7 gun icermeli.");
  }

  const invalidDose = Array.isArray(weeklySchedule)
    ? weeklySchedule.some((dose) => !Number.isFinite(dose) || dose < 0)
    : true;
  if (invalidDose) {
    errors.push("Haftalik doz tablosundaki tum hucreler gecerli doz icermeli.");
  }

  const intervalDays = previousDate ? daysBetween(previousDate, currentDate) : null;
  if (previousDate && currentDate && (intervalDays === null || intervalDays <= 0)) {
    errors.push("Onceki INR tarihi, bugunku tarihten once olmali.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const weeklyDoseTablets = sumSchedule(weeklySchedule);
  let basisWeeklyDoseTablets = weeklyDoseTablets;
  let historySummary = null;
  let usedHistory = false;

  if (intervalPattern && String(intervalPattern).trim()) {
    const parsedHistory = parseDosePattern(intervalPattern, tabletStrengthMg);
    if (parsedHistory.ok) {
      const modeledDays = intervalDays && intervalDays > 0 ? intervalDays : 7;
      const historySchedule = expandPattern(parsedHistory.cycle, modeledDays);
      const historyTotalTablets = sumSchedule(historySchedule);
      basisWeeklyDoseTablets = (historyTotalTablets / modeledDays) * 7;
      usedHistory = true;
      historySummary = {
        modeledDays,
        totalTablets: historyTotalTablets,
        weeklyEquivalentTablets: basisWeeklyDoseTablets
      };
    } else {
      errors.push(parsedHistory.error);
      return { ok: false, errors };
    }
  }

  const currentStatus = classifyInr(currentInr, target);
  const previousStatus = Number.isFinite(previousInr)
    ? classifyInr(previousInr, target)
    : null;

  if (activeBleeding) {
    return {
      ok: true,
      highRisk: true,
      title: "Acil klinik degerlendirme gerekli",
      message:
        "Aktif kanama veya norolojik/gastrointestinal alarm semptomu isaretlendigi icin otomatik ayaktan doz onerisi durduruldu.",
      guidance: [
        "Kanama siddetine gore acil degerlendirme, tersine cevirme ve yatis gereksinimi dusunulmeli.",
        "Bu arac yalnizca kanamasiz bakim dozu ayarlama senaryosu icindir."
      ]
    };
  }

  if (currentInr >= 5) {
    return {
      ok: true,
      highRisk: true,
      title: "Yuksek INR: otomatik oneri sinir disinda",
      message:
        "INR >= 5 oldugu icin program temkinli olarak otomatik bakim plani olusturmayi durdurdu.",
      guidance: [
        "Doz tutma, kanama degerlendirmesi ve yerel yuksek INR protokolu uygulanmali.",
        "CHEST ozeti, kanama yoksa INR 4.5-10 araliginda rutin vitamin K onermemekle birlikte INR > 10 icin oral vitamin K dusunulmesini belirtir."
      ]
    };
  }

  const adjustmentPercent = chooseDoseAdjustment(
    currentStatus,
    previousStatus,
    transientFactor
  );
  const recommendedWeeklyTablets = roundToStep(
    basisWeeklyDoseTablets * (1 + adjustmentPercent / 100),
    0.5
  );
  const recommendedSchedule = buildBalancedSchedule(recommendedWeeklyTablets, 7);
  const nextInrDays = chooseNextInrDays(currentStatus, previousStatus, adjustmentPercent);
  const nextInrDate = currentDate ? addDays(currentDate, nextInrDays) : null;

  return {
    ok: true,
    highRisk: false,
    target,
    currentInr,
    previousInr,
    currentStatus,
    previousStatus,
    basisWeeklyDoseTablets,
    basisWeeklyDoseMg: tabletsToMg(basisWeeklyDoseTablets, tabletStrengthMg),
    currentWeeklyDoseTablets: weeklyDoseTablets,
    currentWeeklyDoseMg: tabletsToMg(weeklyDoseTablets, tabletStrengthMg),
    adjustmentPercent,
    recommendedWeeklyTablets,
    recommendedWeeklyMg: tabletsToMg(recommendedWeeklyTablets, tabletStrengthMg),
    recommendedSchedule,
    immediateAction: buildImmediateAction(
      currentStatus,
      adjustmentPercent,
      target,
      currentInr
    ),
    nextInrDays,
    nextInrDate,
    statusLabel: describeStatus(currentStatus, target),
    historySummary,
    reasons: explainAdjustment(
      currentStatus,
      adjustmentPercent,
      previousStatus,
      transientFactor,
      usedHistory
    )
  };
}
