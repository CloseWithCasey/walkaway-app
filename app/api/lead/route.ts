export const runtime = "nodejs";

import twilio from "twilio";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { Resend } from "resend";

// ========== CONFIGURATION ==========
const EMAIL_SENDER = "Casey Cooke <leads@closewithcasey.org>";

// ========== VALIDATION ==========
function validateLead(body: Record<string, unknown>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!body.name?.toString().trim()) errors.push("Name is required");
  if (!body.email?.toString().trim()) errors.push("Email is required");
  if (!body.phone?.toString().trim()) errors.push("Phone is required");
  if (!body.sqft || Number(body.sqft) <= 0)
    errors.push("Square footage must be > 0");

  return { valid: errors.length === 0, errors };
}

function formatLeadRow(body: Record<string, unknown>): unknown[] {
  return [
    new Date().toISOString(),
    body.name ?? "",
    body.email ?? "",
    body.phone ?? "",
    body.address ?? "",
    body.beds ?? "",
    body.baths ?? "",
    body.sqft ?? "",
    body.condition ?? "",
    body.timeline ?? "",
    body.mortgagePayoff ?? "",
    body.concessions ? "yes" : "no",
    Math.round(Number(body.lowSale ?? 0)),
    Math.round(Number(body.highSale ?? 0)),
    Math.round(Number(body.netLow ?? 0)),
    Math.round(Number(body.netHigh ?? 0)),
  ];
}

function formatEmailHtml(body: Record<string, unknown>): string {
  const netLow = Math.round(Number(body.netLow ?? 0)).toLocaleString();
  const netHigh = Math.round(Number(body.netHigh ?? 0)).toLocaleString();

  return `
    <h2>New Walkaway Lead</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 8px; font-weight: bold;">Name:</td>
        <td style="padding: 8px;">${body.name ?? "—"}</td>
      </tr>
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 8px; font-weight: bold;">Email:</td>
        <td style="padding: 8px;">${body.email ?? "—"}</td>
      </tr>
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 8px; font-weight: bold;">Phone:</td>
        <td style="padding: 8px;">${body.phone ?? "—"}</td>
      </tr>
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 8px; font-weight: bold;">Address:</td>
        <td style="padding: 8px;">${body.address ?? "—"}</td>
      </tr>
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 8px; font-weight: bold;">Sq Ft:</td>
        <td style="padding: 8px;">${body.sqft ?? "—"}</td>
      </tr>
      <tr style="background-color: #f9f9f9;">
        <td style="padding: 8px; font-weight: bold;">Net Range:</td>
        <td style="padding: 8px; font-weight: bold; color: #2d5016;">$${netLow} – $${netHigh}</td>
      </tr>
    </table>
  `;
}

// ========== ENDPOINTS ==========
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate input
    const { valid, errors } = validateLead(body);
    if (!valid) {
      return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
    }

    const sheetId = process.env.GOOGLE_SHEET_ID;
    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    if (!sheetId || !saJson) {
      console.error(
        "Missing env: GOOGLE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_JSON"
      );
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const credentials = JSON.parse(saJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // 1) Save to Sheets (critical path)
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [formatLeadRow(body)],
      },
    });

    console.log(`[LEAD] ${body.email} saved to Sheets`);

    // 2) Send email (non-blocking, failures logged)
    sendEmailAsync(body).catch((err: unknown) => {
      const error = err as { message?: string } | null;
      console.error(
        `[EMAIL] Failed for ${body.email}:`,
        error?.message || err
      );
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const error = err as { message?: string } | null;
    console.error("[API_ERROR]", error?.message || err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

// ========== HELPERS ==========
async function sendEmailAsync(body: Record<string, unknown>): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.NOTIFY_EMAIL;

  if (!resendKey || !notifyEmail) {
    console.warn("[EMAIL] Missing RESEND_API_KEY or NOTIFY_EMAIL");
    return;
  }

  const resend = new Resend(resendKey);

  const { error } = await resend.emails.send({
    from: EMAIL_SENDER,
    to: notifyEmail,
    subject: `New Lead: ${body.name}`,
    html: formatEmailHtml(body),
  });

  if (error) {
    throw error;
  }

  console.log(`[EMAIL] Sent to ${notifyEmail} for ${body.email}`);
}


