import type { AnimationPreset } from "@/lib/types";

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
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Date unknown";

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
