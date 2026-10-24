import { existsSync } from "node:fs";
import path from "node:path";

const publicDirectory = path.join(process.cwd(), "public");

export function VideoBackground() {
  const webmExists = existsSync(path.join(publicDirectory, "background.webm"));
  const mp4Exists = existsSync(path.join(publicDirectory, "background.mp4"));

  return (
    <div className="video-background" aria-hidden="true">
      {webmExists || mp4Exists ? (
        <video autoPlay loop muted playsInline preload="metadata" tabIndex={-1}>
          {webmExists ? <source src="/background.webm" type="video/webm" /> : null}
          {mp4Exists ? <source src="/background.mp4" type="video/mp4" /> : null}
        </video>
      ) : null}
    </div>
  );
}
