/**
 * Monte Carlo & FIRE (Financial Independence, Retire Early) Stochastic Simulation Engine
 * 
 * Implements Geometric Brownian Motion with lognormal monthly return distributions,
 * computing multi-percentile confidence bands (P10, P25, P50, P75, P90),
 * Sequence of Returns Risk (SORR) stress shocks, and FIRE milestone projections.
 */

export interface MonteCarloConfig {
  initialNetWorth: number;
  monthlyContribution: number;
  annualExpenses: number;
  years?: number; // default 20
  expectedAnnualReturn?: number; // e.g. 0.085 for 8.5%
  annualVolatility?: number; // e.g. 0.15 for 15%
  annualInflation?: number; // e.g. 0.035 for 3.5%
  safeWithdrawalRate?: number; // e.g. 0.04 for 4%
  iterations?: number; // default 1000
  earlyShock?: boolean; // simulates a -25% market crash in Year 1
  language?: "en" | "id";
}

export interface YearlyPercentiles {
  year: number;
  p10: number; // Bear / Stress scenario
  p25: number;
  p50: number; // Median / Most probable scenario
  p75: number;
  p90: number; // Bull / Optimistic scenario
  fireTarget: number;
}

export interface FireMilestone {
  type: "lean" | "standard" | "fat" | "coast";
  label: string;
  description: string;
  targetAmount: number;
  currentProgressPct: number;
  isAchieved: boolean;
  estimatedYearsMedian: number | null; // null if not achieved within horizon
  estimatedYearsBear: number | null;
  estimatedYearsBull: number | null;
}

export interface MonteCarloSimulationResult {
  config: Required<MonteCarloConfig>;
  yearlyTrajectory: YearlyPercentiles[];
  terminalValues: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  fireMilestones: {
    lean: FireMilestone;
    standard: FireMilestone;
    fat: FireMilestone;
    coast: FireMilestone;
  };
  successRate: number; // 0 - 100 (%)
  resilienceRating: "Exceptional" | "High Resilience" | "Moderate" | "Vulnerable" | "Critical";
  sequenceOfReturnsImpact: {
    terminalDifference: number;
    terminalPercentageLoss: number;
  } | null;
  cashBufferRecommendation: CashBufferRecommendation;
  savingsAccelerationLevers: SavingsAccelerationLevers;
  insights: string[];
}

export interface CashBufferRecommendation {
  monthsMin: number;
  monthsMax: number;
  amountMin: number;
  amountMax: number;
  currentCoverageMonths: number;
  adequacyStatus: "Optimal" | "Adequate" | "Deficit";
  recommendationText: string;
}

export interface AccelerationLeverItem {
  percentageChange: number;
  adjustedMonthlySavings: number;
  adjustedTimelineYears: number | null;
  yearsSaved: number;
  monthlySavingsDiff: number;
}

export interface SavingsAccelerationLevers {
  baseTimelineYears: number | null;
  tier15Pct: AccelerationLeverItem;
  tier30Pct: AccelerationLeverItem;
  expenseCut10Pct: {
    reducedMonthlyBurn: number;
    newFireTarget: number;
    fireTargetReduction: number;
    adjustedMonthlySavings: number;
    adjustedTimelineYears: number | null;
    yearsSaved: number;
  };
}

/**
 * Box-Muller transform producing two standard normal variates N(0, 1)
 */
function generateStandardNormal(): number {
  let u1 = 0;
  let u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Runs a 1,000-path Monte Carlo stochastic simulation over the specified horizon.
 */
export function runMonteCarloSimulation(
  rawConfig: MonteCarloConfig
): MonteCarloSimulationResult {
  const config: Required<MonteCarloConfig> = {
    initialNetWorth: Math.max(0, rawConfig.initialNetWorth),
    monthlyContribution: Math.max(0, rawConfig.monthlyContribution),
    annualExpenses: Math.max(1000000, rawConfig.annualExpenses),
    years: Math.min(40, Math.max(5, rawConfig.years ?? 20)),
    expectedAnnualReturn: Math.max(0.01, Math.min(0.30, rawConfig.expectedAnnualReturn ?? 0.085)),
    annualVolatility: Math.max(0.01, Math.min(0.50, rawConfig.annualVolatility ?? 0.15)),
    annualInflation: Math.max(0.0, Math.min(0.20, rawConfig.annualInflation ?? 0.035)),
    safeWithdrawalRate: Math.max(0.02, Math.min(0.10, rawConfig.safeWithdrawalRate ?? 0.04)),
    iterations: Math.min(2500, Math.max(100, rawConfig.iterations ?? 1000)),
    earlyShock: Boolean(rawConfig.earlyShock),
    language: rawConfig.language ?? "en",
  };

  const {
    initialNetWorth,
    monthlyContribution,
    annualExpenses,
    years,
    expectedAnnualReturn,
    annualVolatility,
    annualInflation,
    safeWithdrawalRate,
    iterations,
    earlyShock,
  } = config;

  // Real annualized return adjusting for inflation
  const realAnnualReturn = (1 + expectedAnnualReturn) / (1 + annualInflation) - 1;

  // Monthly parameters for Geometric Brownian Motion
  const monthlyDrift = (Math.log(1 + realAnnualReturn) - 0.5 * annualVolatility * annualVolatility) / 12;
  const monthlyVol = annualVolatility / Math.sqrt(12);

  // Pre-allocate paths matrix: [iteration][year]
  const paths: number[][] = Array.from({ length: iterations }, () =>
    new Array(years + 1).fill(0)
  );

  // Set Year 0
  for (let i = 0; i < iterations; i++) {
    paths[i][0] = initialNetWorth;
  }

  // Simulate monthly compounding across all iterations
  for (let i = 0; i < iterations; i++) {
    let currentCapital = initialNetWorth;

    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) {
        const z = generateStandardNormal();
        const monthlyReturn = Math.exp(monthlyDrift + monthlyVol * z) - 1;

        // Apply Sequence of Returns Risk shock in Year 1 if earlyShock is active
        let adjustedReturn = monthlyReturn;
        if (earlyShock && y === 1 && m === 6) {
          adjustedReturn = -0.25; // 25% single-month market drawdown
        }

        currentCapital = Math.max(
          0,
          (currentCapital + monthlyContribution) * (1 + adjustedReturn)
        );
      }
      paths[i][y] = currentCapital;
    }
  }

  // FIRE Milestones Numbers
  const standardFireTarget = Math.round(annualExpenses / safeWithdrawalRate);
  const leanFireTarget = Math.round(standardFireTarget * 0.7);
  const fatFireTarget = Math.round(standardFireTarget * 1.4);
  const coastFireTarget = Math.round(
    standardFireTarget / Math.pow(1 + Math.max(0.01, realAnnualReturn), years)
  );

  // Compute Percentile Trajectory per year
  const yearlyTrajectory: YearlyPercentiles[] = [];

  for (let y = 0; y <= years; y++) {
    const valuesAtYear = paths.map((p) => p[y]).sort((a, b) => a - b);

    const p10 = getPercentile(valuesAtYear, 10);
    const p25 = getPercentile(valuesAtYear, 25);
    const p50 = getPercentile(valuesAtYear, 50);
    const p75 = getPercentile(valuesAtYear, 75);
    const p90 = getPercentile(valuesAtYear, 90);

    yearlyTrajectory.push({
      year: y,
      p10,
      p25,
      p50,
      p75,
      p90,
      fireTarget: standardFireTarget,
    });
  }

  // Terminal values
  const terminalValues = {
    p10: yearlyTrajectory[years].p10,
    p25: yearlyTrajectory[years].p25,
    p50: yearlyTrajectory[years].p50,
    p75: yearlyTrajectory[years].p75,
    p90: yearlyTrajectory[years].p90,
  };

  // Helper to find estimated year when a percentile hits a target
  const findYearThreshold = (percentileKey: "p10" | "p50" | "p90", target: number): number | null => {
    if (initialNetWorth >= target) return 0;
    for (let y = 1; y <= years; y++) {
      if (yearlyTrajectory[y][percentileKey] >= target) {
        // Interpolate fractional year for smoother estimate
        const prev = yearlyTrajectory[y - 1][percentileKey];
        const curr = yearlyTrajectory[y][percentileKey];
        if (curr === prev) return y;
        const frac = Math.max(0, Math.min(1, (target - prev) / (curr - prev)));
        return Number((y - 1 + frac).toFixed(1));
      }
    }
    return null;
  };

  const isId = rawConfig.language === "id";

  // Milestone objects
  const leanMilestone: FireMilestone = {
    type: "lean",
    label: "Lean FIRE",
    description: isId
      ? "Mencakup kebutuhan pokok esensial (70% dari pengeluaran saat ini)."
      : "Covers essential baseline living expenses (70% of current spend).",
    targetAmount: leanFireTarget,
    currentProgressPct: Math.min(100, Number(((initialNetWorth / leanFireTarget) * 100).toFixed(1))),
    isAchieved: initialNetWorth >= leanFireTarget,
    estimatedYearsMedian: findYearThreshold("p50", leanFireTarget),
    estimatedYearsBear: findYearThreshold("p10", leanFireTarget),
    estimatedYearsBull: findYearThreshold("p90", leanFireTarget),
  };

  const standardMilestone: FireMilestone = {
    type: "standard",
    label: "Standard FIRE",
    description: isId
      ? "Kemandirian finansial penuh mempertahankan 100% gaya hidup saat ini."
      : "Full financial independence maintaining 100% of current lifestyle.",
    targetAmount: standardFireTarget,
    currentProgressPct: Math.min(100, Number(((initialNetWorth / standardFireTarget) * 100).toFixed(1))),
    isAchieved: initialNetWorth >= standardFireTarget,
    estimatedYearsMedian: findYearThreshold("p50", standardFireTarget),
    estimatedYearsBear: findYearThreshold("p10", standardFireTarget),
    estimatedYearsBull: findYearThreshold("p90", standardFireTarget),
  };

  const fatMilestone: FireMilestone = {
    type: "fat",
    label: "Fat FIRE",
    description: isId
      ? "Memberikan ruang kemewahan, perjalanan internasional, dan dana cadangan melimpah (140%)."
      : "Affords luxury buffer, international travel, and generous contingencies (140%).",
    targetAmount: fatFireTarget,
    currentProgressPct: Math.min(100, Number(((initialNetWorth / fatFireTarget) * 100).toFixed(1))),
    isAchieved: initialNetWorth >= fatFireTarget,
    estimatedYearsMedian: findYearThreshold("p50", fatFireTarget),
    estimatedYearsBear: findYearThreshold("p10", fatFireTarget),
    estimatedYearsBull: findYearThreshold("p90", fatFireTarget),
  };

  const coastMilestone: FireMilestone = {
    type: "coast",
    label: "Coast FIRE",
    description: isId
      ? "Modal yang dibutuhkan hari ini untuk tumbuh menjadi Standard FIRE pada akhir horizon tanpa tambahan tabungan."
      : "Capital needed today to compound into Standard FIRE by horizon without more savings.",
    targetAmount: coastFireTarget,
    currentProgressPct: Math.min(100, Number(((initialNetWorth / coastFireTarget) * 100).toFixed(1))),
    isAchieved: initialNetWorth >= coastFireTarget,
    estimatedYearsMedian: initialNetWorth >= coastFireTarget ? 0 : null,
    estimatedYearsBear: null,
    estimatedYearsBull: null,
  };

  // Success Rate Calculation
  // Success is defined as either:
  // 1) Reaching the Standard FIRE target at or before terminal year, OR
  // 2) Terminal capital >= Standard FIRE Target
  let successCount = 0;
  for (let i = 0; i < iterations; i++) {
    const hasReached = paths[i].some((val) => val >= standardFireTarget);
    if (hasReached || paths[i][years] >= standardFireTarget) {
      successCount++;
    }
  }
  const successRate = Math.round((successCount / iterations) * 100);

  // Resilience Rating
  let resilienceRating: MonteCarloSimulationResult["resilienceRating"] = "Moderate";
  if (successRate >= 90) resilienceRating = "Exceptional";
  else if (successRate >= 75) resilienceRating = "High Resilience";
  else if (successRate >= 50) resilienceRating = "Moderate";
  else if (successRate >= 25) resilienceRating = "Vulnerable";
  else resilienceRating = "Critical";

  // Sequence of Returns Risk shock assessment
  let sequenceOfReturnsImpact: MonteCarloSimulationResult["sequenceOfReturnsImpact"] = null;
  if (earlyShock) {
    // Run an un-shocked baseline simulation with identical parameters for comparison
    const unshocked = runMonteCarloSimulation({
      ...rawConfig,
      earlyShock: false,
    });
    const diff = unshocked.terminalValues.p50 - terminalValues.p50;
    const pct = unshocked.terminalValues.p50 > 0 ? (diff / unshocked.terminalValues.p50) * 100 : 0;
    sequenceOfReturnsImpact = {
      terminalDifference: diff,
      terminalPercentageLoss: Number(pct.toFixed(1)),
    };
  }

  // Generate actionable, plain English insights
  const insights: string[] = [];

  if (standardMilestone.isAchieved) {
    insights.push(
      isId
        ? "Kekayaan bersih Anda saat ini telah melampaui angka Standard FIRE. Fokus utama Anda adalah pelestarian modal dan distribusi yang efisien pajak."
        : "Your current net worth already surpasses your Standard FIRE number. Your primary focus is capital preservation and optimal tax-efficient distribution."
    );
  } else if (standardMilestone.estimatedYearsMedian !== null) {
    insights.push(
      isId
        ? `Pada tingkat tabungan Anda saat ini, Anda diproyeksikan mencapai Kemandirian Finansial penuh dalam sekitar ${standardMilestone.estimatedYearsMedian} tahun dalam kondisi pasar yang diharapkan.`
        : `At your current savings rate, you are projected to reach full Financial Independence in approximately ${standardMilestone.estimatedYearsMedian} years in expected market conditions.`
    );
  } else {
    insights.push(
      isId
        ? `Berdasarkan tingkat kontribusi saat ini, pencapaian Standard FIRE melampaui horizon ${years} tahun. Meningkatkan tabungan bulanan sebesar 20% akan mempercepat garis waktu ini secara signifikan.`
        : `Under current contribution levels, achieving Standard FIRE extends beyond the ${years}-year horizon. Boosting monthly savings by 20% would dramatically compress this timeline.`
    );
  }

  if (terminalValues.p10 > 0) {
    insights.push(
      isId
        ? "Dalam pasar bear persentil ke-10 yang konservatif, modal akhir Anda mempertahankan solvabilitas struktural yang kuat, membuktikan ketahanan tinggi terhadap stagnasi pasar yang berkepanjangan."
        : "In a conservative 10th-percentile bear market, your terminal capital retains strong structural solvency, evidencing high resilience against prolonged market stagnation."
    );
  } else {
    insights.push(
      isId
        ? "Dalam pasar bear yang parah, penurunan modal mungkin terjadi sebelum akhir horizon. Pertimbangkan untuk mendiversifikasi kelas aset untuk menekan volatilitas."
        : "In a severe bear market, capital depletion is possible before the horizon. Consider diversifying asset classes to curtail volatility."
    );
  }

  if (coastMilestone.isAchieved) {
    insights.push(
      isId
        ? "Anda telah mencapai Coast FIRE. Bahkan jika Anda menghentikan kontribusi pensiun mulai hari ini, saldo yang ada diproyeksikan akan berkembang menjadi target FIRE penuh Anda."
        : "You have achieved Coast FIRE. Even if you pause further retirement contributions today, your existing balance is projected to compound into your full FIRE number."
    );
  }

  // Cash buffer recommendation for SORR mitigation
  const cashBufferRecommendation = calculateCashBufferRecommendation({
    annualExpenses: config.annualExpenses,
    currentNetWorth: config.initialNetWorth,
    language: config.language,
  });

  // Dynamic savings acceleration levers
  const netRealReturn = Math.max(0.01, config.expectedAnnualReturn - config.annualInflation);
  const savingsAccelerationLevers = calculateSavingsAccelerationLevers({
    initialNetWorth: config.initialNetWorth,
    annualExpenses: config.annualExpenses,
    monthlyContribution: config.monthlyContribution,
    safeWithdrawalRate: config.safeWithdrawalRate,
    netRealReturn,
  });

  return {
    config,
    yearlyTrajectory,
    terminalValues,
    fireMilestones: {
      lean: leanMilestone,
      standard: standardMilestone,
      fat: fatMilestone,
      coast: coastMilestone,
    },
    successRate,
    resilienceRating,
    sequenceOfReturnsImpact,
    cashBufferRecommendation,
    savingsAccelerationLevers,
    insights,
  };
}

/**
 * Calculates projected years to reach target capital under constant real return
 */
export function calculateTimelineYears(
  capital: number,
  target: number,
  monthlySavings: number,
  realReturn: number,
  maxYears = 40
): number | null {
  if (capital >= target) return 0;
  const annualSavings = monthlySavings * 12;
  if (annualSavings <= 0 && realReturn <= 0) return null;

  let bal = capital;
  for (let yr = 1; yr <= maxYears; yr++) {
    bal = (bal + annualSavings) * (1 + realReturn);
    if (bal >= target) return yr;
  }
  return null;
}

/**
 * Calculates recommended liquid cash buffer (18-24 months of essential burn)
 * to neutralize Sequence of Returns Risk (SORR) in early retirement.
 */
export function calculateCashBufferRecommendation({
  annualExpenses,
  currentNetWorth,
  language = "en",
}: {
  annualExpenses: number;
  currentNetWorth: number;
  language?: "en" | "id";
}): CashBufferRecommendation {
  const monthlyBurn = Math.max(1, annualExpenses / 12);
  const amountMin = Math.round(monthlyBurn * 18);
  const amountMax = Math.round(monthlyBurn * 24);
  const currentCoverageMonths = Number((currentNetWorth / monthlyBurn).toFixed(1));

  let adequacyStatus: CashBufferRecommendation["adequacyStatus"] = "Deficit";
  if (currentCoverageMonths >= 24) adequacyStatus = "Optimal";
  else if (currentCoverageMonths >= 12) adequacyStatus = "Adequate";

  const isId = language === "id";
  const recommendationText = isId
    ? adequacyStatus === "Optimal"
      ? `Ketahanan likuiditas prima (${currentCoverageMonths} bulan pengeluaran). Dana penyangga melebihi batas aman 24 bulan untuk mitigasi krisis pasar dini.`
      : adequacyStatus === "Adequate"
        ? `Cakupan likuiditas cukup (${currentCoverageMonths} bulan). Disarankan menambah cadangan hingga 18–24 bulan pengeluaran sebelum memasuki fase penarikan.`
        : `Defisit dana penyangga (${currentCoverageMonths} bulan). Sangat disarankan mengamankan 18–24 bulan biaya hidup dalam instrumen pasar uang bebas risiko.`
    : adequacyStatus === "Optimal"
      ? `Prime liquidity resilience (${currentCoverageMonths} months of burn). Reserves exceed the 24-month threshold protecting against Sequence of Returns shocks.`
      : adequacyStatus === "Adequate"
        ? `Adequate liquidity buffer (${currentCoverageMonths} months). Expanding reserves to 18–24 months before retirement drawdown is recommended.`
        : `Buffer deficit (${currentCoverageMonths} months). Storing 18–24 months of essential expenses in risk-free liquid cash is strongly advised to prevent selling in a downturn.`;

  return {
    monthsMin: 18,
    monthsMax: 24,
    amountMin,
    amountMax,
    currentCoverageMonths,
    adequacyStatus,
    recommendationText,
  };
}

/**
 * Computes savings acceleration levers (+15% savings, +30% savings, -10% burn rate)
 */
export function calculateSavingsAccelerationLevers({
  initialNetWorth,
  annualExpenses,
  monthlyContribution,
  safeWithdrawalRate = 0.04,
  netRealReturn = 0.06,
}: {
  initialNetWorth: number;
  annualExpenses: number;
  monthlyContribution: number;
  safeWithdrawalRate?: number;
  netRealReturn?: number;
}): SavingsAccelerationLevers {
  const standardFireTarget = Math.round(annualExpenses / safeWithdrawalRate);
  const baseTimeline = calculateTimelineYears(
    initialNetWorth,
    standardFireTarget,
    monthlyContribution,
    netRealReturn
  );

  // Tier 15%
  const savings15 = Math.round(monthlyContribution * 1.15);
  const timeline15 = calculateTimelineYears(
    initialNetWorth,
    standardFireTarget,
    savings15,
    netRealReturn
  );
  const diff15 = Math.round(monthlyContribution * 0.15);
  const yearsSaved15 =
    baseTimeline !== null && timeline15 !== null
      ? Math.max(0, baseTimeline - timeline15)
      : 0;

  // Tier 30%
  const savings30 = Math.round(monthlyContribution * 1.30);
  const timeline30 = calculateTimelineYears(
    initialNetWorth,
    standardFireTarget,
    savings30,
    netRealReturn
  );
  const diff30 = Math.round(monthlyContribution * 0.30);
  const yearsSaved30 =
    baseTimeline !== null && timeline30 !== null
      ? Math.max(0, baseTimeline - timeline30)
      : 0;

  // Expense Cut 10%
  const monthlyBurn = annualExpenses / 12;
  const reducedMonthlyBurn = Math.round(monthlyBurn * 0.90);
  const newAnnualExpenses = reducedMonthlyBurn * 12;
  const newFireTarget = Math.round(newAnnualExpenses / safeWithdrawalRate);
  const fireTargetReduction = standardFireTarget - newFireTarget;
  const monthlySavingsDiffFromExpense = Math.round(monthlyBurn * 0.10);
  const adjustedSavingsWithCut = monthlyContribution + monthlySavingsDiffFromExpense;
  const timelineCut = calculateTimelineYears(
    initialNetWorth,
    newFireTarget,
    adjustedSavingsWithCut,
    netRealReturn
  );
  const yearsSavedCut =
    baseTimeline !== null && timelineCut !== null
      ? Math.max(0, baseTimeline - timelineCut)
      : 0;

  return {
    baseTimelineYears: baseTimeline,
    tier15Pct: {
      percentageChange: 15,
      adjustedMonthlySavings: savings15,
      adjustedTimelineYears: timeline15,
      yearsSaved: yearsSaved15,
      monthlySavingsDiff: diff15,
    },
    tier30Pct: {
      percentageChange: 30,
      adjustedMonthlySavings: savings30,
      adjustedTimelineYears: timeline30,
      yearsSaved: yearsSaved30,
      monthlySavingsDiff: diff30,
    },
    expenseCut10Pct: {
      reducedMonthlyBurn,
      newFireTarget,
      fireTargetReduction,
      adjustedMonthlySavings: adjustedSavingsWithCut,
      adjustedTimelineYears: timelineCut,
      yearsSaved: yearsSavedCut,
    },
  };
}

/**
 * Percentile helper for an ascending sorted array
 */
function getPercentile(sortedArr: number[], percentile: number): number {
  if (sortedArr.length === 0) return 0;
  const index = (percentile / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return Math.round(sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight);
}
