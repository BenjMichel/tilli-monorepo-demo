import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError, type Intervention, type PendingOffer, type TailorApi } from '../src/api';
import { App } from '../src/app';

const NOW = new Date('2026-11-16T07:00:00Z');

const anOffer = (missionId: string): PendingOffer => ({
  missionId,
  postalCode: '75011',
  // 9:00 to 10:00 Paris time.
  slots: [{ start: '2026-11-16T08:00:00.000Z', end: '2026-11-16T09:00:00.000Z' }],
  garmentTypes: ['dress'],
  fabrics: ['dressy'],
  expiresAt: '2026-11-16T07:10:00.000Z',
});

/**
 * An API over in-memory missions, standing in for Dispatch and Fulfillment: accepting turns
 * the offer into an intervention; a mission listed in `takenByOthers` was awarded to someone else.
 */
function aFakeApi(offers: PendingOffer[], takenByOthers: string[] = []) {
  const interventions: Intervention[] = [];
  const declined: string[] = [];
  const api: TailorApi = {
    listOffers: async () => offers.map((offer) => ({ ...offer })),
    acceptOffer: async (missionId, _tailorId, appointmentStart) => {
      if (takenByOthers.includes(missionId)) {
        throw new ApiError(409, 'MISSION_ALREADY_AWARDED', 'Another tailor was faster');
      }
      offers.splice(
        offers.findIndex((offer) => offer.missionId === missionId),
        1,
      );
      interventions.push({
        id: `intervention-${missionId}`,
        orderId: `order-${missionId}`,
        status: 'scheduled',
        customer: {
          fullName: 'Léa Martin',
          phone: '+33600000000',
          address: { street: '12 rue Oberkampf', postalCode: '75011', city: 'Paris' },
        },
        workSheet: [{ garmentType: 'dress', fabric: 'dressy', alterationCodes: ['hem-ruffles'] }],
        appointment: {
          start: appointmentStart,
          end: new Date(Date.parse(appointmentStart) + 30 * 60_000).toISOString(),
        },
      });
    },
    declineOffer: async (missionId) => {
      declined.push(missionId);
      offers.splice(
        offers.findIndex((offer) => offer.missionId === missionId),
        1,
      );
    },
    listInterventions: async () => interventions.map((intervention) => ({ ...intervention })),
    startIntervention: async (id) => setStatus(id, 'in-progress'),
    completeIntervention: async (id) => setStatus(id, 'completed'),
  };
  function setStatus(id: string, status: Intervention['status']) {
    const index = interventions.findIndex((intervention) => intervention.id === id);
    interventions[index] = { ...(interventions[index] as Intervention), status };
  }
  return { api, interventions, declined };
}

async function signInAs(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name }));
}

afterEach(cleanup);

describe('the tailor app', () => {
  it('shows the district and the work of an offer, never the customer', async () => {
    const user = userEvent.setup();
    render(<App api={aFakeApi([anOffer('m1')]).api} now={() => NOW} />);
    await signInAs(user, 'Marie');

    expect(await screen.findByRole('heading', { name: '75011' })).toBeDefined();
    expect(screen.getByText('Robe · Habillé')).toBeDefined();
    expect(screen.getByText('Expire dans 10 min')).toBeDefined();
    expect(screen.queryByText(/Léa/)).toBeNull();
  });

  it('accepts a mission at the picked time, then follows it to the end', async () => {
    const user = userEvent.setup();
    const { api, interventions } = aFakeApi([anOffer('m1')]);
    render(<App api={api} now={() => NOW} />);
    await signInAs(user, 'Marie');
    await screen.findByRole('heading', { name: '75011' });

    // 9:00 and 9:30 fit in the 9:00-10:00 slot; 10:00 would end outside it.
    const times = screen.getAllByRole('radio').map((radio) => radio.textContent);
    expect(times).toEqual(['09:00', '09:30']);
    expect(screen.getByRole('button', { name: 'Accepter' }).getAttribute('aria-disabled')).toBe('true');

    await user.click(screen.getByRole('radio', { name: /09:30/ }));
    await user.click(screen.getByRole('button', { name: 'Accepter à 09:30' }));

    expect(interventions[0]?.appointment.start).toBe('2026-11-16T08:30:00.000Z');
    expect(await screen.findByText('Léa Martin')).toBeDefined();
    expect(screen.getByText('12 rue Oberkampf, 75011 Paris')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Démarrer l’intervention chez Léa Martin' }));
    expect(await screen.findByText('En cours')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Terminer l’intervention chez Léa Martin' }));
    expect(await screen.findByText('Terminée')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Terminer/ })).toBeNull();
  });

  it('explains when another tailor was faster', async () => {
    const user = userEvent.setup();
    render(<App api={aFakeApi([anOffer('m1')], ['m1']).api} now={() => NOW} />);
    await signInAs(user, 'Karim');
    await screen.findByRole('heading', { name: '75011' });

    await user.click(screen.getByRole('radio', { name: /09:00/ }));
    await user.click(screen.getByRole('button', { name: 'Accepter à 09:00' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Un autre couturier a accepté cette mission avant vous.',
    );
  });

  it('declines an offer, which then leaves the list', async () => {
    const user = userEvent.setup();
    const { api, declined } = aFakeApi([anOffer('m1'), { ...anOffer('m2'), postalCode: '75020' }]);
    render(<App api={api} now={() => NOW} />);
    await signInAs(user, 'Sofia');
    const card = (await screen.findByRole('heading', { name: '75011' })).parentElement?.parentElement as HTMLElement;

    await user.click(within(card).getByRole('button', { name: 'Décliner' }));

    expect(declined).toEqual(['m1']);
    expect(await screen.findByRole('heading', { name: '75020' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: '75011' })).toBeNull();
  });
});
