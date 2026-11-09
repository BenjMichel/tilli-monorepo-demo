import type { PlacedOrder } from './api';
import { formatEuros } from './funnel';

export function Confirmation({ placed, onRestart }: { placed: PlacedOrder; onRestart: () => void }) {
  return (
    <section className="panel confirmation" aria-labelledby="confirmation-title">
      <h1 id="confirmation-title" className="panel__title">
        Commande enregistrée
      </h1>
      <p className="panel__lead">
        Nous proposons votre commande aux couturiers disponibles près de chez vous. Celui qui l’accepte vous contacte
        pour confirmer le rendez-vous.
      </p>
      <dl className="facts">
        <div>
          <dt>Numéro de commande</dt>
          <dd className="facts__mono">{placed.orderId}</dd>
        </div>
        <div>
          <dt>Prix</dt>
          <dd>{formatEuros(placed.totalCents)}</dd>
        </div>
      </dl>
      <button type="button" className="button button--secondary" onClick={onRestart}>
        Nouvelle commande
      </button>
    </section>
  );
}
