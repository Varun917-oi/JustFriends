import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { MemoryForm } from "@/components/memory-form";
import { getCurrentUser } from "@/lib/auth";

export const instant = false;

export default async function NewMemoryPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  if (user?.role !== "admin") redirect("/login");

  return (
    <main className="admin-form-page">
      <Link className="back-link" href="/admin">← Back to the studio</Link>
      <div className="form-page-heading"><p className="eyebrow">ANOTHER LITTLE CHAPTER</p><h1>Create a memory</h1><p>Take your time. The small details are the ones you’ll want to find again.</p></div>
      <MemoryForm error={query.error} />
    </main>
  );
}
