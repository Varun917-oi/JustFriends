import "server-only";

import type { AnimationPreset, Memory, MemoryMedia, SiteSettings } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { animationPresets, formatMemoryDate } from "@/lib/memory-utils";

export { animationPresets, formatMemoryDate };
export const defaultSettings: SiteSettings = {
  title: "Our Little Universe",
  subtitle: "Some moments pass. Some become a part of us.",
  closingLetter:
    "Thank you for being part of my favourite memories. Here's to all the little moments still waiting for us.",
};

type MemoryRow = {
  id: string;
  title: string;
  slug: string;
  event_description: string;
  memory_story: string;
  feelings: string;
  personal_message: string | null;
  memory_date: string | null;
  date_is_approximate: boolean;
  location: string | null;
  category: string | null;
  tags: string[];
  animation_preset: AnimationPreset;
  display_order: number;
  is_featured: boolean;
  status: Memory["status"];
  created_by: string;
  created_at: string;
  updated_at: string;
  memory_media: Array<{
    id: string;
    memory_id: string;
    object_path: string;
    media_type: MemoryMedia["type"];
    display_order: number;
    caption: string | null;
    alt: string;
    width: number | null;
    height: number | null;
    duration: number | null;
    created_at: string;
  }>;
};

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(`Supabase request failed: ${error.message}`);
}

async function toMemory(row: MemoryRow, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<Memory> {
  const media = await Promise.all(
    [...(row.memory_media ?? [])]
      .sort((a, b) => a.display_order - b.display_order)
      .map(async (item): Promise<MemoryMedia> => {
        const { data, error } = await supabase.storage
          .from("memories")
          .createSignedUrl(item.object_path, 60 * 60);
        throwIfError(error);
        if (!data?.signedUrl) throw new Error("Supabase did not return a signed media URL.");

        return {
          id: item.id,
          memoryId: item.memory_id,
          type: item.media_type,
          url: data.signedUrl,
          path: item.object_path,
          order: item.display_order,
          alt: item.alt,
          caption: item.caption ?? undefined,
          width: item.width ?? undefined,
          height: item.height ?? undefined,
          duration: item.duration ?? undefined,
          createdAt: item.created_at,
        };
      }),
  );

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    event_description: row.event_description,
    memory_story: row.memory_story,
    feelings: row.feelings,
    personal_message: row.personal_message ?? undefined,
    memory_date: row.memory_date ?? undefined,
    date_is_approximate: row.date_is_approximate,
    location: row.location ?? undefined,
    category: row.category ?? undefined,
    tags: row.tags ?? [],
    animation_preset: row.animation_preset,
    display_order: row.display_order,
    is_featured: row.is_featured,
    status: row.status,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    media,
  };
}

export async function readMemories(): Promise<Memory[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("memories")
    .select("*, memory_media(*)")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  throwIfError(error);
  return Promise.all(((data ?? []) as unknown as MemoryRow[]).map((row) => toMemory(row, supabase)));
}

export async function writeMemories(memories: Memory[]) {
  if (!memories.length) return;
  const supabase = await createSupabaseServerClient();
  const memoryRows = memories.map((memory) => ({
    id: memory.id,
    title: memory.title,
    slug: memory.slug,
    event_description: memory.event_description,
    memory_story: memory.memory_story,
    feelings: memory.feelings,
    personal_message: memory.personal_message || null,
    memory_date: memory.memory_date || null,
    date_is_approximate: memory.date_is_approximate,
    location: memory.location || null,
    category: memory.category || null,
    tags: memory.tags,
    animation_preset: memory.animation_preset,
    display_order: memory.display_order,
    is_featured: memory.is_featured,
    status: memory.status,
    created_by: memory.created_by,
    created_at: memory.created_at,
    updated_at: memory.updated_at,
  }));
  const { error } = await supabase.from("memories").upsert(memoryRows, { onConflict: "id" });
  throwIfError(error);

  const mediaRows = memories.flatMap((memory) =>
    memory.media.map((media) => ({
      id: media.id,
      memory_id: memory.id,
      object_path: media.path,
      media_type: media.type,
      display_order: media.order,
      caption: media.caption || null,
      alt: media.alt,
      width: media.width ?? null,
      height: media.height ?? null,
      duration: media.duration ?? null,
    })),
  );
  if (mediaRows.length) {
    const { error: mediaError } = await supabase
      .from("memory_media")
      .upsert(mediaRows, { onConflict: "id" });
    throwIfError(mediaError);
  }
}

export async function deleteMemory(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("memories").delete().eq("id", id);
  throwIfError(error);
}

export async function readSiteSettings(): Promise<SiteSettings> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("title, subtitle, closing_letter")
    .eq("singleton", true)
    .single();
  throwIfError(error);
  if (!data) throw new Error("The site settings row is missing. Apply the Supabase migration.");
  return {
    title: data.title,
    subtitle: data.subtitle,
    closingLetter: data.closing_letter,
  };
}

export async function writeSiteSettings(settings: SiteSettings) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("site_settings").upsert({
    singleton: true,
    title: settings.title,
    subtitle: settings.subtitle,
    closing_letter: settings.closingLetter,
    updated_at: new Date().toISOString(),
  });
  throwIfError(error);
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
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("memories").select("id, slug");
  throwIfError(error);
  const existing = new Set(
    (data ?? [])
      .filter((memory) => memory.id !== excludeId)
      .map((memory) => memory.slug),
  );

  let candidate = base;
  let suffix = 1;
  while (existing.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
