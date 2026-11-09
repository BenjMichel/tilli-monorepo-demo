import { describe, expect, it } from 'vitest';
import { ApiError, httpApi } from '../src/api';

function aFetch(status: number, body?: unknown) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  };
  return { calls, fetchFn: fetchFn as typeof fetch };
}

describe('httpApi', () => {
  it('reads the pending offers of a tailor', async () => {
    const { calls, fetchFn } = aFetch(200, []);
    expect(await httpApi('/api', fetchFn).listOffers('marie')).toEqual([]);
    expect(calls[0]?.url).toBe('/api/tailors/marie/offers');
  });

  it('accepts a mission with the tailor and the appointment picked', async () => {
    const { calls, fetchFn } = aFetch(204);
    await httpApi('/api', fetchFn).acceptOffer('mission-1', 'marie', '2026-11-16T09:30:00.000Z');
    expect(calls[0]?.url).toBe('/api/missions/mission-1/accept');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      tailorId: 'marie',
      appointmentStart: '2026-11-16T09:30:00.000Z',
    });
  });

  it('starts and completes an intervention on behalf of the tailor', async () => {
    const { calls, fetchFn } = aFetch(204);
    const api = httpApi('/api', fetchFn);
    await api.startIntervention('intervention-1', 'marie');
    await api.completeIntervention('intervention-1', 'marie');
    expect(calls.map((call) => call.url)).toEqual([
      '/api/interventions/intervention-1/start',
      '/api/interventions/intervention-1/complete',
    ]);
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ tailorId: 'marie' });
  });

  it('turns a refusal into an ApiError carrying its code', async () => {
    const { fetchFn } = aFetch(409, { error: 'MISSION_ALREADY_AWARDED', message: 'taken' });
    await expect(httpApi('/api', fetchFn).acceptOffer('mission-1', 'marie', 'x')).rejects.toMatchObject({
      constructor: ApiError,
      status: 409,
      code: 'MISSION_ALREADY_AWARDED',
    });
  });
});
