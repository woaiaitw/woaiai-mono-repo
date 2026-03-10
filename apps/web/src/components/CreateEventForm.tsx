import { useState } from "react";
import { scheduleEvent } from "~/lib/mux-client";

interface CreateEventFormProps {
  onCreated: () => void;
  onCancel: () => void;
}

export function CreateEventForm({ onCreated, onCancel }: CreateEventFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !scheduledAt) return;

    setSubmitting(true);
    setError(null);
    try {
      await scheduleEvent({
        title: title.trim(),
        description: description.trim() || undefined,
        scheduled_at: new Date(scheduledAt).toISOString(),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-card border border-edge rounded-xl p-6 space-y-5 shadow-lg"
      >
        <h2 className="text-xl font-bold text-heading">Create Event</h2>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="space-y-1.5">
          <label htmlFor="title" className="text-sm font-medium text-body">
            Title
          </label>
          <input
            id="title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 bg-input border border-edge rounded-lg text-heading placeholder:text-faint focus:outline-none focus:border-blue-500"
            placeholder="Event title"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="description"
            className="text-sm font-medium text-body"
          >
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 bg-input border border-edge rounded-lg text-heading placeholder:text-faint focus:outline-none focus:border-blue-500 resize-none"
            placeholder="What's this event about?"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="scheduled_at"
            className="text-sm font-medium text-body"
          >
            Scheduled time
          </label>
          <input
            id="scheduled_at"
            type="datetime-local"
            required
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full px-3 py-2 bg-input border border-edge rounded-lg text-heading focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-subtle hover:text-heading transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim() || !scheduledAt}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Creating..." : "Create Event"}
          </button>
        </div>
      </form>
    </div>
  );
}
