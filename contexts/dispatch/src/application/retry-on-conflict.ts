import { MissionConcurrencyConflict } from '../domain/mission-repository';

/**
 * Re-runs a load-decide-save cycle when another writer saved the mission first.
 * Each attempt reloads, so the aggregate decides against the latest state.
 */
export async function retryOnConflict<T>(maxAttempts: number, attempt: () => Promise<T>): Promise<T> {
  for (let attemptNumber = 1; ; attemptNumber++) {
    try {
      return await attempt();
    } catch (error) {
      if (error instanceof MissionConcurrencyConflict && attemptNumber < maxAttempts) continue;
      throw error;
    }
  }
}
