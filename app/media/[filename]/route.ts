import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { readMemories } from "@/lib/data";
import { getUploadPath } from "@/lib/media";

const contentTypes: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
};

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const filePath = getUploadPath(filename);
  if (!filePath) return new NextResponse(null, { status: 404 });

  const [memories, user] = await Promise.all([readMemories(), getCurrentUser()]);
  const memory = memories.find((entry) => entry.media.some((item) => item.path === `/media/${filename}`));
  if (!memory || (memory.status !== "published" && user?.role !== "admin")) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const content = await readFile(filePath);
    const extension = filename.split(".").pop() ?? "";
    return new NextResponse(content, {
      headers: {
        "Content-Type": contentTypes[extension],
        "Content-Length": String(content.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new NextResponse(null, { status: 404 });
    }
    throw error;
  }
}
