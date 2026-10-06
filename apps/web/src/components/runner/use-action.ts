import { useCallback, useRef, useState } from "react";

export type ActionState = "ready" | "busy" | "done";

export function useAction(run: () => Promise<void>, onDone: () => void) {
  const [state, setState] = useState<ActionState>("ready");
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const trigger = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState("busy");
    setError(null);
    run().then(
      () => {
        setState("done");
        onDone();
      },
      (cause: unknown) => {
        inFlight.current = false;
        setState("ready");
        setError(cause instanceof Error ? cause.message : String(cause));
      },
    );
  }, [run, onDone]);

  return { state, error, trigger };
}
