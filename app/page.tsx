import Link from "next/link";
import { connection } from "next/server";

import { ScrollReveal } from "@/components/scroll-reveal";
import { MemoryCard, PhotoWall, SiteNav } from "@/components/site";
import { defaultSettings, getPublishedMemories, readSiteSettings } from "@/lib/data";

export const instant = false;

export default async function Home() {
  await connection();
  const [settings, memories] = await Promise.all([readSiteSettings(), getPublishedMemories()]);
  const chapters = memories;

  return (
    <main className="home-shell">
      <div className="hero-sky" aria-hidden="true">
        <div className="moon" />
        <span className="sky-star star-a">✦</span><span className="sky-star star-b">·</span>
        <span className="sky-star star-c">✧</span><span className="sky-star star-d">·</span>
        <span className="sky-star star-e">✦</span><span className="sky-star star-f">·</span>
        <div className="sky-haze" />
      </div>
      <SiteNav />
      <section className="hero-section" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow"><span /> A PLACE FOR THE LITTLE THINGS <span /></p>
          <h1 id="home-title">{settings.title || defaultSettings.title}<span className="heart-mark" aria-hidden="true">♡</span></h1>
          <p className="hero-subtitle">{settings.subtitle || defaultSettings.subtitle}</p>
          <Link className="button button-primary hero-button" href="/memories">
            Enter our memories <span aria-hidden="true">↗</span>
          </Link>
          <p className="hero-caption">Made of moments, kept close.</p>
        </div>
        <a className="scroll-cue" href="#chapters">
          <span className="scroll-cue-line" />
          <span>SCROLL A LITTLE</span>
          <span aria-hidden="true">↓</span>
        </a>
      </section>

      <PhotoWall memories={memories} />

      <section id="chapters" className="home-chapters page-wrap">
        <div className="section-heading">
          <div><p className="eyebrow">CHAPTERS OF US</p><h2>Every story starts<br />somewhere.</h2></div>
          <Link className="text-link" href="/memories">Explore the whole story <span aria-hidden="true">↗</span></Link>
        </div>
        {chapters.length ? (
          <div className="memory-grid">
            {chapters.map((memory, index) => (
              <ScrollReveal key={memory.id}>
                <MemoryCard memory={memory} index={index} />
              </ScrollReveal>
            ))}
          </div>
        ) : (
          <div className="empty-universe">
            <span className="empty-orbit" aria-hidden="true">✧</span>
            <p className="eyebrow">THE SKY IS STILL OPEN</p>
            <h3>Your story is waiting to be gathered.</h3>
            <p>Your memories will find their place here as they are brought into the collection.</p>
          </div>
        )}
      </section>

      <footer className="site-footer page-wrap">
        <span>OUR LITTLE UNIVERSE <span aria-hidden="true">✳</span></span>
        <span>Some moments find their way back to us.</span>
        <Link href="/memories">A private little space</Link>
      </footer>
    </main>
  );
}
