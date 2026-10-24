import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <span aria-hidden="true">✧</span>
      <p className="eyebrow">A LITTLE TOO FAR INTO THE SKY</p>
      <h1>This memory isn’t here.</h1>
      <p>It may have moved, or it may still be waiting to be shared.</p>
      <Link className="button button-primary" href="/memories">Return to the story <span aria-hidden="true">↗</span></Link>
    </main>
  );
}
