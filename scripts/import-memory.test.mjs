import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import os from "node:os";
import path from "node:path";

import {
  memoryIdFor,
  planNewMedia,
  prepareMedia,
  resolveExistingMemory,
  uniqueMediaByPath,
  validateManifest,
} from "./import-memory.mjs";

const manifest = {
  title: "A Lake Afternoon",
  date: "2025-06-01",
  event_description: "An afternoon together.",
  existingMemory: undefined,
};

test("repeated manifests derive the same memory identifier", () => {
  assert.equal(memoryIdFor(manifest), memoryIdFor({ ...manifest }));
  assert.equal(memoryIdFor(manifest), memoryIdFor({ ...manifest, title: "a lake afternoon" }));
});

test("explicit memory IDs remain stable when descriptive fields change", () => {
  const id = "12345678-1234-1234-1234-123456789abc";
  assert.equal(memoryIdFor({ ...manifest, id }), id);
  assert.equal(memoryIdFor({ ...manifest, id, title: "Another title" }), id);
});

test("manifest captions map to the existing short-description field", () => {
  const validated = validateManifest({
    title: "A Lake Afternoon",
    createdBy: "Varun",
    caption: "A short caption.",
    memoryStory: "A longer description.",
    media: [{ path: "lake.jpg" }],
  });
  assert.equal(validated.event_description, "A short caption.");
  assert.equal(validated.memory_story, "A longer description.");
});

test("invalid explicit IDs and conflicting caption aliases are rejected", () => {
  assert.throws(
    () => validateManifest({
      title: "A Lake Afternoon",
      createdBy: "Varun",
      id: "not-a-uuid",
      media: [{ path: "lake.jpg" }],
    }),
    /id must be a UUID/,
  );
  assert.throws(
    () => validateManifest({
      title: "A Lake Afternoon",
      createdBy: "Varun",
      caption: "One caption",
      eventDescription: "Another caption",
      media: [{ path: "lake.jpg" }],
    }),
    /Use either caption or eventDescription/,
  );
});

test("the package validator reports missing media references", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "memory-package-"));
  try {
    const validated = validateManifest({
      title: "A memory without a date",
      media: [{ path: "missing.jpg" }],
    });
    await assert.rejects(
      prepareMedia(validated, directory, memoryIdFor(validated)),
      /ENOENT/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("exact matching chapters are reused and explicit identifiers select a chapter", () => {
  const chapter = { id: "12345678-1234-1234-1234-123456789abc", title: "A Lake Afternoon", slug: "lake" };
  assert.equal(resolveExistingMemory(manifest, [chapter]), chapter);
  assert.equal(resolveExistingMemory({ ...manifest, title: "Different title", existingMemory: "lake" }, [chapter]), chapter);
});

test("uncertain chapter matches require an explicit identifier", () => {
  const chapter = { id: "12345678-1234-1234-1234-123456789abc", title: "A Lake Afternoon", slug: "lake" };
  assert.throws(
    () => resolveExistingMemory({ ...manifest, title: "A Lake Afternon" }, [chapter]),
    /Possible existing chapter match/,
  );
});

test("identical processed media is deduplicated and a reimport adds no files", () => {
  const media = { id: "media-id", object_path: "memory-id/imports/content.webp" };
  const unique = uniqueMediaByPath([media, { ...media }]);
  const plan = planNewMedia(unique, [{ object_path: media.object_path, display_order: 1 }]);
  assert.equal(unique.length, 1);
  assert.equal(plan.newMedia.length, 0);
  assert.equal(plan.orderedMedia.length, 0);
});

test("new files retain manifest order after the existing chapter media", () => {
  const plan = planNewMedia(
    [{ object_path: "new-a" }, { object_path: "new-b" }],
    [{ object_path: "old-a", display_order: 1 }, { object_path: "old-b", display_order: 3 }],
  );
  assert.deepEqual(plan.orderedMedia.map((item) => item.display_order), [4, 5]);
});

test("the media limit rejects an import before it can mutate storage", () => {
  const prepared = Array.from({ length: 2 }, (_, index) => ({ object_path: `new-${index}` }));
  const existing = Array.from({ length: 7 }, (_, index) => ({
    object_path: `old-${index}`,
    display_order: index + 1,
  }));
  assert.throws(() => planNewMedia(prepared, existing), /8-file media limit/);
});
