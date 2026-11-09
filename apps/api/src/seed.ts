import { type Candidate, CandidateId } from '@tilli/dispatch';

const DAY_MS = 24 * 60 * 60_000;

/** Every day of the next two weeks, 8:00 to 20:00 Paris time (UTC+1 in winter). */
function nextTwoWeeks(now: Date): { start: Date; end: Date }[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: 14 }, (_, day) => ({
    start: new Date(today + day * DAY_MS + 7 * 60 * 60_000),
    end: new Date(today + day * DAY_MS + 19 * 60 * 60_000),
  }));
}

/** Demo tailors standing in for the tailor directory (ADR 0005). */
export function demoTailors(now: Date): Candidate[] {
  const availabilities = nextTwoWeeks(now);
  const tailor = (id: string, base: Candidate['base'], overrides: Partial<Candidate> = {}): Candidate => ({
    id: CandidateId(id),
    base,
    radiusKm: 8,
    garmentTypes: ['pants', 'skirt', 'dress'],
    fabrics: ['basic', 'dressy'],
    availabilities,
    recentAwards: 0,
    ...overrides,
  });

  return [
    tailor('marie', { latitude: 48.859, longitude: 2.38 }),
    tailor('karim', { latitude: 48.8634, longitude: 2.4011 }, { recentAwards: 3 }),
    tailor('sofia', { latitude: 48.8417, longitude: 2.2999 }, { fabrics: ['basic'] }),
    tailor('lucas', { latitude: 48.8925, longitude: 2.3484 }, { garmentTypes: ['pants'] }),
  ];
}
