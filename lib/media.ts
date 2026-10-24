import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { MemoryMedia } from "@/lib/types";

const uploadDirectory = path.join(process.cwd(), "data", "uploads");
const maxFileSize = 15 * 1024 * 1024;
const maxTotalSize = 50 * 1024 * 1024;
const maxFiles = 8;

const supportedTypes: Record<string, { extension: string; type: MemoryMedia["type"] }> = {
  "image/jpeg": { extension: "jpg", type: "image" },
  "image/png": { extension: "png", type: "image" },
  "image/webp": { extension: "webp", type: "image" },
  "image/gif": { extension: "gif", type: "image" },
  "video/mp4": { extension: "mp4", type: "video" },
  "video/webm": { extension: "webm", type: "video" },
};

export async function saveMemoryUploads(
  memoryId: string,
  title: string,
  files: File[],
  firstOrder = 1,
): Promise<MemoryMedia[]> {
  if (files.length > maxFiles) {
    throw new Error(`Choose no more than ${maxFiles} files.`);
  }
  if (files.some((file) => file.size > maxFileSize)) {
    throw new Error("Each file must be 15 MB or smaller.");
  }
  if (files.reduce((total, file) => total + file.size, 0) > maxTotalSize) {
    throw new Error("The combined upload must be 50 MB or smaller.");
  }

  const fileTypes = files.map((file) => {
    const type = supportedTypes[file.type];
    if (!type) throw new Error("Use JPG, PNG, WebP, GIF, MP4, or WebM files.");
    return type;
  });

  await fs.mkdir(uploadDirectory, { recursive: true });
  const savedPaths: string[] = [];
  try {
    const media: MemoryMedia[] = [];
    for (const [index, file] of files.entries()) {
      const fileType = fileTypes[index];
      const bytes = Buffer.from(await file.arrayBuffer());
      if (!hasValidSignature(file.type, bytes)) {
        throw new Error(`${file.name || "A file"} does not match its declared media type.`);
      }

      const filename = `${crypto.randomUUID()}.${fileType.extension}`;
      const filePath = path.join(uploadDirectory, filename);
      await fs.writeFile(filePath, bytes, { flag: "wx" });
      savedPaths.push(filePath);

      media.push({
        id: crypto.randomUUID(),
        memoryId,
        type: fileType.type,
        url: `/media/${filename}`,
        path: `/media/${filename}`,
        order: firstOrder + index,
        alt: title,
        createdAt: new Date().toISOString(),
      });
    }
    return media;
  } catch (error) {
    await Promise.all(savedPaths.map((filePath) => fs.unlink(filePath).catch(() => undefined)));
    throw error;
  }
}

function hasValidSignature(mimeType: string, bytes: Buffer) {
  if (mimeType === "image/jpeg") return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/gif") return bytes.subarray(0, 6).toString("ascii").match(/^GIF8[79]a$/) !== null;
  if (mimeType === "image/webp") return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (mimeType === "video/mp4") return bytes.toString("ascii", 4, 8) === "ftyp";
  if (mimeType === "video/webm") return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  return false;
}

export async function removeMemoryUploads(media: MemoryMedia[]) {
  await Promise.all(
    media.map(async (item) => {
      if (!item.path.startsWith("/media/")) return;
      const filename = item.path.slice("/media/".length);
      if (!/^[0-9a-f-]+\.(jpg|png|webp|gif|mp4|webm)$/i.test(filename)) return;
      await fs.unlink(path.join(uploadDirectory, filename)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    }),
  );
}

export function getUploadPath(filename: string) {
  if (!/^[0-9a-f-]+\.(jpg|png|webp|gif|mp4|webm)$/i.test(filename)) return null;
  return path.join(uploadDirectory, filename);
}
