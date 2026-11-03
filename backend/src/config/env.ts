import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.string().default("info"),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  MONGODB_URI: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.url(),
  FRONTEND_URL: z.string().min(1),
  COOKIE_DOMAIN: optionalString,
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.string().default("SAS3D CRM <crm@sas3d.in>"),
  STORAGE_DRIVER: z.enum(["local", "cloudinary"]).default("local"),
  UPLOAD_DIR: z.string().default("./uploads"),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,
  JOBS_ENABLED: z
    .string()
    .default("true")
    .transform((value) => value === "true"),
  JOB_INTERVAL_SECONDS: z.coerce.number().int().min(30).default(300),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
export const allowedOrigins = env.FRONTEND_URL.split(",").map((origin) => origin.trim());
