import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { ParticipantRole } from "@web-template/shared";
import { DEFAULT_LANGUAGE } from "@web-template/shared";
import { LiveMeetingPanel } from "../components/LiveMeetingPanel";

export const Route = createFileRoute("/meeting")({
  validateSearch: (search: Record<string, unknown>) => ({
    role: (search.role as ParticipantRole) || "viewer",
    lang:
      typeof search.lang === "string" ? search.lang : DEFAULT_LANGUAGE,
  }),
  component: MeetingPage,
});

function MeetingPage() {
  const { role, lang } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <LiveMeetingPanel
      role={role}
      language={lang}
      onLeave={() => navigate({ to: "/" })}
    />
  );
}
