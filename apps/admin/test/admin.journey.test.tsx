import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { type AdminApi, ApiError, type OrderTrackingRow } from '../src/api';
import { App } from '../src/app';

const placed = (orderId: string, overrides: Partial<OrderTrackingRow> = {}): OrderTrackingRow => ({
  orderId,
  placedAt: '2026-11-09T10:00:00.000Z',
  postalCode: '75011',
  totalCents: 1700,
  status: 'searching-tailor',
  tailorId: null,
  appointment: null,
  ...overrides,
});

/** An API over an in-memory projection; cancelling is refused once the work has started. */
function aFakeApi(rows: OrderTrackingRow[], startedBehindTheProjection: string[] = []) {
  const cancellations: { orderId: string; reason: string }[] = [];
  const api: AdminApi = {
    listOrders: async () => rows.map((row) => ({ ...row })),
    cancelOrder: async (orderId, reason) => {
      if (startedBehindTheProjection.includes(orderId)) {
        throw new ApiError(409, 'ORDER_CANNOT_BE_CANCELLED', 'The tailor has already started working on the order');
      }
      cancellations.push({ orderId, reason });
      const index = rows.findIndex((row) => row.orderId === orderId);
      rows[index] = { ...(rows[index] as OrderTrackingRow), status: 'cancelled' };
    },
  };
  return { api, cancellations };
}

const ROWS = () => [
  placed('aaaaaaaa-1', { status: 'completed', tailorId: 'marie' }),
  placed('bbbbbbbb-2', { status: 'unstaffed' }),
  placed('cccccccc-3', {
    status: 'tailor-assigned',
    tailorId: 'karim',
    appointment: { start: '2026-11-12T08:00:00.000Z', end: '2026-11-12T08:30:00.000Z' },
  }),
  placed('dddddddd-4', { status: 'in-progress', tailorId: 'sofia' }),
];

const bodyRows = () => screen.getAllByRole('row').slice(1);

afterEach(cleanup);

describe('the admin order tracking', () => {
  it('lists every order, unstaffed ones first, and flags them', async () => {
    render(<App api={aFakeApi(ROWS()).api} />);

    expect(await screen.findByText('bbbbbbbb')).toBeDefined();
    expect(within(bodyRows()[0] as HTMLElement).getByText('Non pourvue')).toBeDefined();
    expect(screen.getByRole('status').textContent).toContain('1 commande n’a trouvé aucun couturier.');
    expect(screen.getByText('karim')).toBeDefined();
  });

  it('filters by status', async () => {
    const user = userEvent.setup();
    render(<App api={aFakeApi(ROWS()).api} />);
    await screen.findByText('bbbbbbbb');

    await user.click(screen.getByRole('button', { name: /En cours/ }));
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText('dddddddd')).toBeDefined();
  });

  it('offers cancellation only before the intervention starts', async () => {
    render(<App api={aFakeApi(ROWS()).api} />);
    await screen.findByText('bbbbbbbb');

    expect(screen.getByRole('button', { name: 'Annuler la commande bbbbbbbb' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Annuler la commande cccccccc' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Annuler la commande dddddddd' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Annuler la commande aaaaaaaa' })).toBeNull();
  });

  it('cancels an order with a reason, then shows it cancelled', async () => {
    const user = userEvent.setup();
    const { api, cancellations } = aFakeApi(ROWS());
    render(<App api={api} />);
    await screen.findByText('bbbbbbbb');

    await user.click(screen.getByRole('button', { name: 'Annuler la commande bbbbbbbb' }));
    const form = screen.getByRole('form', { name: 'Annulation de la commande bbbbbbbb' });
    await user.type(within(form).getByLabelText('Motif'), 'Aucun couturier disponible');
    await user.click(within(form).getByRole('button', { name: 'Confirmer l’annulation' }));

    expect(cancellations).toEqual([{ orderId: 'bbbbbbbb-2', reason: 'Aucun couturier disponible' }]);
    const row = (await screen.findByText('bbbbbbbb')).closest('tr') as HTMLElement;
    expect(await within(row).findByText('Annulée')).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('explains when Ordering refuses because the work has started', async () => {
    const user = userEvent.setup();
    render(<App api={aFakeApi(ROWS(), ['cccccccc-3']).api} />);
    await screen.findByText('cccccccc');

    await user.click(screen.getByRole('button', { name: 'Annuler la commande cccccccc' }));
    await user.type(screen.getByLabelText('Motif'), 'Le client a renoncé');
    await user.click(screen.getByRole('button', { name: 'Confirmer l’annulation' }));

    expect((await screen.findByRole('alert')).textContent).toContain('déjà commencé');
  });

  it('says so when the API is unreachable', async () => {
    const api: AdminApi = {
      listOrders: async () => {
        throw new TypeError('Failed to fetch');
      },
      cancelOrder: async () => {},
    };
    render(<App api={api} />);
    expect(await screen.findByText('API injoignable.')).toBeDefined();
  });
});
