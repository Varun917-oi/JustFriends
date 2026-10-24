export type MemoryStatus = "draft" | "published";
export type AnimationPreset =
  | "dreamy-fade"
  | "polaroid-reveal"
  | "cinematic-zoom"
  | "floating-memory"
  | "paper-story"
  | "parallax-journey"
  | "minimal-reveal";

export type UserRole = "admin";

export interface MemoryMedia {
  id: string;
  memoryId: string;
  type: "image" | "video";
  url: string;
  path: string;
  order: number;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  duration?: number;
  createdAt: string;
}

export interface Memory {
  id: string;
  title: string;
  slug: string;
  event_description: string;
  memory_story: string;
  feelings: string;
  personal_message?: string;
  memory_date?: string;
  date_is_approximate: boolean;
  location?: string;
  category?: string;
  tags: string[];
  animation_preset: AnimationPreset;
  display_order: number;
  is_featured: boolean;
  status: MemoryStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  media: MemoryMedia[];
}

export interface SiteSettings {
  title: string;
  subtitle: string;
  closingLetter: string;
}

export interface AuthUser {
  username: string;
  role: UserRole;
}
