import "server-only";

import crypto from "node:crypto";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasValidMediaSignature, isSupportedMediaType } from "@/lib/media-validation";
import type { MemoryMedia, UploadedMediaInput } from "@/lib/types";

const maxFileSize = 15 * 1024 * 1024;
const maxTotalSize = 50 * 1024 * 1024;
const maxFiles = 8;
const mimeDetails: Record<string, { extension: string; type: MemoryMedia["type"] }> = {
  "image/jpeg": { extension: "jpg", type: "image" },
  "image/png": { extension: "png", type: "image" },
  "image/webp": { extension: "webp", type: "image" },
  "image/gif": { extension: "gif", type: "image" },
  "video/mp4": { extension: "mp4", type: "video" },
  "video/webm": { extension: "webm", type: "video" },
};
const mediaPathPattern = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\.(jpg|png|webp|gif|mp4|webm)$/i;

export async function registerUploadedMedia(
  memoryId: string,
  title: string,
  files: UploadedMediaInput[],
  firstOrder = 1,
): Promise<MemoryMedia[]> {
  if (files.length > maxFiles) throw new Error(`Choose no more than ${maxFiles} files.`);
  if (files.some((file) => file.size > maxFileSize || file.size <= 0)) {
    throw new Error("Each file must be between 1 byte and 15 MB.");
  }
  if (files.reduce((total, file) => total + file.size, 0) > maxTotalSize) {
    throw new Error("The combined upload must be 50 MB or smaller.");
  }
  if (files.some((file) => !isSupportedMediaType(file.mimeType))) {
    throw new Error("Use JPG, PNG, WebP, GIF, MP4, or WebM files.");
  }

  const supabase = await createSupabaseServerClient();
  const verifiedMedia: MemoryMedia[] = [];
  const validPaths: string[] = [];
  for (const file of files) {
    const match = mediaPathPattern.exec(file.objectPath);
    const details = mimeDetails[file.mimeType];
    if (!match || match[1].toLowerCase() !== memoryId.toLowerCase() || match[3].toLowerCase() !== details.extension) {
      throw new Error("An uploaded media reference is invalid.");
    }
    validPaths.push(file.objectPath);
  }

  try {
    for (const [index, file] of files.entries()) {
      const { data, error } = await supabase.storage.from("memories").download(file.objectPath);
      if (error) throw new Error(`Could not verify uploaded media: ${error.message}`);
      const bytes = new Uint8Array(await data.arrayBuffer());
      if (bytes.byteLength !== file.size || !hasValidMediaSignature(file.mimeType, bytes)) {
        throw new Error("An uploaded file does not match its declared media type or size.");
      }

      verifiedMedia.push({
        id: crypto.randomUUID(),
        memoryId,
        type: mimeDetails[file.mimeType].type,
        url: "",
        path: file.objectPath,
        order: firstOrder + index,
        alt: title,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    const { error: cleanupError } = await supabase.storage.from("memories").remove(validPaths);
    if (cleanupError) {
      throw new AggregateError(
        [error, new Error(`Invalid upload cleanup failed: ${cleanupError.message}`)],
        "Media verification failed and cleanup was incomplete.",
      );
    }
    throw error;
  }
  return verifiedMedia;
}

export async function removeMemoryUploads(media: MemoryMedia[]) {
  const paths = media.map((item) => item.path).filter((item) => {
    const match = mediaPathPattern.exec(item);
    return match !== null;
  });
  if (!paths.length) return;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage.from("memories").remove(paths);
  if (error) throw new Error(`Could not remove stored media: ${error.message}`);
}
