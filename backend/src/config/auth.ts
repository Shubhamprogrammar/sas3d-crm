import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import mongoose from "mongoose";
import { allowedOrigins, env, isProduction, isTest } from "./env.js";
import { logger } from "./logger.js";
import { sendEmail } from "../services/email.service.js";

function createAuth() {
  const client = mongoose.connection.getClient();
  const db = client.db(mongoose.connection.name);

  return betterAuth({
    appName: "SAS3D CRM",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/v1/auth",
    trustedOrigins: allowedOrigins,
    database: mongodbAdapter(db, { client }),
    emailAndPassword: {
      enabled: true,
      // Accounts are provisioned by administrators through the team module only.
      disableSignUp: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      // The link is built here rather than taken from the request: a caller-supplied redirect
      // would let anyone request a reset that delivers the victim's token to their own site.
      sendResetPassword: async ({ user, token }) => {
        const url = `${allowedOrigins[0]}/reset-password?token=${encodeURIComponent(token)}`;
        const result = await sendEmail({
          to: user.email,
          subject: "Reset your SAS3D CRM password",
          html: `<p>Hello ${escapeHtml(user.name)},</p><p>Use this link to reset your password. It expires in one hour.</p><p><a href="${escapeHtml(url)}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
        });
        if (!result.sent) logger.warn({ reason: result.reason }, "Password reset email not sent");
      },
    },
    user: {
      additionalFields: {
        // input:false stops clients from setting these through any Better Auth endpoint.
        role: { type: "string", required: false, defaultValue: "DEVELOPER", input: false },
        status: { type: "string", required: false, defaultValue: "ACTIVE", input: false },
        // The adapter drops any field not declared here, so provisionUser's values depend on these.
        // returned:false keeps profile data out of session responses; /me serves it instead.
        phone: { type: "string", required: false, input: false, returned: false },
        designation: { type: "string", required: false, input: false, returned: false },
        joiningDate: { type: "date", required: false, input: false, returned: false },
        skills: { type: "string[]", required: false, input: false, returned: false },
        mutedNotifications: { type: "string[]", required: false, input: false, returned: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const user = await db
              .collection("user")
              .findOne(
                { _id: new mongoose.Types.ObjectId(session.userId) },
                { projection: { status: 1 } },
              );
            // Returning false makes Better Auth abort sign-in for deactivated accounts.
            return user?.status === "INACTIVE" ? false : undefined;
          },
        },
      },
    },
    rateLimit: {
      enabled: !isTest,
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/request-password-reset": { window: 300, max: 5 },
        "/reset-password": { window: 300, max: 10 },
      },
    },
    advanced: {
      useSecureCookies: isProduction,
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: isProduction },
      ...(env.COOKIE_DOMAIN
        ? { crossSubDomainCookies: { enabled: true, domain: env.COOKIE_DOMAIN } }
        : {}),
    },
  });
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

let instance: ReturnType<typeof createAuth> | undefined;

/** Better Auth binds to the live Mongo client, so it can only be created after connecting. */
export function getAuth() {
  instance ??= createAuth();
  return instance;
}

export function resetAuth() {
  instance = undefined;
}

/** Creates a credential account, the only supported path because public sign-up is disabled. */
export async function provisionUser(input: {
  name: string;
  email: string;
  password: string;
  role: string;
  extra?: Record<string, unknown>;
}) {
  const ctx = await getAuth().$context;
  const passwordHash = await ctx.password.hash(input.password);
  const user = await ctx.internalAdapter.createUser(
    {
      name: input.name,
      email: input.email.toLowerCase(),
      emailVerified: true,
      role: input.role,
      status: "ACTIVE",
      // Better Auth writes this document directly, so Mongoose's schema defaults never apply to it.
      phone: "",
      designation: "",
      joiningDate: null,
      skills: [],
      mutedNotifications: [],
      ...input.extra,
    },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: passwordHash,
  });
  return user;
}

export async function revokeAllSessions(userId: string) {
  const ctx = await getAuth().$context;
  await ctx.internalAdapter.deleteUserSessions(userId);
}
