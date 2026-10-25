import Link from "next/link";
import { connection } from "next/server";

import { MemoryMedia, SiteNav } from "@/components/site";
import { getPublishedMemories } from "@/lib/data";

export const instant = false;

export default async function UniversePage() {
  await connection();
  const memories = await getPublishedMemories();

  return (
    <main className="universe-page">
      <SiteNav />
      <section className="universe-intro">
        <p className="eyebrow">A DIFFERENT WAY TO WANDER</p>
        <h1>Memory universe</h1>
        <p>Little moments, scattered like stars. Choose one to drift a little closer.</p>
      </section>
      {memories.length ? (
        <div className="universe-field">
          <div className="universe-nebula" aria-hidden="true" />
          {memories.map((memory) => (
            <Link
              className="universe-memory"
              href={`/memories/${memory.slug}`}
              key={memory.id}
            >
              <span className="universe-card-art"><MemoryMedia memory={memory} /></span>
              <span className="universe-card-title">{memory.title}</span>
              <span className="universe-card-date">{memory.memory_date || "a little moment"}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-universe universe-empty">
          <span className="empty-orbit" aria-hidden="true">✧</span>
          <p className="eyebrow">NO STARS JUST YET</p>
          <h2>Your universe will take shape here.</h2>
          <p>Published memories will float into view as they are added.</p>
          <Link className="text-link" href="/memories">Return to the story <span aria-hidden="true">↗</span></Link>
        </div>
      )}
    </main>
  );
}
