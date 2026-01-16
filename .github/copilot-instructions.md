# AI Coding Agent Instructions

## Project Overview
**Walkaway Calculator** is a Next.js real estate calculator tool that helps homeowners understand their net proceeds after selling. It combines a client-side calculator with lead capture and notification functionality.

## Architecture & Data Flow

### Three-Tier Structure
1. **Frontend Calculator** ([app/page.tsx](app/page.tsx)) – React form with real-time financial calculations
2. **API Lead Handler** ([app/api/lead/route.ts](app/api/lead/route.ts)) – POST endpoint collecting leads
3. **External Services** – Google Sheets (lead persistence) + Resend (email notifications)

### Key Design Pattern: "Sheets First, Email Optional"
The lead endpoint deliberately **writes to Google Sheets before attempting email**. This ensures no lead is lost if Resend fails. Email errors are caught and logged but never block the response. See [lead route logic](app/api/lead/route.ts#L37-L42).

## Calculator Logic

### Cost Model (in [app/page.tsx](app/page.tsx))
- **Base Price**: `sqftNum × BASELINE_PER_SQFT` (135 $/sqft for Fort Wayne)
- **Condition Multipliers**: needs_work=0.92, average=1.0, updated=1.06, renovated=1.1
- **Sale Price Range**: ±6% or ±8% (wider for needs_work)
- **Costs Deducted**:
  - Commission: 5.5% of sale price
  - Closing costs: 1.5%–3% of sale price
  - Seller concessions: 0.5%–2% (if enabled)
  - Mortgage payoff (if entered)

**Critical**: Net Low uses worst-case costs; Net High uses best-case. This conservative approach prevents false hope.

## Environment & Configuration

### Required Environment Variables
- `GOOGLE_SHEET_ID` – Target spreadsheet for leads
- `GOOGLE_SERVICE_ACCOUNT_JSON` – JSON-stringified service account key (parsed on POST)
- `RESEND_API_KEY` – Email service API key
- `NOTIFY_EMAIL` – Where to send lead notifications

### Development
```bash
npm run dev          # Start local server on port 3000
npm run build        # Compile TypeScript
npm run lint         # Run ESLint
```

## Common Tasks

### Adding a New Calculator Input
1. Add field to `FormState` type in [page.tsx](app/page.tsx#L6)
2. Add UI input (label + input/select)
3. Update `calc` useMemo to use it
4. Include in `submitLead()` JSON payload

### Modifying Lead Capture
- Add field to `FormState` (automatically sent to Sheets and Resend email)
- Adjust HTML email template in [route.ts](app/api/lead/route.ts#L74) for display
- No schema validation exists; field names matter for Sheets column mapping

### Debugging Email Issues
- Check `RESEND_API_KEY` and `NOTIFY_EMAIL` in env
- Email errors log to console but don't fail the API (by design)
- Verify Resend domain is verified if using custom sender
- Check [email try/catch block](app/api/lead/route.ts#L67-L91) for error handling

## Code Patterns & Conventions

### Type Safety
- Strict TypeScript (`strict: true` in [tsconfig.json](tsconfig.json))
- Union types for enums (e.g., `Condition`, `Timeline`) instead of string literals
- No generics or advanced TS features—keep it simple

### Form State Management
- Single `useState` hook for entire form (`s` variable)
- Spread operator on every change: `setS({ ...s, field: value })`
- No form libraries; inline styling with `style` prop

### Client vs. Server
- `"use client"` at top of [page.tsx](app/page.tsx) – client-side calculator
- `"export const runtime = "nodejs"` in [route.ts](app/api/lead/route.ts) – Node.js environment for Google/Resend APIs

## Integration Points

### Google Sheets API
- Uses service account for authentication (not user OAuth)
- Appends one row per lead to A1 range
- Column order matches JavaScript array order—**fragile**, no schema

### Resend Email
- Sends HTML email with calculated net range
- Uses `leads@closewithcasey.org` as sender (must verify domain for production)
- Error handling is silent; failures don't break lead capture

## Files Reference
- **Calculator & UI**: [app/page.tsx](app/page.tsx) (330 lines)
- **Lead API**: [app/api/lead/route.ts](app/api/lead/route.ts) (115 lines)
- **Config**: [next.config.ts](next.config.ts), [tsconfig.json](tsconfig.json)
- **Secrets**: `.env.local` (local) and [secrets/service-account.json](secrets/service-account.json) (not in git)

## Testing & Validation
- No unit or integration tests present
- Manual testing via `npm run dev` and form submission
- Check browser console for fetch errors and API console logs

## Avoid Common Pitfalls
1. **Never block lead saving on email failure** – Current pattern is correct
2. **Condition multipliers are hardcoded** – Consider environment config if they change frequently
3. **No input validation** – Empty/invalid values sent as empty strings to Sheets
4. **Sheets column order matters** – Adding fields requires coordinating with Sheets structure
