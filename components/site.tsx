import Image from "next/image";
import Link from "next/link";

import { logoutAction } from "@/app/actions";
import { formatMemoryDate } from "@/lib/memory-utils";
import { ScrollReveal } from "@/components/scroll-reveal";
import type { Memory } from "@/lib/types";

export function SiteNav() {
  return (
    <header className="site-nav">
      <Link className="wordmark" href="/" aria-label="Our Little Universe home">
        <span className="wordmark-mark" aria-hidden="true">✳</span>
        <span>our little universe</span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/memories">Our story</Link>
        <Link href="/universe">Memory universe</Link>
        <form action={logoutAction}>
          <button className="nav-quiet-button" type="submit">Log out</button>
        </form>
      </nav>
    </header>
  );
}

export function MemoryMedia({ memory, className = "" }: { memory: Memory; className?: string }) {
  const media = [...memory.media].sort((a, b) => a.order - b.order);
  if (!media.length) {
    return (
      <div className={`memory-art-placeholder ${className}`} role="img" aria-label="No photograph has been added to this memory yet">
        <span className="placeholder-orbit" aria-hidden="true">✳</span>
        <span>your photograph<br />will live here</span>
      </div>
    );
  }

  return (
    <div className={`memory-media-grid ${className}`}>
      {media.map((item) => (
        <figure className="memory-media-frame" key={item.id}>
          {item.type === "video" ? (
            <video controls preload="metadata" aria-label={item.alt} src={item.url} />
          ) : (
            <Image
              src={item.url}
              alt={item.alt}
              width={item.width || 1400}
              height={item.height || 1000}
              unoptimized
            />
          )}
          {item.caption ? <figcaption>{item.caption}</figcaption> : null}
        </figure>
      ))}
    </div>
  );
}

export function MemoryCard({ memory, index = 0 }: { memory: Memory; index?: number }) {
  return (
    <article className={`memory-card memory-card-${index % 3}`}>
      <Link className="memory-card-link" href={`/memories/${memory.slug}`}>
        <div className="memory-card-art">
          <MemoryMedia memory={memory} />
          <span className="card-number">{String(index + 1).padStart(2, "0")}</span>
        </div>
        <div className="memory-card-copy">
          <p className="eyebrow">{formatMemoryDate(memory.memory_date)}{memory.date_is_approximate ? " · around then" : ""}</p>
          <h3>{memory.title}</h3>
          <p>{memory.event_description || memory.memory_story || "A little moment, saved for later."}</p>
          <span className="text-link">Open this memory <span aria-hidden="true">↗</span></span>
        </div>
      </Link>
    </article>
  );
}

export function PhotoWall({ memories }: { memories: Memory[] }) {
  const photos = memories.flatMap((memory) =>
    memory.media
      .filter((media) => media.type === "image")
      .map((media) => ({ memory, media })),
  ).slice(0, 16);

  if (!photos.length) return null;

  return (
    <section className="snapshot-section page-wrap" aria-label="Photographs from published memories">
      <div className="section-heading snapshot-heading">
        <div>
          <p className="eyebrow">LITTLE MOMENTS, UP CLOSE</p>
          <h2>A few snapshots<br />of us.</h2>
        </div>
        <Link className="text-link" href="/memories">See every memory <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="snapshot-grid">
        {photos.map(({ memory, media }, index) => (
          <ScrollReveal key={media.id}>
            <figure className={`snapshot-card snapshot-card-${index % 6}`}>
              <Link href={`/memories/${memory.slug}`} aria-label={`Open memory: ${memory.title}`}>
                <Image
                  src={media.url}
                  alt={media.alt}
                  width={media.width || 1200}
                  height={media.height || 900}
                  unoptimized
                  loading="lazy"
                />
                <figcaption>
                  <span>{media.caption || memory.title}</span>
                  <span aria-hidden="true">↗</span>
                </figcaption>
              </Link>
            </figure>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
