import { type FormEvent, useState } from 'react';
import type { AdminApi, OrderTrackingRow } from './api';
import { describeError, formatDateTime, formatEuros, mayCancel, STATUSES, shortId } from './tracking';

export function OrdersTable({
  api,
  rows,
  onChanged,
}: {
  api: AdminApi;
  rows: readonly OrderTrackingRow[];
  onChanged: () => Promise<void>;
}) {
  if (rows.length === 0) return <p className="empty">Aucune commande.</p>;

  return (
    <div className="table-wrap">
      <table className="orders">
        <thead>
          <tr>
            <th scope="col">Commande</th>
            <th scope="col">Passée le</th>
            <th scope="col">Statut</th>
            <th scope="col">Code postal</th>
            <th scope="col">Couturier</th>
            <th scope="col">Rendez-vous</th>
            <th scope="col" className="orders__amount">
              Prix
            </th>
            <th scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <OrderRow key={row.orderId} api={api} row={row} onChanged={onChanged} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A row, and below it the cancellation form once opened. Cancelling is a command to Ordering. */
function OrderRow({ api, row, onChanged }: { api: AdminApi; row: OrderTrackingRow; onChanged: () => Promise<void> }) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = STATUSES[row.status];
  const id = shortId(row.orderId);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.cancelOrder(row.orderId, reason.trim());
      setCancelling(false);
      setReason('');
      await onChanged();
    } catch (caught) {
      setError(describeError(caught));
      setCancelling(false);
      await onChanged();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <tr data-tone={status.tone}>
        <td className="orders__id" title={row.orderId}>
          {id}
        </td>
        <td>{formatDateTime(row.placedAt)}</td>
        <td>
          <span className="badge" data-tone={status.tone}>
            {status.label}
          </span>
        </td>
        <td>{row.postalCode ?? '—'}</td>
        <td>{row.tailorId ?? '—'}</td>
        <td>{row.appointment ? formatDateTime(row.appointment.start) : '—'}</td>
        <td className="orders__amount">{formatEuros(row.totalCents)}</td>
        <td className="orders__actions">
          {mayCancel(row.status) && !cancelling && (
            <button
              type="button"
              className="button button--ghost"
              aria-label={`Annuler la commande ${id}`}
              onClick={() => setCancelling(true)}
            >
              Annuler
            </button>
          )}
        </td>
      </tr>
      {(cancelling || error) && (
        <tr className="orders__detail">
          <td colSpan={8}>
            {cancelling && (
              <form className="cancel" onSubmit={submit} aria-label={`Annulation de la commande ${id}`}>
                <label className="cancel__field">
                  <span>Motif</span>
                  <input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Ex. : aucun couturier disponible, le client a renoncé"
                    required
                  />
                </label>
                <button type="submit" className="button button--danger" disabled={submitting}>
                  {submitting ? 'Annulation…' : 'Confirmer l’annulation'}
                </button>
                <button type="button" className="button button--ghost" onClick={() => setCancelling(false)}>
                  Garder la commande
                </button>
              </form>
            )}
            {error && (
              <p className="cancel__error" role="alert">
                {error}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
