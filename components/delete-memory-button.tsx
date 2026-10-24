"use client";

import { deleteMemoryAction } from "@/app/actions";

export function DeleteMemoryButton({ id, title }: { id: string; title: string }) {
  return (
    <form
      action={deleteMemoryAction}
      onSubmit={(event) => {
        if (!window.confirm(`Delete “${title}” and its uploaded media? This cannot be undone.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="table-action danger-action" type="submit">Delete</button>
    </form>
  );
}
