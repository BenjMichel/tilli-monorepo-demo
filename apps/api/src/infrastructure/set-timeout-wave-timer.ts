import type { MissionId, WaveTimer } from '@tilli/dispatch';

type Expiry = { missionId: MissionId; wave: number; at: Date };

/**
 * In-process wave timer. Timers are lost on restart, like everything else in this in-memory
 * demo; a persistent scheduler (a jobs table polled by a worker) would replace it.
 */
export class SetTimeoutWaveTimer implements WaveTimer {
  private readonly handles = new Set<NodeJS.Timeout>();

  constructor(
    private readonly now: () => Date,
    private readonly onExpire: (expiry: Expiry) => Promise<void>,
  ) {}

  async schedule(expiry: Expiry): Promise<void> {
    const delay = Math.max(0, expiry.at.getTime() - this.now().getTime());
    const handle = setTimeout(() => {
      this.handles.delete(handle);
      this.onExpire(expiry).catch((error: unknown) => console.error('[wave-timer]', error));
    }, delay);
    handle.unref();
    this.handles.add(handle);
  }

  stop(): void {
    for (const handle of this.handles) clearTimeout(handle);
    this.handles.clear();
  }
}
