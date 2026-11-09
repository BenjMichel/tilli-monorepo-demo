import { type FormEvent, type InputHTMLAttributes, useId, useMemo, useState } from 'react';
import type { PlacedOrder, Quote, TilliApi, TimeSlot } from './api';
import { CartSummary } from './cart-summary';
import { type CartItem, describeError, formatDay, SLOT_HOURS, slotOf, toItemRequests, upcomingDays } from './funnel';

const SLOT_DAYS = 7;

const EMPTY_FORM = {
  street: '',
  postalCode: '',
  city: 'Paris',
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
};
type Form = typeof EMPTY_FORM;

/** Step 2: where and when the tailor comes, and who to contact. The order is placed at the quoted price. */
export function DetailsStep({
  api,
  cart,
  quote,
  now,
  onBack,
  onPlaced,
}: {
  api: TilliApi;
  cart: readonly CartItem[];
  quote: Quote;
  now: () => Date;
  onBack: () => void;
  onPlaced: (placed: PlacedOrder) => void;
}) {
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [slots, setSlots] = useState<ReadonlyMap<string, TimeSlot>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const days = useMemo(() => upcomingDays(now(), SLOT_DAYS), [now]);
  const ids = useId();

  const field = (name: keyof Form, label: string, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="input">
      <span className="input__label">{label}</span>
      <input
        name={name}
        required
        value={form[name]}
        onChange={(event) => setForm({ ...form, [name]: event.target.value })}
        {...props}
      />
    </label>
  );

  const toggleSlot = (slot: TimeSlot) =>
    setSlots((current) => {
      const next = new Map(current);
      const key = slot.start.toISOString();
      if (!next.delete(key)) next.set(key, slot);
      return next;
    });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { street, postalCode, city, ...customer } = form;
      onPlaced(
        await api.placeOrder({
          items: toItemRequests(cart),
          address: { street, postalCode, city },
          slots: [...slots.values()].sort((a, b) => a.start.getTime() - b.start.getTime()),
          customer,
          quotedPriceGridVersion: quote.priceGridVersion,
        }),
      );
    } catch (caught) {
      setError(describeError(caught));
      setSubmitting(false);
    }
  };

  return (
    <form className="layout" onSubmit={submit}>
      <section className="panel" aria-labelledby={`${ids}-title`}>
        <h1 id={`${ids}-title`} className="panel__title">
          Où et quand passer ?
        </h1>
        <p className="panel__lead">
          Proposez plusieurs créneaux : le couturier qui accepte votre commande fixe l’heure du rendez-vous dans l’un
          d’eux.
        </p>

        <fieldset className="field">
          <legend className="field__label">Adresse</legend>
          <div className="grid">
            <div className="grid__full">{field('street', 'Rue et numéro', { autoComplete: 'street-address' })}</div>
            {field('postalCode', 'Code postal', {
              autoComplete: 'postal-code',
              inputMode: 'numeric',
              pattern: '[0-9]{5}',
            })}
            {field('city', 'Ville', { autoComplete: 'address-level2' })}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend className="field__label">Vos disponibilités</legend>
          <div className="slots">
            {days.map((day) => (
              <div key={day.toISOString()} className="slots__day">
                <span className="slots__date">{formatDay(day)}</span>
                <div className="slots__hours">
                  {SLOT_HOURS.map((hours) => {
                    const slot = slotOf(day, hours);
                    return (
                      <label key={hours[0]} className="slot">
                        <input
                          type="checkbox"
                          checked={slots.has(slot.start.toISOString())}
                          onChange={() => toggleSlot(slot)}
                          aria-label={`${formatDay(day)}, ${hours[0]}h – ${hours[1]}h`}
                        />
                        <span className="slot__pill">
                          {hours[0]}h – {hours[1]}h
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend className="field__label">Vos coordonnées</legend>
          <div className="grid">
            {field('firstName', 'Prénom', { autoComplete: 'given-name' })}
            {field('lastName', 'Nom', { autoComplete: 'family-name' })}
            {field('phone', 'Téléphone', { type: 'tel', autoComplete: 'tel' })}
            {field('email', 'E-mail', { type: 'email', autoComplete: 'email' })}
          </div>
          <p className="muted">Seul le couturier qui accepte votre commande les reçoit.</p>
        </fieldset>

        <button type="button" className="link" onClick={onBack}>
          ← Modifier mes vêtements
        </button>
      </section>

      <CartSummary
        cart={cart}
        quote={{ status: 'ready', quote }}
        action={
          <>
            {error && (
              <p className="notice notice--error" role="alert">
                {error}
              </p>
            )}
            {slots.size === 0 && <p className="muted">Choisissez au moins un créneau.</p>}
            <button type="submit" className="button" disabled={slots.size === 0 || submitting}>
              {submitting ? 'Envoi…' : 'Commander'}
            </button>
          </>
        }
      />
    </form>
  );
}
