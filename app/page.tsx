"use client";

import { useMemo, useState, useCallback, CSSProperties } from "react";

// ========== TYPES ==========
type Condition = "needs_work" | "average" | "updated" | "renovated";
type Timeline = "curious" | "3_6" | "0_3";

type FormState = {
  address: string;
  beds: string;
  baths: string;
  sqft: string;
  condition: Condition;
  timeline: Timeline;
  mortgagePayoff: string;
  concessions: boolean;
  name: string;
  email: string;
  phone: string;
};

// ========== CONFIGURATION ==========
const CONDITION_MULT: Record<Condition, number> = {
  needs_work: 0.92,
  average: 1.0,
  updated: 1.06,
  renovated: 1.1,
};

const CALC_CONFIG = {
  BASELINE_PER_SQFT: 135,
  COMMISSION_RATE: 0.055,
  CLOSE_LOW: 0.015,
  CLOSE_HIGH: 0.03,
  CONC_LOW: 0.005,
  CONC_HIGH: 0.02,
  RANGE_NORMAL: 0.06,
  RANGE_NEEDS_WORK: 0.08,
} as const;

// ========== STYLES ==========
const STYLES = {
  main: {
    maxWidth: 780,
    margin: "0 auto",
    padding: 24,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto",
  } as CSSProperties,
  input: {
    width: "100%",
    padding: 10,
    marginTop: 6,
  } as CSSProperties,
  gridContainer: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginTop: 18,
  } as CSSProperties,
  resultBox: {
    marginTop: 18,
    padding: 16,
    border: "1px solid #ddd",
    borderRadius: 12,
  } as CSSProperties,
  button: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #000",
    color: "#fff",
  } as CSSProperties,
  buttonPrimary: {
    background: "#000",
    cursor: "pointer",
  } as CSSProperties,
  buttonDisabled: {
    background: "#777",
    cursor: "not-allowed",
  } as CSSProperties,
  errorText: {
    color: "crimson",
  } as CSSProperties,
  subtleText: {
    color: "#555",
    fontSize: 13,
  } as CSSProperties,
} as const;

// ========== UTILITIES ==========
const money = (n: number): string => {
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
};

const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidPhone = (phone: string): boolean =>
  /^[\d\s+\(\)\-]+$/.test(phone) && phone.replace(/\D/g, "").length >= 10;

// ========== COMPONENTS ==========
interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  span?: boolean;
}

const InputField = ({
  label,
  value,
  onChange,
  placeholder,
  span = false,
}: InputFieldProps) => (
  <label style={span ? { gridColumn: "1 / span 2" } : undefined}>
    {label}
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={STYLES.input}
      placeholder={placeholder}
    />
  </label>
);

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

const SelectField = ({
  label,
  value,
  onChange,
  options,
}: SelectFieldProps) => (
  <label>
    {label}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={STYLES.input}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </label>
);

// ========== MAIN COMPONENT ==========
export default function Home() {
  const [s, setS] = useState<FormState>({
    address: "",
    beds: "",
    baths: "",
    sqft: "",
    condition: "average",
    timeline: "curious",
    mortgagePayoff: "",
    concessions: false,
    name: "",
    email: "",
    phone: "",
  });

  const sqftNum = Number(s.sqft || 0);
  const payoffNum = Number(s.mortgagePayoff || 0);

  const calc = useMemo(() => {
    const base = sqftNum * CALC_CONFIG.BASELINE_PER_SQFT;
    const adj = base * CONDITION_MULT[s.condition];

    const rangePct =
      s.condition === "needs_work"
        ? CALC_CONFIG.RANGE_NEEDS_WORK
        : CALC_CONFIG.RANGE_NORMAL;
    const lowSale = adj * (1 - rangePct);
    const highSale = adj * (1 + rangePct);

    const commissionLow = lowSale * CALC_CONFIG.COMMISSION_RATE;
    const commissionHigh = highSale * CALC_CONFIG.COMMISSION_RATE;

    const closeLowHigh = lowSale * CALC_CONFIG.CLOSE_HIGH;
    const closeHighLow = highSale * CALC_CONFIG.CLOSE_LOW;

    const concLowHigh = s.concessions ? lowSale * CALC_CONFIG.CONC_HIGH : 0;
    const concHighLow = s.concessions ? highSale * CALC_CONFIG.CONC_LOW : 0;

    const netLow =
      lowSale - commissionLow - closeLowHigh - concLowHigh - payoffNum;
    const netHigh =
      highSale - commissionHigh - closeHighLow - concHighLow - payoffNum;

    return { lowSale, highSale, netLow, netHigh };
  }, [sqftNum, payoffNum, s.condition, s.concessions]);

  const [showLeadForm, setShowLeadForm] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [err, setErr] = useState("");

  const submitLead = useCallback(async () => {
    setStatus("sending");
    setErr("");

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...s,
          lowSale: calc.lowSale,
          highSale: calc.highSale,
          netLow: calc.netLow,
          netHigh: calc.netHigh,
        }),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        throw new Error((j?.error as string) || "Failed to submit.");
      }

      setStatus("sent");
    } catch (e: unknown) {
      setStatus("error");
      const error = e as { message?: string } | null;
      setErr(error?.message || "Something broke.");
    }
  }, [s, calc]);

  const canCalculate = sqftNum > 0;
  const canSubmit =
    s.name.trim() && isValidEmail(s.email) && isValidPhone(s.phone);

  const conditionOptions: Array<{ value: string; label: string }> = [
    { value: "needs_work", label: "Needs work" },
    { value: "average", label: "Average" },
    { value: "updated", label: "Updated" },
    { value: "renovated", label: "Renovated" },
  ];

  const timelineOptions: Array<{ value: string; label: string }> = [
  { value: "curious", label: "Just curious" },
  { value: "3_6", label: "3–6 months" },
  { value: "0_3", label: "0–3 months" },
];


  return (
    <main style={STYLES.main}>
      <h1 style={{ fontSize: 38, marginBottom: 6 }}>
        What would you actually walk away with if you sold your home?
      </h1>
      <p style={{ marginTop: 0, color: "#444", lineHeight: 1.5 }}>
  This tool shows a <b>realistic range</b> based on typical seller costs — not a
  fantasy number.
</p>

      <div style={STYLES.gridContainer}>
        <InputField
          label="Address"
          value={s.address}
          onChange={(value) => setS({ ...s, address: value })}
          placeholder="123 Main St, Fort Wayne, IN"
        />

        <InputField
          label="Sq Ft (required)"
          value={s.sqft}
          onChange={(value) => setS({ ...s, sqft: value })}
          placeholder="e.g. 1650"
        />

        <InputField
          label="Beds"
          value={s.beds}
          onChange={(value) => setS({ ...s, beds: value })}
          placeholder="e.g. 3"
        />

        <InputField
          label="Baths"
          value={s.baths}
          onChange={(value) => setS({ ...s, baths: value })}
          placeholder="e.g. 2"
        />

        <SelectField
          label="Condition"
          value={s.condition}
          onChange={(value) => setS({ ...s, condition: value as Condition })}
          options={conditionOptions}
        />

        <SelectField
          label="Timeline"
          value={s.timeline}
          onChange={(value) => setS({ ...s, timeline: value as Timeline })}
          options={timelineOptions}
        />

        <InputField
          label="Estimated mortgage payoff (optional)"
          value={s.mortgagePayoff}
          onChange={(value) => setS({ ...s, mortgagePayoff: value })}
          placeholder="Leave blank if unknown"
          span
        />

        <label style={{ gridColumn: "1 / span 2", display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={s.concessions}
            onChange={(e) => setS({ ...s, concessions: e.target.checked })}
          />
          Include a typical seller concessions range
        </label>
      </div>

      <div style={STYLES.resultBox}>
        {!canCalculate ? (
          <p style={{ margin: 0 }}>Enter square footage to see your range.</p>
        ) : (
          <>
            <h2 style={{ marginTop: 0 }}>Your realistic range</h2>
            <p style={{ margin: "8px 0" }}>
              <b>Estimated sale price:</b> {money(calc.lowSale)} &ndash;{" "}
              {money(calc.highSale)}
            </p>
            <p style={{ margin: "8px 0" }}>
              <b>Estimated &ldquo;walk away with&rdquo;:</b> {money(calc.netLow)} &ndash;{" "}
              {money(calc.netHigh)}
            </p>
            <p style={STYLES.subtleText}>
              Includes typical commission + closing costs
              {s.concessions ? " + concessions" : ""}
              {payoffNum ? " + your payoff" : ""}.
            </p>

            {!showLeadForm ? (
              <button
                onClick={() => setShowLeadForm(true)}
                style={{
                  ...STYLES.button,
                  ...STYLES.buttonPrimary,
                }}
              >
                Send me the full breakdown (text + email)
              </button>
            ) : (
              <div style={{ marginTop: 14 }}>
                <h3 style={{ margin: "0 0 10px" }}>Where should I send it?</h3>
                <div style={STYLES.gridContainer}>
                  <InputField
                    label="Name"
                    value={s.name}
                    onChange={(value) => setS({ ...s, name: value })}
                  />
                  <InputField
                    label="Email"
                    value={s.email}
                    onChange={(value) => setS({ ...s, email: value })}
                  />
                  <InputField
                    label="Phone (for text)"
                    value={s.phone}
                    onChange={(value) => setS({ ...s, phone: value })}
                    placeholder="+1..."
                    span
                  />
                </div>

                <p style={STYLES.subtleText}>
                  By submitting, you agree to receive the breakdown by
                  text/email. Reply STOP to opt out.
                </p>

                {status === "sent" ? (
                  <p style={{ marginTop: 10 }}>
                    <b>Sent.</b> Check your text + inbox.
                  </p>
                ) : (
                  <button
                    onClick={submitLead}
                    disabled={!canSubmit || status === "sending"}
                    style={{
                      ...STYLES.button,
                      marginTop: 8,
                      ...(canSubmit
                        ? STYLES.buttonPrimary
                        : STYLES.buttonDisabled),
                    }}
                  >
                    {status === "sending" ? "Sending..." : "Send breakdown"}
                  </button>
                )}

                {status === "error" && (
                  <p style={STYLES.errorText}>{err}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <p
        style={{
          marginTop: 18,
          color: "#666",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        This is an estimate range, not an appraisal. Exact outcomes depend on
        timing, condition, and buyer behavior.
        By submitting this form, you agree to receive your requested home value
        estimate by text message. Message frequency is limited. Reply STOP to opt out.
      </p>
    </main>
  );
}
