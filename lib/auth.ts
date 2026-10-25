import "server-only";

import type { AuthUser } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const accountEmails: Record<string, string | undefined> = {
  Varun: process.env.VARUN_ADMIN_EMAIL,
  Akrati: process.env.AKRATI_ADMIN_EMAIL,
};

export function emailForUsername(username: string) {
  return accountEmails[username]?.trim().toLowerCase() || null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError && authData.user) {
    throw new Error(`Supabase authentication failed: ${authError.message}`);
  }
  if (!authData.user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("username, role")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (error) throw new Error(`Could not load the signed-in account profile: ${error.message}`);
  if (!profile || profile.role !== "admin" || emailForUsername(profile.username) !== authData.user.email) {
    return null;
  }

  return { username: profile.username, role: "admin" };
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

export async function clearSessionCookie() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(`Could not sign out: ${error.message}`);
}
