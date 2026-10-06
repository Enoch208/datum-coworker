import { useCallback, useEffect, useRef, useState } from "react";

export interface Resource<T> {
  readonly data: T | null;
  readonly error: Error | null;
  readonly loading: boolean;
  readonly pending: boolean;
  readonly updatedAt: number | null;
  readonly reload: () => void;
}

interface Keyed<T> {
  readonly key: string;
  readonly value: T;
}

interface Received<T> extends Keyed<T> {
  readonly at: number;
}

interface Attempt {
  readonly key: string;
  readonly tick: number;
}

const asError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

export function useResource<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
): Resource<T> {
  const loadRef = useRef(load);
  const [data, setData] = useState<Received<T> | null>(null);
  const [error, setError] = useState<Keyed<Error> | null>(null);
  const [settled, setSettled] = useState<Attempt | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    const controller = new AbortController();
    loadRef.current(controller.signal).then(
      (value) => {
        setData({ key, value, at: Date.now() });
        setError(null);
        setSettled({ key, tick });
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        setError({ key, value: asError(cause) });
        setSettled({ key, tick });
      },
    );
    return () => {
      controller.abort();
    };
  }, [key, tick]);

  const reload = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  const current = data?.key === key ? data : null;
  const currentError = error?.key === key ? error.value : null;
  return {
    data: current === null ? null : current.value,
    error: currentError,
    loading: current === null && currentError === null,
    pending: settled?.key !== key || settled.tick !== tick,
    updatedAt: current === null ? null : current.at,
    reload,
  };
}

export function usePoll(active: boolean, everyMs: number, idle: boolean, action: () => void): void {
  useEffect(() => {
    if (!active || !idle) return;
    const timer = window.setTimeout(action, everyMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [active, idle, everyMs, action]);
}
