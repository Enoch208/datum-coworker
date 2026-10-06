import type { Clock } from "../../src/lifecycle/deps";

export class ProcessKilled extends Error {
  constructor() {
    super("process killed");
    this.name = "ProcessKilled";
  }
}

export class FakeClock implements Clock {
  private current: number;
  killWhen: () => boolean = () => false;
  sleeps = 0;

  constructor(start: number) {
    this.current = start;
  }

  now(): number {
    return this.current;
  }

  advance(ms: number): void {
    this.current += ms;
  }

  sleep(ms: number): Promise<void> {
    if (this.killWhen()) {
      return Promise.reject(new ProcessKilled());
    }
    this.sleeps += 1;
    this.current += ms;
    return Promise.resolve();
  }
}
