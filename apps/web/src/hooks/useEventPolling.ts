import { useState, useEffect, useRef, useCallback } from "react";
import type { StreamEvent, StreamEventHost } from "@web-template/shared";
import { getEvent, getEventHost } from "~/lib/mux-client";

interface UseEventPollingOptions {
  id: string;
  isHost: boolean;
  interval?: number;
}

interface UseEventPollingResult {
  event: StreamEvent | null;
  hostEvent: StreamEventHost | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => void;
}

export function useEventPolling({
  id,
  isHost,
  interval = 5000,
}: UseEventPollingOptions): UseEventPollingResult {
  const [event, setEvent] = useState<StreamEvent | null>(null);
  const [hostEvent, setHostEvent] = useState<StreamEventHost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEvent = useCallback(async () => {
    try {
      if (isHost) {
        const data = await getEventHost(id);
        setHostEvent(data);
        setEvent(data);
      } else {
        const data = await getEvent(id);
        setEvent(data);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load event");
    } finally {
      setIsLoading(false);
    }
  }, [id, isHost]);

  useEffect(() => {
    fetchEvent();

    intervalRef.current = setInterval(() => {
      fetchEvent();
    }, interval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchEvent, interval]);

  // Stop polling when event has ended and replay is available (or no asset expected)
  useEffect(() => {
    if (
      event?.status === "ended" &&
      event.mux_asset_playback_id &&
      intervalRef.current
    ) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [event?.status, event?.mux_asset_playback_id]);

  return { event, hostEvent, error, isLoading, refetch: fetchEvent };
}
