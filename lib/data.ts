import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { AnimationPreset, Memory, SiteSettings } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const uploadDir = path.join(dataDir, "uploads");
const memoriesFile = path.join(dataDir, "memories.json");
const settingsFile = path.join(dataDir, "site-settings.json");

export const defaultSettings: SiteSettings = {
  title: "Our Little Universe",
  subtitle: "Some moments pass. Some become a part of us.",
  closingLetter:
    "Thank you for being part of my favourite memories. Here's to all the little moments still waiting for us.",
};

async function ensureFiles() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadDir, { recursive: true });

  try {
    await fs.access(memoriesFile);
  } catch {
    await fs.writeFile(memoriesFile, JSON.stringify([], null, 2), "utf-8");
  }

  try {
    await fs.access(settingsFile);
  } catch {
    await fs.writeFile(settingsFile, JSON.stringify(defaultSettings, null, 2), "utf-8");
  }
}

export async function readMemories(): Promise<Memory[]> {
  await ensureFiles();
  const raw = await fs.readFile(memoriesFile, "utf-8");
  const memories = JSON.parse(raw) as Memory[];
  return memories.sort((a, b) => a.display_order - b.display_order);
}

export async function writeMemories(memories: Memory[]) {
  await ensureFiles();
  const sorted = [...memories].sort((a, b) => a.display_order - b.display_order);
  await writeAtomically(memoriesFile, JSON.stringify(sorted, null, 2));
}

export async function readSiteSettings(): Promise<SiteSettings> {
  await ensureFiles();
  const raw = await fs.readFile(settingsFile, "utf-8");
  return JSON.parse(raw) as SiteSettings;
}

export async function writeSiteSettings(settings: SiteSettings) {
  await ensureFiles();
  await writeAtomically(settingsFile, JSON.stringify(settings, null, 2));
}

async function writeAtomically(filePath: string, value: string) {
  const temporaryPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, value, "utf-8");
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export async function getPublishedMemories() {
  const memories = await readMemories();
  return memories.filter((memory) => memory.status === "published");
}

export async function getMemoryBySlug(slug: string) {
  const memories = await readMemories();
  return memories.find((memory) => memory.slug === slug) ?? null;
}

export async function getMemoryById(id: string) {
  const memories = await readMemories();
  return memories.find((memory) => memory.id === id) ?? null;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export async function createUniqueSlug(title: string, excludeId?: string) {
  const base = slugify(title) || "memory";
  const memories = await readMemories();
  const existing = new Set(
    memories.filter((memory) => memory.id !== excludeId).map((memory) => memory.slug),
  );

  let candidate = base;
  let suffix = 1;
  while (existing.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export const animationPresets: AnimationPreset[] = [
  "dreamy-fade",
  "polaroid-reveal",
  "cinematic-zoom",
  "floating-memory",
  "paper-story",
  "parallax-journey",
  "minimal-reveal",
];

export function formatMemoryDate(date?: string) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return "Date unknown";
  }

  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return "Date unknown";
  const localDate = new Date(year, month - 1, day, 12);
  if (localDate.getFullYear() !== year || localDate.getMonth() !== month - 1 || localDate.getDate() !== day) {
    return "Date unknown";
  }
  return localDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
