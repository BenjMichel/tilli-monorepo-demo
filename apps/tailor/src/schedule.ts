import { ApiError, type InterventionStatus, type TimeSlot } from './api';

const APPOINTMENT_MS = 30 * 60_000;

/**
 * The appointment starts a tailor can pick: on the hour or half past, in the future, with the
 * 30 minutes inside one of the customer's slots. Mirrors the rule of Dispatch, which still decides.
 */
export function appointmentStarts(slots: readonly TimeSlot[], now: Date): Date[] {
  const starts = new Set<number>();
  for (const slot of slots) {
    const end = Date.parse(slot.end);
    // Paris and UTC differ by whole hours: a UTC half-hour is a Paris half-hour.
    let start = Math.ceil(Date.parse(slot.start) / APPOINTMENT_MS) * APPOINTMENT_MS;
    for (; start + APPOINTMENT_MS <= end; start += APPOINTMENT_MS) {
      if (start > now.getTime()) starts.add(start);
    }
  }
  return [...starts].sort((a, b) => a - b).map((start) => new Date(start));
}

/** Tailors work in Paris: times are shown there, whatever the phone's time zone. */
const TIME_ZONE = 'Europe/Paris';
const day = new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' });
const time = new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' });

export const formatDay = (date: Date | string): string => {
  const label = day.format(new Date(date));
  return label.charAt(0).toUpperCase() + label.slice(1);
};
export const formatTime = (date: Date | string): string => time.format(new Date(date));

export function formatExpiry(expiresAt: string | null, now: Date): string | null {
  if (expiresAt === null) return null;
  const minutes = Math.ceil((Date.parse(expiresAt) - now.getTime()) / 60_000);
  if (minutes <= 0) return 'Expirée';
  return minutes === 1 ? 'Expire dans 1 min' : `Expire dans ${minutes} min`;
}

const GARMENTS: Readonly<Record<string, string>> = { pants: 'Pantalon', skirt: 'Jupe', dress: 'Robe' };
const FABRICS: Readonly<Record<string, string>> = { basic: 'Basique', dressy: 'Habillé' };
export const garmentLabel = (type: string): string => GARMENTS[type] ?? type;
export const fabricLabel = (fabric: string): string => FABRICS[fabric] ?? fabric;

export const STATUSES: Readonly<Record<InterventionStatus, { label: string; tone: 'active' | 'done' | 'muted' }>> = {
  scheduled: { label: 'À venir', tone: 'active' },
  'in-progress': { label: 'En cours', tone: 'active' },
  completed: { label: 'Terminée', tone: 'done' },
  cancelled: { label: 'Annulée', tone: 'muted' },
};

export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'MISSION_ALREADY_AWARDED':
        return 'Un autre couturier a accepté cette mission avant vous.';
      case 'OFFER_EXPIRED':
        return 'Cette proposition a expiré.';
      case 'OFFER_NOT_PENDING':
      case 'MISSION_NOT_OFFERING':
        return 'Cette proposition n’est plus ouverte.';
      case 'INVALID_APPOINTMENT':
        return 'Ce rendez-vous n’est plus possible. Choisissez-en un autre.';
      case 'TOO_EARLY_TO_START':
        return 'Vous pourrez démarrer à l’heure du rendez-vous.';
      case 'INVALID_TRANSITION':
        return 'L’intervention a changé entre-temps (annulée ?). Actualisez.';
      case 'CONCURRENT_UPDATE':
        return 'La mission vient de changer. Réessayez.';
      default:
        return `Erreur de l’API (${error.code}).`;
    }
  }
  return 'API injoignable. Vérifiez qu’elle est lancée.';
}
