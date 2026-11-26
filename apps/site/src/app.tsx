import { useEffect, useRef, useState } from 'react';
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
  const mainRef = useRef<HTMLElement>(null);
  const previousStep = useRef(step.name);

  useEffect(() => {
    if (previousStep.current !== step.name) {
      mainRef.current?.querySelector('h1')?.focus();
      previousStep.current = step.name;
    }
  }, [step.name]);

  return (
    <>
      <a className="skip-link" href="#main">
        Aller à la commande
      </a>
      <header className="masthead">
        <div className="masthead__inner">
          <span className="brand">
            tilli<span className="brand__dot">.</span>
          </span>
          <span className="tagline">Retouches à domicile, à Paris</span>
        </div>
      </header>

      <main id="main" className="page" ref={mainRef}>
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
            {step.name === 'items' && (
              <section className="intro" aria-label="La retouche à domicile">
                <div className="intro__copy">
                  <p className="intro__location">Votre couturier vient à vous</p>
                  <h2>
                    Vos vêtements préférés.
                    <br />À votre mesure.
                  </h2>
                  <p>
                    Un ourlet à reprendre, une coupe à ajuster ?<br />
                    Préparez vos retouches, on se retrouve chez vous.
                  </p>
                </div>
                <div className="intro__art" aria-hidden="true">
                  <svg viewBox="0 0 300 220" fill="none" aria-hidden="true">
                    <path
                      d="M30 170c-20-70 35-140 110-140 90 0 142 56 124 121-18 67-97 57-140 42-44-16-81 20-94-23Z"
                      fill="#e8dcef"
                    />
                    <path
                      d="M145 58c-1-21 30-22 30-4 0 11-17 13-17 28l84 56c6 4 3 12-4 12H78c-7 0-10-8-4-12l84-56"
                      stroke="#5c3568"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="m112 101 18-10c12 17 29 17 41 0l20 10 18 26-20 13-5-9v60h-68v-60l-6 9-19-13 21-26Z"
                      fill="#faf7fc"
                      stroke="#5c3568"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                    <path d="M125 179h49M125 174h49" stroke="#b796bf" strokeWidth="2" strokeDasharray="3 5" />
                    <path
                      d="M56 173c-19 22 6 37 28 24 23-13 13-40-9-29-16 8-8 30 15 27"
                      stroke="#a25d85"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </section>
            )}
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
      <footer className="footer">
        <span className="brand">tilli.</span>
        <p>Les vêtements qu’on aime méritent de durer.</p>
        <span>Retouches à domicile · Paris</span>
      </footer>
    </>
  );
}
