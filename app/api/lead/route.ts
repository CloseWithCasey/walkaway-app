export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { Resend } from "resend";

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

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

    // 1) Always write to Sheets first
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
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
        ]],
      },
    });

    console.log("LEAD SAVED TO SHEETS:", body.email);

    // 2) Then attempt email (never block saving the lead)
    const resendKey = process.env.RESEND_API_KEY;
    const notifyEmail = process.env.NOTIFY_EMAIL;

    console.log("RESEND ENV CHECK", {
      hasKey: !!resendKey,
      notifyEmail: notifyEmail ?? "MISSING",
    });

    if (resendKey && notifyEmail) {
      try {
        const resend = new Resend(resendKey);

        const { data, error } = await resend.emails.send({
          // Use Resend default sender until you verify a domain
          from: "from: \"Casey Cooke <leads@closewithcasey.org>",
          to: notifyEmail,
          subject: "New Walkaway Lead Submitted",
          html: `
            <h2>New Walkaway Lead</h2>
            <p><strong>Name:</strong> ${body.name ?? ""}</p>
            <p><strong>Email:</strong> ${body.email ?? ""}</p>
            <p><strong>Phone:</strong> ${body.phone ?? ""}</p>
            <p><strong>Address:</strong> ${body.address ?? ""}</p>
            <p><strong>Net Range:</strong>
              $${Math.round(body.netLow ?? 0).toLocaleString()} –
              $${Math.round(body.netHigh ?? 0).toLocaleString()}
            </p>
          `,
        });

        if (error) {
          console.error("RESEND SEND ERROR:", error);
        } else {
          console.log("RESEND SENT OK:", data);
        }
      } catch (emailErr: any) {
        console.error("RESEND THROW:", emailErr?.message || emailErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("API ERROR:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}

