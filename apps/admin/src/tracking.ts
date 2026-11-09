import { ApiError, type OrderTrackingRow, type TrackingStatus } from './api';

type StatusInfo = { readonly label: string; readonly tone: 'alert' | 'waiting' | 'active' | 'done' | 'muted' };

/** Statuses in the order an order goes through them. */
export const STATUSES: Readonly<Record<TrackingStatus, StatusInfo>> = {
  unstaffed: { label: 'Non pourvue', tone: 'alert' },
  'searching-tailor': { label: 'Recherche couturier', tone: 'waiting' },
  'tailor-assigned': { label: 'Couturier trouvé', tone: 'active' },
  'in-progress': { label: 'En cours', tone: 'active' },
  completed: { label: 'Terminée', tone: 'done' },
  cancelled: { label: 'Annulée', tone: 'muted' },
};

export const STATUS_ORDER = Object.keys(STATUSES) as TrackingStatus[];

export type Filter = 'all' | TrackingStatus;

export function countByStatus(rows: readonly OrderTrackingRow[]): Record<TrackingStatus, number> {
  const counts = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0])) as Record<TrackingStatus, number>;
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

/** Unstaffed orders come first: nobody accepted them, the ops team has to step in. */
export function visibleRows(rows: readonly OrderTrackingRow[], filter: Filter): OrderTrackingRow[] {
  const kept = filter === 'all' ? [...rows] : rows.filter((row) => row.status === filter);
  return kept.sort((a, b) => Number(b.status === 'unstaffed') - Number(a.status === 'unstaffed'));
}

/**
 * Whether to offer cancellation. Only a hint: Ordering decides, and refuses it once the
 * intervention has started, even if this projection has not heard of it yet.
 */
export const mayCancel = (status: TrackingStatus): boolean =>
  status === 'searching-tailor' || status === 'unstaffed' || status === 'tailor-assigned';

/** Enough to tell orders apart on screen; the full id stays in the title attribute. */
export const shortId = (orderId: string): string => orderId.slice(0, 8);

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
export const formatEuros = (cents: number | null): string => (cents === null ? '—' : euros.format(cents / 100));

const dateTime = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
export const formatDateTime = (iso: string | null): string => (iso === null ? '—' : dateTime.format(new Date(iso)));

export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'ORDER_CANNOT_BE_CANCELLED') {
      return 'Annulation refusée : le couturier a déjà commencé, ou la commande est terminée.';
    }
    if (error.code === 'CONCURRENT_UPDATE') return 'La commande vient de changer. Réessayez.';
    if (error.code === 'NOT_FOUND') return 'Commande introuvable.';
    return `Erreur de l’API (${error.code}).`;
  }
  return 'API injoignable.';
}
