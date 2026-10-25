"use server";

import { redirect } from "next/navigation";

import { clearSessionCookie, emailForUsername, getCurrentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const email = emailForUsername(username);
  if (!email || !password || password.length > 256) {
    redirect("/login?error=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.status === 400 || error.status === 401) redirect("/login?error=invalid");
    throw new Error(`Could not authenticate the account: ${error.message}`);
  }

  const user = await getCurrentUser();
  if (!user) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw new Error(`Could not clear the unauthorized session: ${signOutError.message}`);
    redirect("/login?error=invalid");
  }
  redirect("/");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
