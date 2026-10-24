import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { DeleteMemoryButton } from "@/components/delete-memory-button";
import { AdminNav, SiteNav } from "@/components/site";
import { getCurrentUser } from "@/lib/auth";
import { readMemories } from "@/lib/data";

export const instant = false;

export default async function AdminPage() {
  await connection();
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/login");
  const memories = await readMemories();
  const published = memories.filter((memory) => memory.status === "published");
  const drafts = memories.filter((memory) => memory.status === "draft");
  const photos = memories.reduce((count, memory) => count + memory.media.filter((media) => media.type === "image").length, 0);
  const videos = memories.reduce((count, memory) => count + memory.media.filter((media) => media.type === "video").length, 0);

  return (
    <main className="admin-page">
      <SiteNav user={user} />
      <div className="admin-layout">
        <AdminNav active="overview" />
        <section className="admin-main">
          <div className="admin-welcome">
            <div><p className="eyebrow">YOUR LITTLE CORNER</p><h1>Good evening, {user.username}.</h1><p>There’s always room for one more moment.</p></div>
            <Link className="button button-primary" href="/admin/memories/new">＋ Create a memory</Link>
          </div>
          <div className="stat-grid">
            <article className="stat-card"><span>All memories</span><strong>{memories.length}</strong><small>little chapters</small></article>
            <article className="stat-card"><span>Published</span><strong>{published.length}</strong><small>in the story</small></article>
            <article className="stat-card"><span>Drafts</span><strong>{drafts.length}</strong><small>just for you</small></article>
            <article className="stat-card"><span>Media</span><strong>{photos + videos}</strong><small>{photos} photos · {videos} videos</small></article>
          </div>
          <div className="admin-list-heading">
            <div><p className="eyebrow">THE COLLECTION</p><h2>All memories <span>{memories.length}</span></h2></div>
            <Link className="text-link" href="/admin/settings">Story settings ↗</Link>
          </div>
          {memories.length ? (
            <div className="memory-table-wrap">
              <table className="memory-table">
                <thead><tr><th>Memory</th><th>Order</th><th>Media</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {memories.map((memory) => (
                    <tr key={memory.id}>
                      <td><strong>{memory.title}</strong><small>{memory.memory_date || "Date unknown"}{memory.category ? ` · ${memory.category}` : ""}</small></td>
                      <td>{memory.display_order}</td>
                      <td>{memory.media.length} file{memory.media.length === 1 ? "" : "s"}</td>
                      <td><span className={`status-pill status-${memory.status}`}>{memory.status}</span></td>
                      <td className="table-actions">
                        <Link className="table-action" href={`/memories/${memory.slug}`}>Preview</Link>
                        <Link className="table-action" href={`/admin/memories/${memory.id}/edit`}>Edit</Link>
                        <DeleteMemoryButton id={memory.id} title={memory.title} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty">
              <span aria-hidden="true">✧</span><h3>Your collection is a blank canvas.</h3>
              <p>Add the first real moment whenever you’re ready.</p>
              <Link className="button button-primary" href="/admin/memories/new">Create the first memory <span aria-hidden="true">↗</span></Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
