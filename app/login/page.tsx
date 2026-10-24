import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";

export const instant = false;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  if (user) redirect(user.role === "admin" ? "/admin" : "/memories");

  return (
    <main className="login-page">
      <div className="login-stars" aria-hidden="true"><span>✦</span><span>·</span><span>✧</span><span>·</span><span>✦</span></div>
      <Link href="/" className="back-link login-back">← The beginning</Link>
      <div className="login-panel">
        <span className="login-emblem" aria-hidden="true">✳</span>
        <p className="eyebrow">A PRIVATE LITTLE SPACE</p>
        <h1>Come on in.</h1>
        <p className="login-intro">Some memories are just for us.</p>
        <LoginForm hasError={query.error === "invalid"} />
      </div>
    </main>
  );
}
