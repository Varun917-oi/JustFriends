import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";

import { MemoryForm } from "@/components/memory-form";
import { getCurrentUser } from "@/lib/auth";
import { getMemoryById } from "@/lib/data";

export const instant = false;

export default async function EditMemoryPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await connection();
  const [user, route, query] = await Promise.all([getCurrentUser(), params, searchParams]);
  if (user?.role !== "admin") redirect("/login");
  const memory = await getMemoryById(route.id);
  if (!memory) notFound();

  return (
    <main className="admin-form-page">
      <Link className="back-link" href="/admin">← Back to the studio</Link>
      <div className="form-page-heading"><p className="eyebrow">A LITTLE POLISH</p><h1>Edit memory</h1><p>Keep what matters. Change anything that needs a little more room.</p></div>
      <MemoryForm memory={memory} memoryId={memory.id} error={query.error} />
    </main>
  );
}
