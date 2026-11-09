import { useState } from 'react';
import type { AdminApi } from './api';
import { OrdersTable } from './orders-table';
import { countByStatus, type Filter, STATUS_ORDER, STATUSES, visibleRows } from './tracking';
import { useOrders } from './use-orders';

const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function App({ api, refreshMs = 5_000 }: { api: AdminApi; refreshMs?: number }) {
  const orders = useOrders(api, refreshMs);
  const [filter, setFilter] = useState<Filter>('all');
  const rows = orders.rows ?? [];
  const counts = countByStatus(rows);

  return (
    <>
      <header className="topbar">
        <span className="brand">
          Tilli <span className="brand__section">Ops</span>
        </span>
        <span className="topbar__status" aria-live="polite">
          {orders.error ? (
            <span className="topbar__error">{orders.error}</span>
          ) : orders.refreshedAt ? (
            `Mis à jour à ${timeFormat.format(orders.refreshedAt)}`
          ) : (
            'Chargement…'
          )}
        </span>
        <button type="button" className="button button--ghost" onClick={() => void orders.refresh()}>
          Actualiser
        </button>
      </header>

      <main className="page">
        <h1 className="page__title">Suivi des commandes</h1>

        {counts.unstaffed > 0 && (
          <p className="banner" role="status">
            {counts.unstaffed === 1
              ? '1 commande n’a trouvé aucun couturier.'
              : `${counts.unstaffed} commandes n’ont trouvé aucun couturier.`}{' '}
            Contactez le client pour proposer d’autres créneaux, ou annulez.
          </p>
        )}

        <fieldset className="filters">
          <legend className="visually-hidden">Filtrer par statut</legend>
          <FilterButton label="Toutes" count={rows.length} active={filter === 'all'} onClick={() => setFilter('all')} />
          {STATUS_ORDER.map((status) => (
            <FilterButton
              key={status}
              label={STATUSES[status].label}
              count={counts[status]}
              tone={STATUSES[status].tone}
              active={filter === status}
              onClick={() => setFilter(status)}
            />
          ))}
        </fieldset>

        {orders.rows === null ? (
          !orders.error && <p className="empty">Chargement des commandes…</p>
        ) : (
          <OrdersTable api={api} rows={visibleRows(rows, filter)} onChanged={orders.refresh} />
        )}
      </main>
    </>
  );
}

function FilterButton({
  label,
  count,
  tone,
  active,
  onClick,
}: {
  label: string;
  count: number;
  tone?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="filter" data-tone={tone} aria-pressed={active} onClick={onClick}>
      <span className="filter__count">{count}</span>
      <span className="filter__label">{label}</span>
    </button>
  );
}
