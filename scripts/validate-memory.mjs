import { realpath, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  memoryIdFor,
  prepareMedia,
  uniqueMediaByPath,
  validateManifest,
} from "./import-memory.mjs";

function manifestArgument(args) {
  if (args.length !== 2 || args[0] !== "--manifest" || !args[1]) {
    throw new Error("Pass exactly one manifest with --manifest <path>.");
  }
  return args[1];
}

async function main() {
  const manifestPath = await realpath(path.resolve(manifestArgument(process.argv.slice(2))));
  const manifestDirectory = path.dirname(manifestPath);
  const rawManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const manifest = validateManifest(rawManifest);
  const memoryId = memoryIdFor(manifest);
  const prepared = await prepareMedia(manifest, manifestDirectory, memoryId);
  const uniqueMedia = uniqueMediaByPath(prepared);

  console.log(`Valid memory package: ${manifest.title}`);
  console.log(`Stable memory ID: ${memoryId}`);
  console.log(`Media files: ${uniqueMedia.length} valid, ${prepared.length - uniqueMedia.length} duplicate(s)`);
  for (const media of uniqueMedia) {
    console.log(`  ${media.originalPath}: ${media.mime}, ${media.bytes.byteLength} bytes`);
  }
  console.log("No files were copied, uploaded, or changed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Memory package validation failed.");
    process.exitCode = 1;
  });
}
