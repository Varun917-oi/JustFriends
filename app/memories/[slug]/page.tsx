import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";

import { MemoryMedia, SiteNav } from "@/components/site";
import { getCurrentUser } from "@/lib/auth";
import { formatMemoryDate, getMemoryBySlug, getPublishedMemories } from "@/lib/data";

export const instant = false;

export default async function MemoryPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const [memory, user, published] = await Promise.all([
    getMemoryBySlug(slug),
    getCurrentUser(),
    getPublishedMemories(),
  ]);

  if (!memory || (memory.status !== "published" && user?.role !== "admin")) notFound();
  const index = published.findIndex((item) => item.id === memory.id);
  const previous = index > 0 ? published[index - 1] : null;
  const next = index >= 0 ? published[index + 1] : null;

  return (
    <main className="memory-detail-page">
      <SiteNav user={user} />
      <article className={`memory-detail preset-${memory.animation_preset}`}>
        <header className="memory-detail-heading page-wrap">
          <Link className="back-link" href="/memories">← All memories</Link>
          <p className="eyebrow">{memory.category || "A LITTLE CHAPTER"}{memory.location ? ` · ${memory.location}` : ""}</p>
          <h1>{memory.title}</h1>
          <p className="memory-detail-date">{formatMemoryDate(memory.memory_date)}{memory.date_is_approximate ? " · around then" : ""}</p>
        </header>
        <div className="detail-media-wrap"><MemoryMedia memory={memory} /></div>
        <div className="memory-detail-copy page-wrap">
          {memory.event_description ? <section><p className="eyebrow">WHAT HAPPENED</p><p className="story-body lead-story">{memory.event_description}</p></section> : null}
          {memory.memory_story ? <section><p className="eyebrow">THE MEMORY</p><p className="story-body">{memory.memory_story}</p></section> : null}
          {memory.feelings ? <section className="feeling-note"><p className="eyebrow">WHAT I FELT</p><p className="story-body">{memory.feelings}</p></section> : null}
          {memory.personal_message ? <section className="personal-note"><p className="eyebrow">A LITTLE MESSAGE</p><p>{memory.personal_message}</p></section> : null}
          {memory.tags.length ? <p className="memory-tags">{memory.tags.map((tag) => <span key={tag}>#{tag}</span>)}</p> : null}
        </div>
      </article>
      <nav className="memory-pager page-wrap" aria-label="Memory navigation">
        {previous ? <Link href={`/memories/${previous.slug}`}><small>PREVIOUS CHAPTER</small><span>← {previous.title}</span></Link> : <span />}
        {next ? <Link className="pager-next" href={`/memories/${next.slug}`}><small>NEXT CHAPTER</small><span>{next.title} →</span></Link> : <Link className="pager-next" href="/memories"><small>THE STORY</small><span>Back to all memories →</span></Link>}
      </nav>
    </main>
  );
}
