"use client";

import { useMemo, useState } from "react";

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

const CONDITION_MULT: Record<Condition, number> = {
  needs_work: 0.92,
  average: 1.0,
  updated: 1.06,
  renovated: 1.1,
};

function money(n: number) {
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

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

  // MVP assumptions (editable anytime)
  const BASELINE_PER_SQFT = 135; // Fort Wayne baseline starter
  const COMMISSION_RATE = 0.055;
  const CLOSE_LOW = 0.015;
  const CLOSE_HIGH = 0.03;
  const CONC_LOW = 0.005;
  const CONC_HIGH = 0.02;

  const calc = useMemo(() => {
    const base = sqftNum * BASELINE_PER_SQFT;
    const adj = base * CONDITION_MULT[s.condition];

    const rangePct = s.condition === "needs_work" ? 0.08 : 0.06;
    const lowSale = adj * (1 - rangePct);
    const highSale = adj * (1 + rangePct);

    const commissionLow = lowSale * COMMISSION_RATE;
    const commissionHigh = highSale * COMMISSION_RATE;

    const closeLowHigh = lowSale * CLOSE_HIGH;
    const closeHighLow = highSale * CLOSE_LOW;

    const concLowHigh = s.concessions ? lowSale * CONC_HIGH : 0;
    const concHighLow = s.concessions ? highSale * CONC_LOW : 0;

    // Net Low uses worst-case costs; Net High uses best-case costs.
    const netLow = lowSale - commissionLow - closeLowHigh - concLowHigh - payoffNum;
    const netHigh = highSale - commissionHigh - closeHighLow - concHighLow - payoffNum;

    return { lowSale, highSale, netLow, netHigh };
  }, [sqftNum, payoffNum, s.condition, s.concessions]);

  const [showLeadForm, setShowLeadForm] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState("");

  async function submitLead() {
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
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to submit.");
      }

      setStatus("sent");
    } catch (e: any) {
      setStatus("error");
      setErr(e?.message || "Something broke.");
    }
  }

  const canCalculate = sqftNum > 0;
  const canSubmit = s.name.trim() && s.email.trim() && s.phone.trim();

  return (
    <main
      style={{
        maxWidth: 780,
        margin: "0 auto",
        padding: 24,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto",
      }}
    >
      <h1 style={{ fontSize: 38, marginBottom: 6 }}>
        What would you actually walk away with if you sold your home?
      </h1>
      <p style={{ marginTop: 0, color: "#444", lineHeight: 1.5 }}>
        This tool shows a <b>realistic range</b> based on typical seller costs — not a fantasy number.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
        <label>
          Address
          <input
            value={s.address}
            onChange={(e) => setS({ ...s, address: e.target.value })}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            placeholder="123 Main St, Fort Wayne, IN"
          />
        </label>

        <label>
          Sq Ft (required)
          <input
            value={s.sqft}
            onChange={(e) => setS({ ...s, sqft: e.target.value })}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            placeholder="e.g. 1650"
          />
        </label>

        <label>
          Beds
          <input
            value={s.beds}
            onChange={(e) => setS({ ...s, beds: e.target.value })}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            placeholder="e.g. 3"
          />
        </label>

        <label>
          Baths
          <input
            value={s.baths}
            onChange={(e) => setS({ ...s, baths: e.target.value })}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            placeholder="e.g. 2"
          />
        </label>

        <label>
          Condition
          <select
            value={s.condition}
            onChange={(e) => setS({ ...s, condition: e.target.value as Condition })}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          >
            <option value="needs_work">Needs work</option>
            <option value="average">Average</option>
            <option value="updated">Updated</option>
            <option value="renovated">Renovated</option>
          </select>
        </label>

        <label>
          Timeline
          <select
            value={s.timeline}
            onChange={(e) => setS({ ...s, timeline: e.target.value as Timeline })}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          >
            <option value="curious">Just curious</option>
            <option value="3_6">3–6 months</option>
            <option value="0_3">0–3 months</option>
          </select>
        </label>

        <label style={{ gridColumn: "1 / span 2" }}>
          Estimated mortgage payoff (optional)
          <input
            value={s.mortgagePayoff}
            onChange={(e) => setS({ ...s, mortgagePayoff: e.target.value })}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            placeholder="Leave blank if unknown"
          />
        </label>

        <label style={{ gridColumn: "1 / span 2", display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={s.concessions}
            onChange={(e) => setS({ ...s, concessions: e.target.checked })}
          />
          Include a typical seller concessions range
        </label>
      </div>

      <div style={{ marginTop: 18, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        {!canCalculate ? (
          <p style={{ margin: 0 }}>Enter square footage to see your range.</p>
        ) : (
          <>
            <h2 style={{ marginTop: 0 }}>Your realistic range</h2>
            <p style={{ margin: "8px 0" }}>
              <b>Estimated sale price:</b> {money(calc.lowSale)} – {money(calc.highSale)}
            </p>
            <p style={{ margin: "8px 0" }}>
              <b>Estimated “walk away with”:</b> {money(calc.netLow)} – {money(calc.netHigh)}
            </p>
            <p style={{ margin: "8px 0", color: "#555" }}>
              Includes typical commission + closing costs{s.concessions ? " + concessions" : ""}
              {payoffNum ? " + your payoff" : ""}.
            </p>

            {!showLeadForm ? (
              <button
                onClick={() => setShowLeadForm(true)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #000",
                  background: "#000",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Send me the full breakdown (text + email)
              </button>
            ) : (
              <div style={{ marginTop: 14 }}>
                <h3 style={{ margin: "0 0 10px" }}>Where should I send it?</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label>
                    Name
                    <input
                      value={s.name}
                      onChange={(e) => setS({ ...s, name: e.target.value })}
                      style={{ width: "100%", padding: 10, marginTop: 6 }}
                    />
                  </label>
                  <label>
                    Email
                    <input
                      value={s.email}
                      onChange={(e) => setS({ ...s, email: e.target.value })}
                      style={{ width: "100%", padding: 10, marginTop: 6 }}
                    />
                  </label>
                  <label style={{ gridColumn: "1 / span 2" }}>
                    Phone (for text)
                    <input
                      value={s.phone}
                      onChange={(e) => setS({ ...s, phone: e.target.value })}
                      style={{ width: "100%", padding: 10, marginTop: 6 }}
                      placeholder="+1..."
                    />
                  </label>
                </div>

                <p style={{ color: "#555", fontSize: 13, marginTop: 10 }}>
                  By submitting, you agree to receive the breakdown by text/email. Reply STOP to opt out.
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
                      marginTop: 8,
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid #000",
                      background: canSubmit ? "#000" : "#777",
                      color: "#fff",
                      cursor: canSubmit ? "pointer" : "not-allowed",
                    }}
                  >
                    {status === "sending" ? "Sending..." : "Send breakdown"}
                  </button>
                )}

                {status === "error" && <p style={{ color: "crimson" }}>{err}</p>}
              </div>
            )}
          </>
        )}
      </div>

      <p style={{ marginTop: 18, color: "#666", fontSize: 13, lineHeight: 1.5 }}>
        This is an estimate range, not an appraisal. Exact outcomes depend on timing, condition, and buyer behavior.
      </p>
    </main>
  );
}
