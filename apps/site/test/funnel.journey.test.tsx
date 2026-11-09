import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError, type OfferedAlteration, type PlaceOrderRequest, type TilliApi } from '../src/api';
import { App } from '../src/app';

const CATALOG: Record<string, OfferedAlteration[]> = {
  'pants/basic': [
    { code: 'hem-simple', label: 'Ourlet simple (x2)', price: { cents: 1200 } },
    { code: 'hem-turn-up', label: 'Ourlet revers (x2)', price: { cents: 1500 } },
  ],
  'pants/dressy': [
    { code: 'hem-simple', label: 'Ourlet simple (x2)', price: { cents: 1700 } },
    { code: 'hem-turn-up', label: 'Ourlet revers (x2)', price: { cents: 2000 } },
  ],
  'dress/basic': [{ code: 'hem-ruffles', label: 'Ourlet à volants', price: { cents: 2200 } }],
};

/** An API answering from a fixed catalog, recording the orders it receives. */
function aFakeApi(refuseWith?: ApiError) {
  const orders: PlaceOrderRequest[] = [];
  const priceOf = (garmentType: string, fabric: string, code: string) =>
    CATALOG[`${garmentType}/${fabric}`]?.find((alteration) => alteration.code === code)?.price.cents ?? 0;
  const api: TilliApi = {
    alterationsFor: async (garmentType, fabric) => CATALOG[`${garmentType}/${fabric}`] ?? [],
    quote: async (items) => {
      const quoted = items.map((item) => {
        const alterations = item.alterationCodes.map((code) => ({
          code,
          label: code,
          price: { cents: priceOf(item.garmentType, item.fabric, code) },
        }));
        const subtotal = { cents: alterations.reduce((sum, alteration) => sum + alteration.price.cents, 0) };
        return { garmentType: item.garmentType, fabric: item.fabric, alterations, subtotal };
      });
      const total = { cents: quoted.reduce((sum, item) => sum + item.subtotal.cents, 0) };
      return { items: quoted, total, priceGridVersion: 'demo-2026-11' };
    },
    placeOrder: async (request) => {
      if (refuseWith) throw refuseWith;
      orders.push(request);
      return { orderId: 'order-42', totalCents: 3900 };
    },
  };
  return { api, orders };
}

const NOW = () => new Date(2026, 10, 9, 10);

async function fillCartAndContinue(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('radio', { name: 'Habillé Tailleur, soie, laine fine, doublé' }));
  await user.click(await screen.findByRole('checkbox', { name: /Ourlet simple \(x2\)/ }));
  await user.click(screen.getByRole('button', { name: 'Ajouter ce vêtement' }));

  await user.click(screen.getByRole('radio', { name: 'Robe' }));
  await user.click(screen.getByRole('radio', { name: 'Basique Coton, jean, lin, polyester' }));
  await user.click(await screen.findByRole('checkbox', { name: /Ourlet à volants/ }));
  await user.click(screen.getByRole('button', { name: 'Ajouter ce vêtement' }));

  const cart = screen.getByRole('complementary', { name: 'Votre panier' });
  expect(await within(cart).findByText(/39,00/)).toBeDefined();
  await user.click(screen.getByRole('button', { name: 'Continuer' }));
}

async function fillDetails(user: ReturnType<typeof userEvent.setup>, postalCode = '75011') {
  await user.type(screen.getByLabelText('Rue et numéro'), '12 rue Oberkampf');
  await user.type(screen.getByLabelText('Code postal'), postalCode);
  await user.click(screen.getByRole('checkbox', { name: /16 nov\..*9h – 11h/ }));
  await user.type(screen.getByLabelText('Prénom'), 'Léa');
  await user.type(screen.getByLabelText('Nom'), 'Martin');
  await user.type(screen.getByLabelText('Téléphone'), '+33600000000');
  await user.type(screen.getByLabelText('E-mail'), 'lea@example.com');
}

afterEach(cleanup);

describe('the website funnel', () => {
  it('places an order at the price of the step 1 quote', async () => {
    const user = userEvent.setup();
    const { api, orders } = aFakeApi();
    render(<App api={api} now={NOW} />);

    await fillCartAndContinue(user);
    await fillDetails(user);
    await user.click(screen.getByRole('button', { name: 'Commander' }));

    expect(await screen.findByRole('heading', { name: 'Commande enregistrée' })).toBeDefined();
    expect(screen.getByText('order-42')).toBeDefined();
    expect(orders).toEqual([
      {
        items: [
          { garmentType: 'pants', fabric: 'dressy', alterationCodes: ['hem-simple'] },
          { garmentType: 'dress', fabric: 'basic', alterationCodes: ['hem-ruffles'] },
        ],
        address: { street: '12 rue Oberkampf', postalCode: '75011', city: 'Paris' },
        slots: [{ start: new Date(2026, 10, 16, 9), end: new Date(2026, 10, 16, 11) }],
        customer: { firstName: 'Léa', lastName: 'Martin', phone: '+33600000000', email: 'lea@example.com' },
        quotedPriceGridVersion: 'demo-2026-11',
      },
    ]);
  });

  it('cannot continue with an empty cart, nor order without a slot', async () => {
    const user = userEvent.setup();
    render(<App api={aFakeApi().api} now={NOW} />);

    expect(screen.getByRole('button', { name: 'Continuer' })).toHaveProperty('disabled', true);
    await fillCartAndContinue(user);
    expect(screen.getByRole('button', { name: 'Commander' })).toHaveProperty('disabled', true);
  });

  it('removes a garment from the cart and updates the total', async () => {
    const user = userEvent.setup();
    render(<App api={aFakeApi().api} now={NOW} />);

    await user.click(await screen.findByRole('checkbox', { name: /Ourlet revers/ }));
    await user.click(screen.getByRole('button', { name: 'Ajouter ce vêtement' }));
    const cart = screen.getByRole('complementary', { name: 'Votre panier' });
    expect(await within(cart).findAllByText(/15,00/)).toHaveLength(2);

    await user.click(within(cart).getByRole('button', { name: 'Retirer' }));
    expect(within(cart).getByText('Ajoutez un premier vêtement pour voir le prix.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Continuer' })).toHaveProperty('disabled', true);
  });

  it('explains why an address outside Paris is refused', async () => {
    const user = userEvent.setup();
    const { api } = aFakeApi(new ApiError(422, 'AREA_NOT_SERVED', 'Tilli does not serve postal code 69001'));
    render(<App api={api} now={NOW} />);

    await fillCartAndContinue(user);
    await fillDetails(user, '69001');
    await user.click(screen.getByRole('button', { name: 'Commander' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Paris intra-muros');
    expect(screen.getByRole('button', { name: 'Commander' })).toHaveProperty('disabled', false);
  });
});
