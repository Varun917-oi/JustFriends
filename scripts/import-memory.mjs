import { createHash } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { realpath, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const maxFiles = 8;
const maxSourceSize = 50 * 1024 * 1024;
const maxStoredFileSize = 15 * 1024 * 1024;
const maxTotalSize = 50 * 1024 * 1024;
const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const mediaTypes = {
  ".jpg": { mime: "image/jpeg", kind: "image" },
  ".jpeg": { mime: "image/jpeg", kind: "image" },
  ".png": { mime: "image/png", kind: "image" },
  ".webp": { mime: "image/webp", kind: "image" },
  ".gif": { mime: "image/gif", kind: "image" },
  ".mp4": { mime: "video/mp4", kind: "video" },
  ".webm": { mime: "video/webm", kind: "video" },
};
const animationPresets = new Set([
  "dreamy-fade",
  "polaroid-reveal",
  "cinematic-zoom",
  "floating-memory",
  "paper-story",
  "parallax-journey",
  "minimal-reveal",
]);
function parseArguments(args) {
  const options = { apply: false, updateExisting: false, manifest: null };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--manifest" && args[index + 1]) {
      options.manifest = args[++index];
    } else if (args[index] === "--apply") {
      options.apply = true;
    } else if (args[index] === "--dry-run") {
      options.apply = false;
    } else if (args[index] === "--update-existing") {
      options.updateExisting = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${args[index]}`);
    }
  }
  if (!options.manifest) throw new Error("Pass a manifest with --manifest <path>.");
  if (options.updateExisting && !options.apply) {
    throw new Error("--update-existing only applies with --apply.");
  }
  return options;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value, name, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`${name} must be a non-empty string of at most ${maxLength} characters.`);
  }
  return value.trim();
}

function optionalText(value, name, maxLength) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" || value.length > maxLength) {
    throw new Error(`${name} must be a string of at most ${maxLength} characters.`);
  }
  return value.trim();
}

function parseDate(value, approximate) {
  if (value === undefined || value === null || value === "") {
    return { date: null, approximate: Boolean(approximate) };
  }
  if (typeof value !== "string") throw new Error("memoryDate must be a date string.");
  const yearOnly = /^(\d{4})$/.exec(value);
  const monthOnly = /^(\d{4})-(\d{2})$/.exec(value);
  const date = yearOnly ? `${yearOnly[1]}-01-01` : monthOnly ? `${monthOnly[1]}-${monthOnly[2]}-01` : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("memoryDate must use YYYY, YYYY-MM, or YYYY-MM-DD.");
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("memoryDate is not a valid calendar date.");
  }
  return { date, approximate: Boolean(approximate) || Boolean(yearOnly || monthOnly) };
}

export function validateManifest(value) {
  if (!isRecord(value)) throw new Error("The manifest must be a JSON object.");
  const title = requiredText(value.title, "title", 140);
  if (
    value.id !== undefined &&
    (typeof value.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id))
  ) {
    throw new Error("id must be a UUID when provided.");
  }
  const createdBy = value.createdBy ?? null;
  if (createdBy !== null && createdBy !== "Varun" && createdBy !== "Akrati") {
    throw new Error('createdBy must be either "Varun" or "Akrati" when provided.');
  }
  const { date, approximate } = parseDate(value.memoryDate, value.dateIsApproximate);
  if (value.dateIsApproximate !== undefined && typeof value.dateIsApproximate !== "boolean") {
    throw new Error("dateIsApproximate must be a boolean.");
  }
  const caption = optionalText(value.caption ?? value.eventDescription, "caption", 5000);
  if (
    value.caption !== undefined &&
    value.eventDescription !== undefined &&
    optionalText(value.caption, "caption", 5000) !==
      optionalText(value.eventDescription, "eventDescription", 5000)
  ) {
    throw new Error("Use either caption or eventDescription, or make their values identical.");
  }
  const fields = {
    title,
    event_description: caption,
    memory_story: optionalText(value.memoryStory, "memoryStory", 10000),
    feelings: optionalText(value.feelings, "feelings", 3000),
    personal_message: optionalText(value.personalMessage, "personalMessage", 3000),
    location: optionalText(value.location, "location", 120) || null,
    category: optionalText(value.category, "category", 80) || null,
  };
  const tags = value.tags ?? [];
  if (!Array.isArray(tags) || tags.length > 30 || tags.some((tag) => typeof tag !== "string" || tag.length > 50)) {
    throw new Error("tags must be an array of at most 30 strings, each no longer than 50 characters.");
  }
  if (value.displayOrder !== undefined && (!Number.isInteger(value.displayOrder) || value.displayOrder < 1 || value.displayOrder > 100000)) {
    throw new Error("displayOrder must be an integer between 1 and 100000.");
  }
  const animationPreset = value.animationPreset ?? "dreamy-fade";
  if (!animationPresets.has(animationPreset)) throw new Error("animationPreset is not supported.");
  if (
    value.existingMemory !== undefined &&
    (typeof value.existingMemory !== "string" || !value.existingMemory.trim() || value.existingMemory.trim().length > 100)
  ) {
    throw new Error("existingMemory must be a non-empty memory UUID or slug of at most 100 characters.");
  }
  if (!Array.isArray(value.media) || value.media.length < 1 || value.media.length > maxFiles) {
    throw new Error(`media must contain between 1 and ${maxFiles} entries.`);
  }

  return {
    ...fields,
    id: value.id?.toLowerCase(),
    date,
    approximate,
    tags: tags.map((tag) => tag.trim()).filter(Boolean),
    animationPreset,
    createdBy,
    displayOrder: value.displayOrder,
    existingMemory: value.existingMemory?.trim(),
    media: value.media.map((item, index) => {
      if (!isRecord(item)) throw new Error(`media[${index}] must be an object.`);
      return {
        path: requiredText(item.path, `media[${index}].path`, 500),
        alt: optionalText(item.alt, `media[${index}].alt`, 300),
        caption: optionalText(item.caption, `media[${index}].caption`, 300) || null,
      };
    }),
  };
}

function verifySignature(mime, bytes) {
  if (mime === "image/jpeg") return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/gif") return /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString("ascii"));
  if (mime === "image/webp") return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (mime === "video/mp4") return bytes.toString("ascii", 4, 8) === "ftyp";
  if (mime === "video/webm") return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  return false;
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function uuidFrom(value) {
  const hex = sha256(Buffer.from(value)).slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 3) | 8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

export function normalizedTitle(title) {
  return title.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function editDistance(left, right) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[right.length];
}

function titleSimilarity(left, right) {
  const a = normalizedTitle(left);
  const b = normalizedTitle(right);
  if (!a || !b) return 0;
  return 1 - editDistance(a, b) / Math.max(a.length, b.length);
}

export function memoryIdFor(manifest) {
  if (manifest.id) return manifest.id.toLowerCase();
  const seed = `${normalizedTitle(manifest.title)}|${manifest.date ?? ""}|${normalizedTitle(manifest.event_description)}`;
  return uuidFrom(`memory:${seed}`);
}

export function resolveExistingMemory(manifest, allMemories) {
  if (manifest.id) {
    const byId = allMemories.find((item) => item.id.toLowerCase() === manifest.id.toLowerCase());
    if (byId) return byId;
  }
  if (manifest.existingMemory) {
    const identifier = manifest.existingMemory.toLowerCase();
    const match = allMemories.find((item) => item.id.toLowerCase() === identifier || item.slug === manifest.existingMemory);
    if (!match) throw new Error("The requested existingMemory identifier does not match an existing chapter.");
    if (manifest.id && match.id.toLowerCase() !== manifest.id.toLowerCase()) {
      throw new Error("The id does not match the chapter selected by existingMemory.");
    }
    return match;
  }

  const titleKey = normalizedTitle(manifest.title);
  const exactMatches = allMemories.filter((item) =>
    titleKey
      ? normalizedTitle(item.title) === titleKey
      : item.title.trim().toLowerCase() === manifest.title.trim().toLowerCase(),
  );
  if (exactMatches.length > 1) {
    throw new Error("Several chapters have this title. Set existingMemory to the exact UUID or slug.");
  }
  if (exactMatches.length === 1) {
    if (manifest.id && exactMatches[0].id.toLowerCase() !== manifest.id.toLowerCase()) {
      throw new Error("The id does not match the existing chapter. Set existingMemory to the intended UUID or slug.");
    }
    return exactMatches[0];
  }

  const candidates = allMemories
    .map((item) => ({ item, score: titleSimilarity(item.title, manifest.title) }))
    .filter(({ score }) => score >= 0.5)
    .sort((a, b) => b.score - a.score);
  if (candidates.length) {
    const descriptions = candidates.slice(0, 5).map(({ item, score }) => `"${item.title}" (${item.slug}, ${Math.round(score * 100)}% match)`);
    throw new Error(`Possible existing chapter match; set existingMemory after confirming: ${descriptions.join("; ")}.`);
  }
  return null;
}

export function uniqueMediaByPath(media) {
  const seenPaths = new Set();
  return media.filter((item) => {
    if (seenPaths.has(item.object_path)) return false;
    seenPaths.add(item.object_path);
    return true;
  });
}

export function planNewMedia(preparedMedia, existingMediaRows) {
  const existingPaths = new Set(existingMediaRows.map((item) => item.object_path));
  const existingOrders = existingMediaRows.map((item) => item.display_order);
  const newMedia = preparedMedia.filter((item) => !existingPaths.has(item.object_path));
  if (
    existingOrders.length + newMedia.length > maxFiles ||
    Math.max(0, ...existingOrders) + newMedia.length > maxFiles
  ) {
    throw new Error(`This chapter would exceed the ${maxFiles}-file media limit.`);
  }
  const orderedMedia = newMedia.map((item, index) => ({
    ...item,
    display_order: Math.max(0, ...existingOrders) + index + 1,
  }));
  return { existingPaths, newMedia, orderedMedia };
}

export async function prepareMedia(manifest, manifestDirectory, memoryId) {
  const root = await realpath(manifestDirectory);
  const prepared = [];
  let totalBytes = 0;

  for (const [index, entry] of manifest.media.entries()) {
    const unresolvedPath = path.resolve(root, entry.path);
    const realPath = await realpath(unresolvedPath);
    if (!realPath.startsWith(`${root}${path.sep}`)) {
      throw new Error(`media[${index}].path must stay inside the manifest folder.`);
    }
    const details = mediaTypes[path.extname(realPath).toLowerCase()];
    if (!details) throw new Error(`Unsupported media extension: ${path.extname(realPath) || "(none)"}.`);
    const fileStat = await stat(realPath);
    if (!fileStat.isFile() || fileStat.size <= 0 || fileStat.size > maxSourceSize) {
      throw new Error(`media[${index}] must be a regular file no larger than 50 MB.`);
    }
    totalBytes += fileStat.size;
    if (totalBytes > maxTotalSize) throw new Error("The combined source package must be 50 MB or smaller.");

    const source = await readFile(realPath);
    if (!verifySignature(details.mime, source)) throw new Error(`media[${index}] does not match its file extension.`);

    let bytes = source;
    let mime = details.mime;
    let extension = path.extname(realPath).toLowerCase().replace(/^\./, "");
    let width;
    let height;
    if (imageMimeTypes.has(mime)) {
      const optimized = await sharp(source, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 84, effort: 5 })
        .toBuffer({ resolveWithObject: true });
      bytes = optimized.data;
      mime = "image/webp";
      extension = "webp";
      width = optimized.info.width;
      height = optimized.info.height;
    } else if (details.kind === "image") {
      const metadata = await sharp(source, { limitInputPixels: 40_000_000 }).metadata();
      width = metadata.width;
      height = metadata.height;
    }
    if (bytes.byteLength > maxStoredFileSize) {
      throw new Error(`Optimized media[${index}] exceeds the 15 MB storage limit.`);
    }

    const hash = sha256(bytes);
    prepared.push({
      id: uuidFrom(`media:${memoryId}:${hash}`),
      memory_id: memoryId,
      object_path: `${memoryId}/imports/${hash}.${extension}`,
      media_type: details.kind,
      caption: entry.caption,
      alt: entry.alt || `${manifest.title} - media ${index + 1}`,
      width: width ?? null,
      height: height ?? null,
      duration: null,
      display_order: index,
      mime,
      bytes,
      hash,
      originalPath: path.relative(root, realPath),
    });
  }
  return prepared;
}

function slugify(title) {
  return title.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80) || "memory";
}

function memoryPayload(manifest, memory, displayOrder) {
  const timestamp = new Date().toISOString();
  return {
    id: memory.id,
    title: manifest.title,
    slug: memory.slug,
    event_description: manifest.event_description,
    memory_story: manifest.memory_story,
    feelings: manifest.feelings,
    personal_message: manifest.personal_message || null,
    memory_date: manifest.date,
    date_is_approximate: manifest.approximate,
    location: manifest.location,
    category: manifest.category,
    tags: manifest.tags,
    animation_preset: manifest.animationPreset,
    display_order: manifest.displayOrder ?? displayOrder,
    is_featured: false,
    status: "published",
    created_by: manifest.createdBy,
    created_at: memory?.created_at ?? timestamp,
    updated_at: timestamp,
  };
}

async function confirmApply(updateExisting) {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const expected = updateExisting ? "OVERWRITE" : "IMPORT";
    const answer = await prompt.question(`Type ${expected} to confirm the ${updateExisting ? "memory update" : "import"}: `);
    if (answer.trim() !== expected) throw new Error("Import cancelled; no database or storage changes were made.");
  } finally {
    prompt.close();
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const manifestPath = await realpath(path.resolve(options.manifest));
  const manifestDirectory = path.dirname(manifestPath);
  const rawManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const manifest = validateManifest(rawManifest);
  const proposedId = memoryIdFor(manifest);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required in the local environment.");
  }
  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: allMemories, error: memoriesError } = await supabase
    .from("memories")
    .select("id,title,slug,display_order,status,created_at");
  if (memoriesError) throw new Error(`Could not inspect existing memories: ${memoriesError.message}`);

  const match = resolveExistingMemory(manifest, allMemories);

  const memoryId = match?.id ?? proposedId;
  const processedMedia = await prepareMedia(manifest, manifestDirectory, memoryId);
  const preparedMedia = uniqueMediaByPath(processedMedia);
  const duplicatePackageFiles = processedMedia.length - preparedMedia.length;
  const existingMemoryRows = await supabase
    .from("memory_media")
    .select("id,object_path,display_order")
    .eq("memory_id", memoryId);
  if (existingMemoryRows.error) throw new Error(`Could not inspect chapter media: ${existingMemoryRows.error.message}`);
  const { existingPaths, newMedia, orderedMedia } = planNewMedia(preparedMedia, existingMemoryRows.data);

  let slug = match?.slug ?? slugify(manifest.title);
  if (!match) {
    const existingSlugs = new Set(allMemories.map((item) => item.slug));
    let suffix = 1;
    while (existingSlugs.has(slug)) {
      slug = `${slugify(manifest.title).slice(0, 75)}-${suffix}`;
      suffix += 1;
    }
  }
  const memoryRow = memoryPayload(manifest, { id: memoryId, slug, created_at: match?.created_at }, (allMemories.reduce((max, item) => Math.max(max, item.display_order), 0) + 1));
  console.log(options.apply ? "IMPORT PREVIEW" : "DRY RUN - no changes will be written");
  console.log(`Memory: ${manifest.title}`);
  console.log(`Chapter: ${match ? `existing "${match.title}" (${match.slug})` : `new (${slug})`}`);
  console.log(`Action: ${match ? options.updateExisting ? "update metadata and append new media" : "preserve existing metadata and append new media" : "create chapter"}`);
  console.log(`Media: ${preparedMedia.length} unique prepared, ${duplicatePackageFiles} duplicate file(s) in package, ${preparedMedia.length - newMedia.length} already imported, ${newMedia.length} to add`);
  for (const item of preparedMedia) {
    const state = existingPaths.has(item.object_path) ? "already present" : "new";
    console.log(`  ${state}: ${item.originalPath} -> ${item.object_path} (${item.mime}, ${item.bytes.byteLength} bytes, sha256 ${item.hash.slice(0, 12)})`);
  }
  console.log(`Chapter metadata updates: ${match && !options.updateExisting ? "none" : "included only with the explicit --update-existing option for a matched chapter"}`);
  if (!options.apply) {
    console.log("Review the preview. Add --apply to upload and register the listed new media.");
    return;
  }

  await confirmApply(Boolean(match && options.updateExisting));
  const { data: storedObject, error: storageReadError } = await supabase.storage
    .from("memories")
    .list(`${memoryId}/imports`, { limit: maxFiles });
  if (storageReadError) throw new Error(`Could not inspect private storage: ${storageReadError.message}`);
  const existingStorageNames = new Set((storedObject ?? []).map((item) => item.name));
  const uploadedPaths = [];

  for (const item of orderedMedia) {
    const name = path.posix.basename(item.object_path);
    if (existingStorageNames.has(name)) {
      const { data, error } = await supabase.storage.from("memories").download(item.object_path);
      if (error) throw new Error(`A stored media file exists but could not be verified: ${error.message}`);
      if (sha256(Buffer.from(await data.arrayBuffer())) !== item.hash) {
        throw new Error(`A stored media path has unexpected contents: ${item.object_path}`);
      }
    } else {
      const { error } = await supabase.storage.from("memories").upload(item.object_path, item.bytes, {
        contentType: item.mime,
        upsert: false,
      });
      if (error) throw new Error(`Could not upload ${item.originalPath}: ${error.message}`);
      uploadedPaths.push(item.object_path);
    }
  }

  if (!match) {
    const { error } = await supabase.from("memories").insert(memoryRow);
    if (error) throw new Error(`Media uploaded, but the chapter record was not created: ${error.message}`);
  } else if (options.updateExisting) {
    const updates = { ...memoryRow };
    delete updates.created_at;
    const { error } = await supabase.from("memories").update(updates).eq("id", memoryId);
    if (error) throw new Error(`Media uploaded, but the chapter update failed: ${error.message}`);
  }

  if (orderedMedia.length) {
    const rows = orderedMedia.map((item) => ({
      id: item.id,
      memory_id: item.memory_id,
      object_path: item.object_path,
      media_type: item.media_type,
      display_order: item.display_order,
      caption: item.caption,
      alt: item.alt,
      width: item.width,
      height: item.height,
      duration: item.duration,
    }));
    const { error } = await supabase.from("memory_media").insert(rows);
    if (error) throw new Error(`Chapter saved, but media registration failed: ${error.message}`);
  }

  const { data: verifiedMemory, error: verifyMemoryError } = await supabase
    .from("memories")
    .select("id,title,slug,display_order")
    .eq("id", memoryId)
    .single();
  if (verifyMemoryError) throw new Error(`Import completed but chapter verification failed: ${verifyMemoryError.message}`);
  const { data: verifiedMedia, error: verifyMediaError } = await supabase
    .from("memory_media")
    .select("object_path,display_order")
    .eq("memory_id", memoryId)
    .order("display_order");
  if (verifyMediaError) throw new Error(`Import completed but media verification failed: ${verifyMediaError.message}`);

  console.log(`Verified chapter "${verifiedMemory.title}" at /memories/${verifiedMemory.slug}.`);
  console.log(`Verified ${verifiedMedia.length} media reference(s), ordered ${verifiedMedia.map((item) => item.display_order).join(", ")}.`);
  if (uploadedPaths.length) console.log(`${uploadedPaths.length} new private storage object(s) were uploaded.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Memory import failed.");
    process.exitCode = 1;
  });
}
