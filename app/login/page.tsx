import { connection } from "next/server";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";

export const instant = false;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  const isConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() &&
    process.env.VARUN_ADMIN_EMAIL?.trim() &&
    process.env.AKRATI_ADMIN_EMAIL?.trim() &&
    process.env.VARUN_ADMIN_EMAIL.trim().toLowerCase() !==
      process.env.AKRATI_ADMIN_EMAIL.trim().toLowerCase(),
  );
  const [user, query] = await Promise.all([
    isConfigured ? getCurrentUser() : Promise.resolve(null),
    searchParams,
  ]);
  if (user) redirect("/");

  return (
    <main className="login-page">
      <div className="login-stars" aria-hidden="true"><span>✦</span><span>·</span><span>✧</span><span>·</span><span>✦</span></div>
      <div className="login-panel">
        <span className="login-emblem" aria-hidden="true">✳</span>
        <p className="eyebrow">A PRIVATE LITTLE SPACE</p>
        <h1>Come on in.</h1>
        <p className="login-intro">Some memories are just for us.</p>
        {isConfigured ? (
          <LoginForm hasError={query.error === "invalid"} />
        ) : (
          <p className="form-error" role="alert">
            Sign-in is not configured for this site yet.
          </p>
        )}
      </div>
    </main>
  );
}
