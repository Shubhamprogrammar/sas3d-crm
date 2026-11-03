import type { Currency } from "../config/constants.js";

/** Fictional sample leads, only ever used by the demo seed. */
export const SAMPLE_LEADS: {
  name: string;
  company: string;
  country: string;
  timezone: string;
  source: "LINKEDIN" | "UPWORK" | "REFERRAL" | "WEBSITE";
  budget: number;
  currency: Currency;
}[] = [
  {
    name: "Sample Person A",
    company: "Sample Co A",
    country: "United States",
    timezone: "America/New_York",
    source: "LINKEDIN",
    budget: 1500000,
    currency: "USD",
  },
  {
    name: "Sample Person B",
    company: "Sample Co B",
    country: "India",
    timezone: "Asia/Kolkata",
    source: "REFERRAL",
    budget: 25000000,
    currency: "INR",
  },
  {
    name: "Sample Person C",
    company: "Sample Co C",
    country: "United Arab Emirates",
    timezone: "Asia/Dubai",
    source: "WEBSITE",
    budget: 3000000,
    currency: "AED",
  },
  {
    name: "Sample Person D",
    company: "Sample Co D",
    country: "Germany",
    timezone: "Europe/Berlin",
    source: "UPWORK",
    budget: 900000,
    currency: "EUR",
  },
  {
    name: "Sample Person E",
    company: "Sample Co E",
    country: "Canada",
    timezone: "America/Toronto",
    source: "LINKEDIN",
    budget: 1100000,
    currency: "CAD",
  },
  {
    name: "Sample Person F",
    company: "Sample Co F",
    country: "Australia",
    timezone: "Australia/Sydney",
    source: "WEBSITE",
    budget: 700000,
    currency: "AUD",
  },
];
