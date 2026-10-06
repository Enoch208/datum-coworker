import { useCallback, useRef, useState } from "react";

export type UploadState =
  | { readonly kind: "idle" }
  | { readonly kind: "sending"; readonly fraction: number }
  | { readonly kind: "failed"; readonly message: string };

type Run<T> = (onProgress: (fraction: number) => void) => Promise<T>;

const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

export function useUpload<T>(onDone: (value: T) => void) {
  const [state, setState] = useState<UploadState>({ kind: "idle" });
  const inFlight = useRef(false);

  const start = useCallback(
    (run: Run<T>) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setState({ kind: "sending", fraction: 0 });
      run((fraction) => {
        setState({ kind: "sending", fraction });
      }).then(
        (value) => {
          inFlight.current = false;
          setState({ kind: "idle" });
          onDone(value);
        },
        (cause: unknown) => {
          inFlight.current = false;
          setState({ kind: "failed", message: messageOf(cause) });
        },
      );
    },
    [onDone],
  );

  const reset = useCallback(() => {
    if (!inFlight.current) setState({ kind: "idle" });
  }, []);

  return { state, start, reset };
}
