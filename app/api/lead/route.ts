import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const sheetId = process.env.GOOGLE_SHEET_ID;
    const keyFile = process.env.GOOGLE_KEYFILE;

    if (!sheetId || !keyFile) {
      return NextResponse.json(
        { error: "Missing env vars" },
        { status: 500 }
      );
    }

    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

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

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("SHEETS ERROR:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Sheets error" },
      { status: 500 }
    );
  }
}
