"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clearSessionCookie, emailForUsername, getCurrentUser } from "@/lib/auth";
import { createUniqueSlug, deleteMemory, readMemories, readSiteSettings, writeMemories, writeSiteSettings } from "@/lib/data";
import { registerUploadedMedia, removeMemoryUploads } from "@/lib/media";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AnimationPreset, Memory, MemoryStatus, UploadedMediaInput } from "@/lib/types";

const animationPresets: AnimationPreset[] = [
  "dreamy-fade",
  "polaroid-reveal",
  "cinematic-zoom",
  "floating-memory",
  "paper-story",
  "parallax-journey",
  "minimal-reveal",
];

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function getStatus(value: string): MemoryStatus {
  return value === "published" ? "published" : "draft";
}

function getPreset(value: string): AnimationPreset {
  return animationPresets.includes(value as AnimationPreset)
    ? (value as AnimationPreset)
    : "dreamy-fade";
}

function getUploadedMedia(formData: FormData, memoryId: string): UploadedMediaInput[] {
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("uploadedMedia") ?? "[]")) as unknown;
  } catch {
    throw new Error("The uploaded media list is invalid.");
  }
  if (!Array.isArray(payload) || payload.length > 8) throw new Error("The uploaded media list is invalid.");

  return payload.map((item): UploadedMediaInput => {
    if (
      !item ||
      typeof item !== "object" ||
      !("objectPath" in item) ||
      !("mimeType" in item) ||
      !("size" in item) ||
      typeof item.objectPath !== "string" ||
      typeof item.mimeType !== "string" ||
      typeof item.size !== "number" ||
      !item.objectPath.startsWith(`${memoryId}/`)
    ) {
      throw new Error("An uploaded media reference is invalid.");
    }
    return { objectPath: item.objectPath, mimeType: item.mimeType, size: item.size };
  });
}

function validMemoryFields(formData: FormData) {
  const limits: Record<string, number> = {
    title: 140,
    event_description: 5000,
    memory_story: 10000,
    feelings: 3000,
    personal_message: 3000,
    location: 120,
    category: 80,
    tags: 500,
  };
  if (Object.entries(limits).some(([name, limit]) => field(formData, name).length > limit)) return false;

  const date = field(formData, "memory_date");
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) return false;
  }

  const order = field(formData, "display_order");
  return !order || (/^\d+$/.test(order) && Number(order) >= 1 && Number(order) <= 100000);
}

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const email = emailForUsername(username);
  if (!email || !password || password.length > 256) {
    redirect("/login?error=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=invalid");
  const user = await getCurrentUser();
  if (!user) {
    await supabase.auth.signOut();
    redirect("/login?error=invalid");
  }
  redirect("/admin");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export async function createMemoryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/login");

  const title = field(formData, "title");
  if (!title || !validMemoryFields(formData)) redirect("/admin/memories/new?error=fields");

  const memories = await readMemories();
  const id = field(formData, "memoryId");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/admin/memories/new?error=fields");
  const now = new Date().toISOString();
  const date = field(formData, "memory_date");
  const uploaded = await registerUploadedMedia(id, title, getUploadedMedia(formData, id));
  const memory: Memory = {
    id,
    title,
    slug: await createUniqueSlug(title),
    event_description: field(formData, "event_description"),
    memory_story: field(formData, "memory_story"),
    feelings: field(formData, "feelings"),
    personal_message: field(formData, "personal_message") || undefined,
    memory_date: date || undefined,
    date_is_approximate: formData.get("date_is_approximate") === "on",
    location: field(formData, "location") || undefined,
    category: field(formData, "category") || undefined,
    tags: field(formData, "tags").split(",").map((tag) => tag.trim()).filter(Boolean),
    animation_preset: getPreset(field(formData, "animation_preset")),
    display_order: Number(field(formData, "display_order")) || memories.length + 1,
    is_featured: formData.get("is_featured") === "on",
    status: getStatus(field(formData, "status")),
    created_by: user.username,
    created_at: now,
    updated_at: now,
    media: uploaded,
  };

  try {
    await writeMemories([...memories, memory]);
  } catch (error) {
    const cleanupErrors: Error[] = [];
    try {
      await deleteMemory(memory.id);
    } catch (cleanupError) {
      cleanupErrors.push(cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError)));
    }
    try {
      await removeMemoryUploads(uploaded);
    } catch (cleanupError) {
      cleanupErrors.push(cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError)));
    }
    if (cleanupErrors.length) throw new AggregateError([error, ...cleanupErrors], "Memory creation failed and cleanup was incomplete.");
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/memories");
  revalidatePath("/admin");
  redirect(`/memories/${memory.slug}`);
}

export async function updateMemoryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/login");

  const id = field(formData, "id");
  const memories = await readMemories();
  const target = memories.find((memory) => memory.id === id);
  if (!target) redirect("/admin");

  const title = field(formData, "title");
  if (!title || !validMemoryFields(formData)) redirect(`/admin/memories/${id}/edit?error=fields`);

  const newFiles = getUploadedMedia(formData, id);
  if (target.media.length + newFiles.length > 8) {
    redirect(`/admin/memories/${id}/edit?error=media-limit`);
  }

  const uploaded = await registerUploadedMedia(
    id,
    title,
    getUploadedMedia(formData, id),
    target.media.length + 1,
  );
  const previousTitle = target.title;
  const previousMedia = target.media;
  target.title = title;
  target.slug = title === previousTitle ? target.slug : await createUniqueSlug(title, id);
  target.event_description = field(formData, "event_description");
  target.memory_story = field(formData, "memory_story");
  target.feelings = field(formData, "feelings");
  target.personal_message = field(formData, "personal_message") || undefined;
  target.memory_date = field(formData, "memory_date") || undefined;
  target.date_is_approximate = formData.get("date_is_approximate") === "on";
  target.location = field(formData, "location") || undefined;
  target.category = field(formData, "category") || undefined;
  target.tags = field(formData, "tags").split(",").map((tag) => tag.trim()).filter(Boolean);
  target.animation_preset = getPreset(field(formData, "animation_preset"));
  target.display_order = Number(field(formData, "display_order")) || target.display_order;
  target.is_featured = formData.get("is_featured") === "on";
  target.status = getStatus(field(formData, "status"));
  target.updated_at = new Date().toISOString();
  target.media = [...target.media, ...uploaded];

  try {
    await writeMemories(memories);
  } catch (error) {
    target.media = previousMedia;
    await removeMemoryUploads(uploaded);
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/memories");
  revalidatePath(`/memories/${target.slug}`);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function deleteMemoryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/login");

  const id = field(formData, "id");
  const memories = await readMemories();
  const target = memories.find((memory) => memory.id === id);
  if (!target) redirect("/admin");

  await deleteMemory(id);
  await removeMemoryUploads(target.media);
  revalidatePath("/");
  revalidatePath("/memories");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function updateSiteSettingsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/login");

  const settings = await readSiteSettings();
  if (
    field(formData, "title").length > 100 ||
    field(formData, "subtitle").length > 180 ||
    field(formData, "closingLetter").length > 5000
  ) redirect("/admin/settings?error=fields");
  settings.title = field(formData, "title") || settings.title;
  settings.subtitle = field(formData, "subtitle") || settings.subtitle;
  settings.closingLetter = field(formData, "closingLetter") || settings.closingLetter;
  await writeSiteSettings(settings);
  revalidatePath("/");
  revalidatePath("/memories");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=1");
}

export async function changePasswordAction(formData: FormData) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/login");

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const email = emailForUsername(user.username);
  if (!email) redirect("/login");

  if (currentPassword.length > 256 || newPassword.length < 12 || newPassword.length > 256) {
    redirect("/admin/settings?passwordError=weak");
  }
  if (newPassword !== confirmPassword) {
    redirect("/admin/settings?passwordError=mismatch");
  }
  const supabase = await createSupabaseServerClient();
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verifyError) {
    redirect("/admin/settings?passwordError=current");
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) redirect("/admin/settings?passwordError=update");
  redirect("/admin/settings?password=updated");
}
