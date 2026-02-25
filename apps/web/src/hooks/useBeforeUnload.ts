import { useEffect, useRef } from "react";

export function useBeforeUnload(
  meeting: { leave: () => void } | null | undefined
) {
  const meetingRef = useRef(meeting);
  meetingRef.current = meeting;

  useEffect(() => {
    const onBeforeUnload = () => {
      meetingRef.current?.leave();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
}
