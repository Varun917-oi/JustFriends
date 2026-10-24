import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { UserRole } from "@/lib/types";

const accountFile = path.join(process.cwd(), "data", "accounts.json");
const iterations = 310_000;
const accounts: Record<string, UserRole> = {
  Varun: "admin",
  Akrati: "admin",
};

interface StoredAccount {
  username: string;
  role: UserRole;
  salt: string;
  passwordHash: string;
  iterations: number;
  version: number;
}

type AccountMap = Record<string, StoredAccount>;

function configuredSeeds(): AccountMap | null {
  const seeded: AccountMap = {};
  for (const [username, role] of Object.entries(accounts)) {
    const password = process.env[`${username.toUpperCase()}_INITIAL_PASSWORD`];
    if (!password) return null;
    seeded[username] = makeAccount(username, role, password);
  }
  return seeded;
}

function makeAccount(username: string, role: UserRole, password: string, version = 1): StoredAccount {
  const salt = crypto.randomBytes(16).toString("base64url");
  return {
    username,
    role,
    salt,
    passwordHash: derivePassword(password, salt, iterations),
    iterations,
    version,
  };
}

function derivePassword(password: string, salt: string, rounds: number) {
  return crypto.pbkdf2Sync(password, salt, rounds, 64, "sha512").toString("hex");
}

function validateAccounts(value: unknown): AccountMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The local account store is invalid.");
  }

  const records = value as Record<string, Partial<StoredAccount>>;
  for (const [username, role] of Object.entries(accounts)) {
    const record = records[username];
    if (
      !record ||
      record.username !== username ||
      record.role !== role ||
      typeof record.salt !== "string" ||
      !/^[A-Za-z0-9_-]{20,30}$/.test(record.salt) ||
      typeof record.passwordHash !== "string" ||
      !/^[a-f0-9]{128}$/.test(record.passwordHash) ||
      !Number.isSafeInteger(record.iterations) ||
      (record.iterations ?? 0) < 100_000 ||
      !Number.isSafeInteger(record.version) ||
      (record.version ?? 0) < 1
    ) {
      throw new Error(`The local account record for ${username} is invalid.`);
    }
  }

  return records as AccountMap;
}

async function readAccountFile() {
  const content = await fs.readFile(accountFile, "utf-8");
  return validateAccounts(JSON.parse(content) as unknown);
}

async function writeAccountFile(value: AccountMap) {
  await fs.mkdir(path.dirname(accountFile), { recursive: true });
  const temporaryPath = `${accountFile}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, JSON.stringify(value, null, 2), { encoding: "utf-8", mode: 0o600 });
    await fs.rename(temporaryPath, accountFile);
  } catch (error) {
    await fs.unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

async function getAccounts(): Promise<AccountMap | null> {
  try {
    return await readAccountFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const initialAccounts = configuredSeeds();
  if (!initialAccounts) return null;

  await fs.mkdir(path.dirname(accountFile), { recursive: true });
  try {
    await fs.writeFile(accountFile, JSON.stringify(initialAccounts, null, 2), {
      encoding: "utf-8",
      flag: "wx",
      mode: 0o600,
    });
    return initialAccounts;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    return readAccountFile();
  }
}

function equalPassword(password: string, record: StoredAccount) {
  const expected = Buffer.from(record.passwordHash, "hex");
  const actual = Buffer.from(derivePassword(password, record.salt, record.iterations), "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export async function getProvisionedUsers() {
  return Object.entries(accounts).map(([username, role]) => ({ username, role }));
}

export async function verifyAccountPassword(username: string, password: string) {
  if (!accounts[username] || !password || password.length > 256) return false;
  const records = await getAccounts();
  const record = records?.[username];
  return Boolean(record && equalPassword(password, record));
}

export async function getAccountVersion(username: string) {
  const records = await getAccounts();
  return records?.[username]?.version ?? null;
}

export async function changeAccountPassword(username: string, currentPassword: string, newPassword: string) {
  if (!accounts[username] || currentPassword.length > 256 || newPassword.length < 12 || newPassword.length > 256) return false;
  const records = await getAccounts();
  const record = records?.[username];
  if (!record || !equalPassword(currentPassword, record)) return false;

  records[username] = makeAccount(username, record.role, newPassword, record.version + 1);
  await writeAccountFile(records);
  return true;
}
