import { useState } from 'react';
import type { PlacedOrder, TilliApi } from './api';
import { Confirmation } from './confirmation';
import { DetailsStep } from './details-step';
import type { CartItem } from './funnel';
import { ItemsStep } from './items-step';
import { useQuote } from './use-quote';

const STEPS = ['Vêtements et retouches', 'Coordonnées'] as const;

type Step = { readonly name: 'items' } | { readonly name: 'details' } | { readonly name: 'done'; placed: PlacedOrder };

export function App({ api, now = () => new Date() }: { api: TilliApi; now?: () => Date }) {
  const [step, setStep] = useState<Step>({ name: 'items' });
  const [cart, setCart] = useState<readonly CartItem[]>([]);
  const quote = useQuote(api, cart);

  return (
    <>
      <header className="masthead">
        <div className="masthead__inner">
          <span className="brand">Tilli</span>
          <span className="tagline">Retouches à domicile, à Paris</span>
        </div>
      </header>

      <main className="page">
        {step.name === 'done' ? (
          <Confirmation
            placed={step.placed}
            onRestart={() => {
              setCart([]);
              setStep({ name: 'items' });
            }}
          />
        ) : (
          <>
            <ol className="progress" aria-label="Étapes de la commande">
              {STEPS.map((label, index) => {
                const current = (step.name === 'items' ? 0 : 1) === index;
                return (
                  <li key={label} className="progress__step" aria-current={current ? 'step' : undefined}>
                    <span className="progress__number">{index + 1}</span>
                    {label}
                  </li>
                );
              })}
            </ol>

            {step.name === 'items' && (
              <ItemsStep
                api={api}
                cart={cart}
                onCartChange={setCart}
                quote={quote}
                onContinue={() => setStep({ name: 'details' })}
              />
            )}
            {step.name === 'details' && quote.status === 'ready' && (
              <DetailsStep
                api={api}
                cart={cart}
                quote={quote.quote}
                now={now}
                onBack={() => setStep({ name: 'items' })}
                onPlaced={(placed) => setStep({ name: 'done', placed })}
              />
            )}
          </>
        )}
      </main>
    </>
  );
}
