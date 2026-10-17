import { BottomSheet } from "../ui/BottomSheet";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import type {
  ModelFlowValues,
  PersonalFinancialModelInsights,
} from "./PersonalFinancialModelCard";

interface PersonalFinancialModelSheetProps {
  isOpen: boolean;
  onClose: () => void;
  hideBalance?: boolean;
  actual: ModelFlowValues;
  baseline: ModelFlowValues;
  scenario: ModelFlowValues;
  insights: PersonalFinancialModelInsights;
}

export function PersonalFinancialModelSheet({
  isOpen,
  onClose,
  hideBalance = false,
  actual,
  baseline,
  scenario,
  insights,
}: PersonalFinancialModelSheetProps) {
  const { language } = useLanguage();
  const { formatWithPreferred, currencyMeta } = useCurrency();
  const isIndonesian = language === "id";

  const amount = (value: number, hide: boolean, forceSign = false) => {
    if (hide) return `${currencyMeta?.symbol || "Rp"} ••••••••`;
    if (forceSign) {
      return `${value >= 0 ? "+" : "-"}${formatWithPreferred(Math.abs(value))}`;
    }
    return formatWithPreferred(value);
  };

  const rows: Array<{ key: keyof ModelFlowValues; label: string; negative?: boolean }> = [
    { key: "income", label: isIndonesian ? "Pemasukan" : "Income" },
    {
      key: "committedExpenses",
      label: isIndonesian ? "Beban Rutin (Komitmen)" : "Committed Expenses",
      negative: true,
    },
    {
      key: "variableExpenses",
      label: isIndonesian ? "Beban Fleksibel (Variabel)" : "Variable Expenses",
      negative: true,
    },
    { key: "retainedCash", label: isIndonesian ? "Kas Ditahan" : "Retained Cash" },
    {
      key: "savingsInvestment",
      label: isIndonesian ? "Tabungan / Investasi" : "Savings / Investment",
    },
    { key: "assets", label: isIndonesian ? "Aset" : "Assets" },
    {
      key: "liabilities",
      label: isIndonesian ? "Liabilitas / Utang" : "Liabilities",
      negative: true,
    },
    { key: "netWorth", label: isIndonesian ? "Kekayaan Bersih" : "Net Worth" },
  ];

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-5 pb-12 space-y-4">
        <div>
          <h3 className="font-semibold text-[18px]" style={{ color: "var(--text-primary)" }}>
            {isIndonesian ? "Model Finansial Personal" : "Personal Financial Model"}
          </h3>
          <p className="text-[12px] mt-1" style={{ color: "var(--text-tertiary)" }}>
            {isIndonesian
              ? "Aktual vs Garis Dasar vs Skenario dalam satu model data"
              : "Actual vs Baseline vs Scenario from one data model"}
          </p>
        </div>

        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid var(--glass-border)", background: "var(--bg-elevated)" }}
        >
          <div
            className="grid grid-cols-4 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)", background: "var(--glass-fill)" }}
          >
            <div className="p-2.5">{isIndonesian ? "Arus" : "Flow"}</div>
            <div className="p-2.5 text-right">{isIndonesian ? "Aktual" : "Actual"}</div>
            <div className="p-2.5 text-right">{isIndonesian ? "Garis Dasar" : "Baseline"}</div>
            <div className="p-2.5 text-right">{isIndonesian ? "Skenario" : "Scenario"}</div>
          </div>

          {rows.map((row, idx) => {
            const a = actual[row.key];
            const b = baseline[row.key];
            const s = scenario[row.key];
            return (
              <div
                key={row.key}
                className="grid grid-cols-4 text-[11px]"
                style={{
                  borderTop: idx === 0 ? "none" : "1px solid var(--glass-border)",
                }}
              >
                <div className="p-2.5 font-medium" style={{ color: "var(--text-primary)" }}>
                  {row.label}
                </div>
                <div className="p-2.5 text-right amount" style={{ color: "var(--text-secondary)" }}>
                  {row.negative ? `-${amount(Math.abs(a), hideBalance)}` : amount(a, hideBalance)}
                </div>
                <div className="p-2.5 text-right amount" style={{ color: "var(--text-secondary)" }}>
                  {row.negative ? `-${amount(Math.abs(b), hideBalance)}` : amount(b, hideBalance)}
                </div>
                <div className="p-2.5 text-right amount" style={{ color: "var(--text-primary)" }}>
                  {row.negative ? `-${amount(Math.abs(s), hideBalance)}` : amount(s, hideBalance)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-3 rounded-xl" style={{ background: "var(--glass-fill)" }}>
            <p style={{ color: "var(--text-tertiary)" }}>{isIndonesian ? "Kekayaan Bersih" : "Net Worth"}</p>
            <p className="amount font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
              {amount(insights.currentNetWorth, hideBalance)}
            </p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: "var(--glass-fill)" }}>
            <p style={{ color: "var(--text-tertiary)" }}>{isIndonesian ? "Arus Kas" : "Cashflow"}</p>
            <p className="amount font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
              {amount(insights.currentCashflow, hideBalance, true)}
            </p>
          </div>
        </div>

        <div
          className="p-3.5 rounded-2xl text-[11px] space-y-1.5"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--glass-border)",
            color: "var(--text-secondary)",
          }}
        >
          <p>
            <strong style={{ color: "var(--text-primary)" }}>
              {isIndonesian ? "Tren Historis:" : "Historical Trend:"}
            </strong>{" "}
            {insights.historicalTrendValue}
          </p>
          <p>
            <strong style={{ color: "var(--text-primary)" }}>
              {isIndonesian ? "Garis Dasar Personal:" : "Personal Baseline:"}
            </strong>{" "}
            {insights.personalBaseline}
          </p>
          <p>
            <strong style={{ color: "var(--text-primary)" }}>
              {isIndonesian ? "Komitmen Mendatang:" : "Upcoming Commitments:"}
            </strong>{" "}
            {amount(insights.upcomingCommitments, hideBalance)}
          </p>
          <p>
            <strong style={{ color: "var(--text-primary)" }}>
              {isIndonesian ? "Arah Sasaran (Goals):" : "Goal Trajectory:"}
            </strong>{" "}
            {insights.goalTrajectory}
          </p>
          <p>
            <strong style={{ color: "var(--text-primary)" }}>
              {isIndonesian ? "Dampak Skenario:" : "Scenario Impact:"}
            </strong>{" "}
            {insights.scenarioImpact}
          </p>
        </div>
      </div>
    </BottomSheet>
  );
}
