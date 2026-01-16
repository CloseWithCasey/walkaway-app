export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { Resend } from "resend";
import twilio from "twilio";

type LeadBody = {
  address?: string;
  beds?: string;
  baths?: string;
  sqft?: string;
  condition?: string;
  timeline?: string;
  mortgagePayoff?: string;
  concessions?: boolean;
  name?: string;
  email?: string;
  phone?: string;
  lowSale?: number;
  highSale?: number;
  netLow?: number;
  netHigh?: number;
};

function digitsOnly(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

function toUSPhoneE164(phone: unknown): string {
  const d = digitsOnly(phone);
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (d.length >= 10) return `+1${d.slice(-10)}`;
  return "";
}

function money(n: unknown): string {
  const num = Number(n);
  if (!Number.isFinite(num)) return "$0";
  return num.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LeadBody;

    // ---------------------------
    // 1) GOOGLE SHEETS (always)
    // ---------------------------
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    if (!sheetId || !saJson) {
      return NextResponse.json(
        { error: "Missing GOOGLE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_JSON" },
        { status: 500 }
      );
    }

    const credentials = JSON.parse(saJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
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
            body.lowSale ?? "",
            body.highSale ?? "",
            body.netLow ?? "",
            body.netHigh ?? "",
          ],
        ],
      },
    });

    console.log(
      `[LEAD] ${(body.email ?? "no-email").toString()} saved to Sheets`
    );

    // ---------------------------
    // 2) EMAIL (Resend) - notify you
    // ---------------------------
    const resendKey = process.env.RESEND_API_KEY;
    const notifyEmail = process.env.NOTIFY_EMAIL;

    if (resendKey && notifyEmail) {
      try {
        const resend = new Resend(resendKey);

        const { data, error } = await resend.emails.send({
          from: "Casey Cooke <leads@closewithcasey.org>",
          to: notifyEmail,
          subject: "New Walkaway Lead Submitted",
          html: `
            <h2>New Walkaway Lead</h2>
            <p><strong>Name:</strong> ${body.name ?? ""}</p>
            <p><strong>Email:</strong> ${body.email ?? ""}</p>
            <p><strong>Phone:</strong> ${body.phone ?? ""}</p>
            <p><strong>Address:</strong> ${body.address ?? ""}</p>
            <p><strong>Net Range:</strong> ${money(body.netLow)} – ${money(
            body.netHigh
          )}</p>
          `,
        });

        if (error) {
          console.error("[EMAIL] error:", error);
        } else {
          console.log(
            `[EMAIL] Sent to ${notifyEmail} for ${(body.email ?? "no-email").toString()}`
          );
          console.log("[EMAIL] id:", data?.id);
        }
      } catch (e: any) {
        console.error("[EMAIL] exception:", e?.message || e);
      }
    } else {
      console.log("[EMAIL] skipped (missing RESEND_API_KEY or NOTIFY_EMAIL)");
    }

    // ---------------------------
    // 3) SMS (Twilio) - text the lead
    // ---------------------------
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_FROM_NUMBER;

    const toNumber = toUSPhoneE164(body.phone);

    console.log("[TWILIO] check", {
      hasSid: !!twilioSid,
      hasToken: !!twilioToken,
      hasFrom: !!twilioFrom,
      toNumber: toNumber || "INVALID",
    });

    if (twilioSid && twilioToken && twilioFrom && toNumber) {
      try {
        const client = twilio(twilioSid, twilioToken);

        const msg = await client.messages.create({
          from: twilioFrom,
          to: toNumber,
          body: `Walkaway estimate for ${body.address ?? "your home"}:
Net range: ${money(body.netLow)} – ${money(body.netHigh)}

Reply STOP to opt out.`,
        });

        console.log("[TWILIO] sent", msg.sid);
      } catch (e: any) {
        console.error("[TWILIO] error:", e?.message || e);
      }
    } else {
      console.log("[TWILIO] skipped (missing env vars or invalid phone)");
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[API] error:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
