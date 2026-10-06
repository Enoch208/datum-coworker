import { useCallback, useEffect, useRef, useState } from "react";

export interface Resource<T> {
  readonly data: T | null;
  readonly error: Error | null;
  readonly loading: boolean;
  readonly reload: () => void;
}

interface Keyed<T> {
  readonly key: string;
  readonly value: T;
}

const asError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

export function useResource<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
): Resource<T> {
  const loadRef = useRef(load);
  const [data, setData] = useState<Keyed<T> | null>(null);
  const [error, setError] = useState<Keyed<Error> | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    const controller = new AbortController();
    loadRef.current(controller.signal).then(
      (value) => {
        setData({ key, value });
        setError(null);
      },
      (cause: unknown) => {
        if (!controller.signal.aborted) setError({ key, value: asError(cause) });
      },
    );
    return () => {
      controller.abort();
    };
  }, [key, tick]);

  const reload = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  const current = data?.key === key ? data.value : null;
  const currentError = error?.key === key ? error.value : null;
  return {
    data: current,
    error: currentError,
    loading: current === null && currentError === null,
    reload,
  };
}

export function useRepeat(active: boolean, everyMs: number, action: () => void): void {
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(action, everyMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [active, everyMs, action]);
}
