import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const { path } = await params;
  const objectPath = path.join("/");
  const match = /^([0-9a-f-]{36})\/(?:[0-9a-f-]{36}\.(?:jpg|png|webp|gif|mp4|webm)|imports\/[a-f0-9]{64}\.(?:jpg|png|webp|gif|mp4|webm))$/i.exec(objectPath);
  if (!match) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const supabase = await createSupabaseServerClient();
  const { data: media, error: mediaError } = await supabase
    .from("memory_media")
    .select("id")
    .eq("memory_id", match[1])
    .eq("object_path", objectPath)
    .maybeSingle();
  if (mediaError) throw new Error(`Could not authorize private media: ${mediaError.message}`);
  if (!media) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const { data: signedMedia, error: signedUrlError } = await supabase.storage
    .from("memories")
    .createSignedUrl(objectPath, 60);
  if (signedUrlError) throw new Error(`Could not authorize private media delivery: ${signedUrlError.message}`);

  return NextResponse.redirect(signedMedia.signedUrl, {
    status: 307,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });
}
