import Image from "next/image";
import Link from "next/link";

import { logoutAction } from "@/app/actions";
import { formatMemoryDate } from "@/lib/memory-utils";
import type { AuthUser, Memory } from "@/lib/types";
import { FormError } from "@/components/form-error";

export function SiteNav({ user }: { user?: AuthUser | null }) {
  return (
    <header className="site-nav">
      <Link className="wordmark" href="/" aria-label="Our Little Universe home">
        <span className="wordmark-mark" aria-hidden="true">✳</span>
        <span>our little universe</span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/memories">Our story</Link>
        <Link href="/universe">Memory universe</Link>
        {user?.role === "admin" ? <Link href="/admin">Studio</Link> : null}
        {user ? (
          <form action={logoutAction}>
            <button className="nav-quiet-button" type="submit">Log out</button>
          </form>
        ) : (
          <Link className="nav-login" href="/login">Log in <span aria-hidden="true">↗</span></Link>
        )}
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

export function AdminNav({ active }: { active: "overview" | "settings" }) {
  return (
    <aside className="admin-sidebar">
      <Link className="admin-back" href="/">← Back to the universe</Link>
      <p className="eyebrow">THE MEMORY STUDIO</p>
      <h2>Make room<br />for more.</h2>
      <nav aria-label="Studio navigation">
        <Link className={active === "overview" ? "active" : ""} href="/admin">Overview <span>↗</span></Link>
        <Link href="/admin/memories/new">Create a memory <span>＋</span></Link>
        <Link className={active === "settings" ? "active" : ""} href="/admin/settings">Story settings <span>↗</span></Link>
      </nav>
      <div className="sidebar-note">Every little moment<br />deserves a place.</div>
    </aside>
  );
}

export { FormError };
