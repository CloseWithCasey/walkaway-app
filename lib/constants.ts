// lib/constants.ts
// Centralized configuration constants for Walkaway Calculator
// Consider moving configuration to environment variables for production deployments

export const CALC_CONFIG = {
  // Fort Wayne market baseline
  BASELINE_PER_SQFT: 135,

  // Sales costs
  COMMISSION_RATE: 0.055, // 5.5%
  CLOSE_LOW: 0.015, // 1.5% best-case closing
  CLOSE_HIGH: 0.03, // 3% worst-case closing

  // Optional seller concessions
  CONC_LOW: 0.005, // 0.5% best-case
  CONC_HIGH: 0.02, // 2% worst-case

  // Market variations by condition
  RANGE_NORMAL: 0.06, // ±6% for average condition
  RANGE_NEEDS_WORK: 0.08, // ±8% for needs work (wider range)
} as const;

export const CONDITION_MULT = {
  needs_work: 0.92,
  average: 1.0,
  updated: 1.06,
  renovated: 1.1,
} as const;

// UI Configuration
export const EMAIL_SENDER = "Casey Cooke <leads@closewithcasey.org>";

// Sheets column mapping - Update if you add/remove fields
export const SHEETS_COLUMNS = [
  "timestamp",
  "name",
  "email",
  "phone",
  "address",
  "beds",
  "baths",
  "sqft",
  "condition",
  "timeline",
  "mortgagePayoff",
  "concessions",
  "lowSale",
  "highSale",
  "netLow",
  "netHigh",
] as const;

// Validation patterns
export const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[\d\s+\(\)\-]+$/,
} as const;

// Migration notes for future updates:
//
// 1. Market baseline changes:
//    - Update BASELINE_PER_SQFT for different markets (currently Fort Wayne)
//    - Consider moving to GOOGLE_SHEETS_ID-based configuration
//
// 2. Cost percentages:
//    - If commission rates change (e.g., buyer market), update COMMISSION_RATE
//    - Closing costs typically 1.5-3%, adjust if market changes
//
// 3. New markets:
//    - Create separate exports per market, or
//    - Use environment variables: process.env.BASELINE_PER_SQFT
//
// 4. Database schema changes:
//    - If adding fields to FormState, update SHEETS_COLUMNS
//    - Order matters! Reflects order in Sheets append operation
