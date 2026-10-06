export const passIntervalMs = 5_000;
export const waitingIntervalMs = 10_000;
export const retryIntervalMs = 15_000;
export const humanIntervalMs = 60_000;

export class Pacing {
  private readonly notBefore = new Map<string, number>();
  private readonly said = new Set<string>();

  firstTime(key: string): boolean {
    if (this.said.has(key)) return false;
    this.said.add(key);
    return true;
  }

  due(taskId: string, nowMs: number): boolean {
    return (this.notBefore.get(taskId) ?? 0) <= nowMs;
  }

  pause(taskId: string, nowMs: number, delayMs: number): void {
    this.notBefore.set(taskId, nowMs + delayMs);
  }

  clear(taskId: string): void {
    this.notBefore.delete(taskId);
  }
}
