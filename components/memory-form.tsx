import { createMemoryAction, updateMemoryAction } from "@/app/actions";
import { animationPresets, formatMemoryDate } from "@/lib/data";
import { MediaPicker } from "@/components/media-picker";
import type { Memory } from "@/lib/types";
import { FormError } from "@/components/site";

const presetNames: Record<string, string> = {
  "dreamy-fade": "Dreamy fade",
  "polaroid-reveal": "Polaroid reveal",
  "cinematic-zoom": "Cinematic zoom",
  "floating-memory": "Floating memory",
  "paper-story": "Paper story",
  "parallax-journey": "Parallax journey",
  "minimal-reveal": "Minimal reveal",
};

export function MemoryForm({ memory, error }: { memory?: Memory; error?: string }) {
  const action = memory ? updateMemoryAction : createMemoryAction;
  return (
    <form className="memory-form" action={action}>
      {memory ? <input type="hidden" name="id" value={memory.id} /> : null}
      <FormError error={error} />

      <section className="form-section">
        <p className="eyebrow">01 — THE MOMENT</p>
        <h2>Give this memory a name.</h2>
        <label className="field-wide">
          <span>Memory title <b>*</b></span>
          <input
            required
            maxLength={140}
            name="title"
            placeholder="That evening we couldn’t stop laughing"
            defaultValue={memory?.title}
          />
        </label>
        <label className="field-wide">
          <span>What happened that day?</span>
          <textarea name="event_description" rows={3} placeholder="The little details that brought you here…" defaultValue={memory?.event_description} />
        </label>
        <label className="field-wide">
          <span>The story</span>
          <textarea name="memory_story" rows={5} placeholder="Write the story the way you want to remember it…" defaultValue={memory?.memory_story} />
        </label>
      </section>

      <section className="form-section">
        <p className="eyebrow">02 — THE FEELING</p>
        <h2>What stayed with you?</h2>
        <label className="field-wide">
          <span>What I felt</span>
          <textarea name="feelings" rows={3} placeholder="A thought, a feeling, a detail you want to keep…" defaultValue={memory?.feelings} />
        </label>
        <label className="field-wide">
          <span>A message for Akrati <small>Optional</small></span>
          <textarea name="personal_message" rows={3} placeholder="A little note, just for her…" defaultValue={memory?.personal_message} />
        </label>
      </section>

      <section className="form-section">
        <p className="eyebrow">03 — THE DETAILS</p>
        <h2>Place it in your timeline.</h2>
        <div className="form-grid">
          <label>
            <span>Date of memory</span>
            <input type="date" name="memory_date" defaultValue={memory?.memory_date} />
          </label>
          <label>
            <span>Location <small>Optional</small></span>
            <input name="location" placeholder="A place you remember" defaultValue={memory?.location} />
          </label>
          <label>
            <span>Category <small>Optional</small></span>
            <input name="category" placeholder="A little adventure" defaultValue={memory?.category} />
          </label>
          <label>
            <span>Tags <small>Separate with commas</small></span>
            <input name="tags" placeholder="summer, laughter, little things" defaultValue={memory?.tags.join(", ")} />
          </label>
          <label>
            <span>Order in the story</span>
            <input type="number" name="display_order" min={1} step={1} defaultValue={memory?.display_order ?? 1} />
          </label>
          <label>
            <span>Chapter feeling</span>
            <select name="animation_preset" defaultValue={memory?.animation_preset ?? "dreamy-fade"}>
              {animationPresets.map((preset) => <option key={preset} value={preset}>{presetNames[preset]}</option>)}
            </select>
          </label>
        </div>
        <label className="check-field">
          <input type="checkbox" name="date_is_approximate" defaultChecked={memory?.date_is_approximate} />
          <span>The date is approximate</span>
        </label>
        <label className="check-field">
          <input type="checkbox" name="is_featured" defaultChecked={memory?.is_featured} />
          <span>Make this a featured memory</span>
        </label>
      </section>

      <section className="form-section">
        <p className="eyebrow">04 — YOUR PHOTOGRAPHS</p>
        <h2>Bring the moment back.</h2>
        <MediaPicker existingCount={memory?.media.length} />
      </section>

      <section className="form-section">
        <p className="eyebrow">05 — SHARE IT</p>
        <h2>Choose who can see it.</h2>
        <label>
          <span>Memory status</span>
          <select name="status" defaultValue={memory?.status ?? "draft"}>
            <option value="draft">Draft — only visible in the studio</option>
            <option value="published">Published — add it to the story</option>
          </select>
        </label>
      </section>

      <div className="form-actions">
        <a className="button button-quiet" href="/admin">Cancel</a>
        <button className="button button-primary" type="submit">{memory ? "Save changes" : "Save memory"} <span aria-hidden="true">↗</span></button>
      </div>
      {memory?.memory_date ? <p className="form-footnote">Currently dated {formatMemoryDate(memory.memory_date)}.</p> : null}
    </form>
  );
}
