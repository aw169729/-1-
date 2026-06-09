import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to postgres_changes on the given tables and calls `onChange`
 * (debounced) whenever any of them change. Use to keep page data in sync
 * across browser tabs / users.
 */
export function useRealtimeSync(tables: string[], onChange: () => void) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cbRef.current(), 300);
    };

    const channel = supabase.channel(`realtime-sync-${tables.join("-")}-${Math.random().toString(36).slice(2)}`);
    for (const table of tables) {
      (channel as unknown as { on: (e: string, f: unknown, cb: () => void) => void }).on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        trigger,
      );
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(",")]);
}