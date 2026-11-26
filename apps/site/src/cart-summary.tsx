import type { ReactNode } from 'react';
import { type CartItem, fabricLabel, formatEuros, garmentLabel } from './funnel';
import { GarmentIcon } from './garment-icon';
import type { QuoteState } from './use-quote';

/** The cart and its quote. Prices come from the API quote, never from the catalog shown earlier. */
export function CartSummary({
  cart,
  quote,
  onRemove,
  action,
}: {
  cart: readonly CartItem[];
  quote: QuoteState;
  onRemove?: (id: number) => void;
  action?: ReactNode;
}) {
  const subtotalOf = (index: number) =>
    quote.status === 'ready' ? formatEuros(quote.quote.items[index]?.subtotal.cents ?? 0) : '…';

  return (
    <aside className="summary" aria-label="Votre panier">
      <div className="summary__heading">
        <h2 className="summary__title">Votre panier</h2>
        <span key={cart.length} className="summary__count" aria-hidden="true">
          {cart.length}
        </span>
      </div>
      {cart.length === 0 ? (
        <div className="summary__empty">
          <GarmentIcon type="dress" />
          <p>Un peu d’amour pour votre dressing.</p>
          <p className="muted">Ajoutez un premier vêtement pour voir le prix.</p>
        </div>
      ) : (
        <ul className="summary__items">
          {cart.map((item, index) => (
            <li key={item.id} className="summary__item">
              <div className="summary__head">
                <span className="summary__garment">
                  {garmentLabel(item.garmentType)} <span className="muted">· {fabricLabel(item.fabric)}</span>
                </span>
                <span className="summary__amount">{subtotalOf(index)}</span>
              </div>
              <ul className="summary__alterations">
                {item.alterations.map((alteration) => (
                  <li key={alteration.code}>{alteration.label}</li>
                ))}
              </ul>
              {onRemove && (
                <button type="button" className="link" onClick={() => onRemove(item.id)}>
                  Retirer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {quote.status === 'error' && (
        <p className="notice notice--error" role="alert">
          {quote.message}
        </p>
      )}
      <div className="summary__total">
        <span>Total</span>
        <output aria-live="polite">
          {quote.status === 'ready' ? formatEuros(quote.quote.total.cents) : quote.status === 'loading' ? '…' : '—'}
        </output>
      </div>
      <p className="summary__note">Prix ferme : c’est celui de votre commande.</p>
      {action}
    </aside>
  );
}
