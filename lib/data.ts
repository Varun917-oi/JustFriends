import "server-only";

import { requireAuthorizedUser } from "@/lib/auth";
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
  created_by: string | null;
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

async function requireAuthorizedUserForPrivateData() {
  const user = await requireAuthorizedUser();
  if (!user) throw new Error("An authenticated account is required to access private memories.");
  return user;
}

function toMemory(row: MemoryRow): Memory {
  const media = [...(row.memory_media ?? [])]
    .sort((a, b) => a.display_order - b.display_order)
    .map((item): MemoryMedia => ({
      id: item.id,
      memoryId: item.memory_id,
      type: item.media_type,
      url: `/media/${item.object_path.split("/").map(encodeURIComponent).join("/")}`,
      path: item.object_path,
      order: item.display_order,
      alt: item.alt,
      caption: item.caption ?? undefined,
      width: item.width ?? undefined,
      height: item.height ?? undefined,
      duration: item.duration ?? undefined,
      createdAt: item.created_at,
    }));

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
    created_by: row.created_by ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    media,
  };
}

export async function readMemories(): Promise<Memory[]> {
  await requireAuthorizedUserForPrivateData();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("memories")
    .select("*, memory_media(*)")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  throwIfError(error);
  return ((data ?? []) as unknown as MemoryRow[]).map(toMemory);
}

export async function readSiteSettings(): Promise<SiteSettings> {
  await requireAuthorizedUserForPrivateData();
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

export async function getPublishedMemories() {
  const memories = await readMemories();
  return memories.filter((memory) => memory.status === "published");
}

export async function getMemoryBySlug(slug: string) {
  const memories = await readMemories();
  return memories.find((memory) => memory.slug === slug) ?? null;
}
