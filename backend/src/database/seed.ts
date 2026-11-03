import { provisionUser } from "../config/auth.js";
import { logger } from "../config/logger.js";
import { getCompanySettings } from "../modules/settings/service.js";
import { Service } from "../modules/services/model.js";
import { User } from "../modules/users/model.js";
import { connectDatabase, disconnectDatabase } from "./connection.js";
import { initDatabase } from "./models.js";

/** Catalogue starting points with no prices: SAS3D sets its own in the Services module. */
export const DEFAULT_SERVICES = [
  {
    name: "Web Development",
    category: "WEB_DEVELOPMENT",
    technologies: ["Next.js", "React", "TypeScript"],
  },
  {
    name: "Full-Stack Development",
    category: "FULL_STACK_DEVELOPMENT",
    technologies: ["Node.js", "React", "MongoDB"],
  },
  { name: "SaaS Development", category: "SAAS_DEVELOPMENT", technologies: ["Next.js", "Node.js"] },
  { name: "AI Development", category: "AI_DEVELOPMENT", technologies: ["Python", "LLM APIs"] },
  { name: "AI Chatbots", category: "AI_CHATBOTS", technologies: ["LLM APIs", "RAG"] },
  {
    name: "Business Automation",
    category: "BUSINESS_AUTOMATION",
    technologies: ["Node.js", "APIs"],
  },
  { name: "API Development", category: "API_DEVELOPMENT", technologies: ["Node.js", "REST"] },
  { name: "E-commerce", category: "E_COMMERCE", technologies: ["Next.js", "Stripe"] },
  {
    name: "Maintenance and Support",
    category: "MAINTENANCE_SUPPORT",
    pricingModel: "MONTHLY",
    technologies: [],
  },
  {
    name: "Custom Software",
    category: "CUSTOM_SOFTWARE",
    pricingModel: "CUSTOM",
    technologies: [],
  },
] as const;

/** Idempotent: re-running changes nothing that already exists. */
export async function seedBase() {
  await getCompanySettings();
  for (const service of DEFAULT_SERVICES) {
    await Service.updateOne(
      { name: service.name },
      {
        $setOnInsert: {
          ...service,
          pricingModel: "pricingModel" in service ? service.pricingModel : "FIXED",
        },
      },
      { upsert: true },
    );
  }

  const {
    SEED_ADMIN_EMAIL: email,
    SEED_ADMIN_PASSWORD: password,
    SEED_ADMIN_NAME: name,
  } = process.env;
  if (!email || !password)
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before seeding");
  if (password.length < 10) throw new Error("SEED_ADMIN_PASSWORD must be at least 10 characters");
  if (await User.exists({ email: email.toLowerCase() })) {
    logger.info({ email }, "Administrator already exists");
    return;
  }
  await provisionUser({ name: name || "Administrator", email, password, role: "SUPER_ADMIN" });
  logger.info({ email }, "Administrator created");
}

if (process.argv[1]?.match(/seed\.(ts|js)$/)) {
  (async () => {
    await connectDatabase();
    await initDatabase();
    await seedBase();
    await disconnectDatabase();
  })().catch((error: unknown) => {
    logger.fatal({ err: error }, "Seed failed");
    process.exit(1);
  });
}
