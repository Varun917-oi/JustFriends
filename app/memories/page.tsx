import Link from "next/link";
import { connection } from "next/server";

import { MemoryCard, SiteNav } from "@/components/site";
import { ScrollReveal } from "@/components/scroll-reveal";
import { getPublishedMemories, readSiteSettings } from "@/lib/data";

export const instant = false;

export default async function MemoriesPage() {
  await connection();
  const [memories, settings] = await Promise.all([
    getPublishedMemories(),
    readSiteSettings(),
  ]);

  return (
    <main className="inner-page">
      <SiteNav />
      <section className="story-intro page-wrap">
        <p className="eyebrow">CHAPTERS OF US</p>
        <h1>{settings.title}</h1>
        <p>{settings.subtitle}</p>
        <span className="story-sparkle" aria-hidden="true">✳</span>
      </section>
      <section className="story-list page-wrap" aria-label="Published memories">
        {memories.length ? (
          <>
            <div className="story-progress"><span>OUR STORY</span><span>{memories.length} LITTLE CHAPTER{memories.length === 1 ? "" : "S"}</span></div>
            <div className="memory-grid">
              {memories.map((memory, index) => (
                <ScrollReveal key={memory.id}>
                  <MemoryCard memory={memory} index={index} />
                </ScrollReveal>
              ))}
            </div>
            <div className="closing-card" id="letter">
              <p className="eyebrow">A NOTE FOR THE ROAD</p>
              <span className="closing-stars" aria-hidden="true">✧　·　✦　·　✧</span>
              <p>{settings.closingLetter}</p>
              <Link className="button button-quiet" href="/">Back to the beginning <span aria-hidden="true">↗</span></Link>
            </div>
          </>
        ) : (
          <div className="empty-universe story-empty">
            <span className="empty-orbit" aria-hidden="true">✧</span>
            <p className="eyebrow">A QUIET SKY, FOR NOW</p>
            <h2>No chapters have been published yet.</h2>
            <p>Once a memory is ready to share, it will find its place in the story.</p>
          </div>
        )}
      </section>
      <footer className="site-footer page-wrap"><span>OUR LITTLE UNIVERSE <span aria-hidden="true">✳</span></span><Link href="/universe">Float among the memories ↗</Link></footer>
    </main>
  );
}
