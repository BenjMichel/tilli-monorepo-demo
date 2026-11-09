import { useEffect, useId, useState } from 'react';
import type { Fabric, OfferedAlteration, TilliApi } from './api';
import { CartSummary } from './cart-summary';
import { type CartItem, describeError, FABRICS, formatEuros, GARMENTS } from './funnel';
import type { QuoteState } from './use-quote';

type Catalog =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly alterations: readonly OfferedAlteration[] }
  | { readonly status: 'error'; readonly message: string };

/** Step 1: pick a garment, its fabric and its alterations, as many times as needed. */
export function ItemsStep({
  api,
  cart,
  onCartChange,
  quote,
  onContinue,
}: {
  api: TilliApi;
  cart: readonly CartItem[];
  onCartChange: (cart: readonly CartItem[]) => void;
  quote: QuoteState;
  onContinue: () => void;
}) {
  const [garmentType, setGarmentType] = useState<string>(GARMENTS[0].type);
  const [fabric, setFabric] = useState<Fabric>('basic');
  const [catalog, setCatalog] = useState<Catalog>({ status: 'loading' });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [nextId, setNextId] = useState(1);
  const ids = useId();

  useEffect(() => {
    let stale = false;
    setCatalog({ status: 'loading' });
    setSelected(new Set());
    api.alterationsFor(garmentType, fabric).then(
      (alterations) => stale || setCatalog({ status: 'ready', alterations }),
      (error: unknown) => stale || setCatalog({ status: 'error', message: describeError(error) }),
    );
    return () => {
      stale = true;
    };
  }, [api, garmentType, fabric]);

  const toggle = (code: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(code)) next.add(code);
      return next;
    });

  const addToCart = () => {
    if (catalog.status !== 'ready') return;
    const alterations = catalog.alterations
      .filter((alteration) => selected.has(alteration.code))
      .map(({ code, label }) => ({ code, label }));
    onCartChange([...cart, { id: nextId, garmentType, fabric, alterations }]);
    setNextId(nextId + 1);
    setSelected(new Set());
  };

  return (
    <div className="layout">
      <section className="panel" aria-labelledby={`${ids}-title`}>
        <h1 id={`${ids}-title`} className="panel__title">
          Que faut-il retoucher ?
        </h1>
        <p className="panel__lead">Le prix est fixé d’avance, selon le vêtement, sa matière et la retouche.</p>

        <fieldset className="field">
          <legend className="field__label">Vêtement</legend>
          <div className="segmented">
            {GARMENTS.map((garment) => (
              <label key={garment.type} className="segmented__option">
                <input
                  type="radio"
                  name={`${ids}-garment`}
                  value={garment.type}
                  checked={garmentType === garment.type}
                  onChange={() => setGarmentType(garment.type)}
                />
                <span>{garment.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend className="field__label">Matière</legend>
          <div className="choices choices--two">
            {FABRICS.map((option) => (
              <label key={option.value} className="choice">
                <input
                  type="radio"
                  name={`${ids}-fabric`}
                  value={option.value}
                  checked={fabric === option.value}
                  onChange={() => setFabric(option.value)}
                />
                <span className="choice__label">{option.label}</span>
                <span className="choice__hint">{option.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field" aria-busy={catalog.status === 'loading'}>
          <legend className="field__label">Retouches</legend>
          {catalog.status === 'error' && (
            <p className="notice notice--error" role="alert">
              {catalog.message}
            </p>
          )}
          {catalog.status === 'loading' && <p className="muted">Chargement des retouches…</p>}
          {catalog.status === 'ready' && (
            <ul className="alterations">
              {catalog.alterations.map((alteration) => (
                <li key={alteration.code}>
                  <label className="alteration">
                    <input
                      type="checkbox"
                      checked={selected.has(alteration.code)}
                      onChange={() => toggle(alteration.code)}
                    />
                    <span className="alteration__label">{alteration.label}</span>
                    <span className="alteration__price">{formatEuros(alteration.price.cents)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <button type="button" className="button button--secondary" disabled={selected.size === 0} onClick={addToCart}>
          Ajouter ce vêtement
        </button>
      </section>

      <CartSummary
        cart={cart}
        quote={quote}
        onRemove={(id) => onCartChange(cart.filter((item) => item.id !== id))}
        action={
          <button type="button" className="button" disabled={quote.status !== 'ready'} onClick={onContinue}>
            Continuer
          </button>
        }
      />
    </div>
  );
}
