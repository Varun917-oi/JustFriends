export function FormError({ error }: { error?: string }) {
  if (!error) return null;
  const message = error === "media-limit"
    ? "A memory can contain up to eight media files."
    : error === "fields"
      ? "Please check the title, date, order, and field lengths."
      : "We couldn't complete that action. Please check the form and try again.";
  return <p className="form-error" role="alert">{message}</p>;
}
