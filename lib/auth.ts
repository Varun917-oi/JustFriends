import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { AuthUser, UserRole } from "@/lib/types";
import { getAccountVersion, getProvisionedUsers, verifyAccountPassword } from "@/lib/account-store";

export const AUTH_COOKIE = "little_universe_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const accountRoles: Record<string, UserRole> = {
  Varun: "admin",
  Akrati: "admin",
};

interface SessionPayload extends AuthUser {
  expiresAt: number;
  authVersion: number;
}

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be configured with at least 32 characters.");
  }
  return secret;
}

export function getSeedUsers() {
  return getProvisionedUsers();
}

export async function verifyPassword(username: string, password: string) {
  return verifyAccountPassword(username, password);
}

function serializePayload(payload: SessionPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function signValue(value: string) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function createSessionValue(user: AuthUser, authVersion: number) {
  const payload = serializePayload({
    ...user,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    authVersion,
  });
  return `${payload}.${signValue(payload)}`;
}

export function verifySessionValue(value?: string): SessionPayload | null {
  if (!value) {
    return null;
  }

  const [payload, signature] = value.split(".");
  if (!payload || !signature) {
    return null;
  }

  const signatureBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(signValue(payload));
  if (signatureBytes.length !== expectedBytes.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(signatureBytes, expectedBytes)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as SessionPayload;
    if (
      !parsed.username ||
      accountRoles[parsed.username] !== parsed.role ||
      !Number.isFinite(parsed.expiresAt) ||
      !Number.isSafeInteger(parsed.authVersion) ||
      parsed.authVersion < 1 ||
      parsed.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeSessionCookie(user: AuthUser) {
  const authVersion = await getAccountVersion(user.username);
  if (authVersion === null) throw new Error("The account is not provisioned.");
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, createSessionValue(user, authVersion), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentUser() {
  const sessionCookie = (await cookies()).get(AUTH_COOKIE)?.value;
  const session = verifySessionValue(sessionCookie);
  if (!session) return null;

  const authVersion = await getAccountVersion(session.username);
  return authVersion === session.authVersion
    ? { username: session.username, role: session.role }
    : null;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return null;
  }

  return user;
}
