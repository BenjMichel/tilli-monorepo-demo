import { ApiError, type Fabric, type ItemRequest, type TimeSlot } from './api';

/** The garments of the demo price grid. The API lists alterations per garment, not the garments. */
export const GARMENTS = [
  { type: 'pants', label: 'Pantalon' },
  { type: 'skirt', label: 'Jupe' },
  { type: 'dress', label: 'Robe' },
] as const;

export const FABRICS: readonly { value: Fabric; label: string; hint: string }[] = [
  { value: 'basic', label: 'Basique', hint: 'Coton, jean, lin, polyester' },
  { value: 'dressy', label: 'Habillé', hint: 'Tailleur, soie, laine fine, doublé' },
];

export const garmentLabel = (type: string): string => GARMENTS.find((garment) => garment.type === type)?.label ?? type;
export const fabricLabel = (fabric: Fabric): string =>
  FABRICS.find((option) => option.value === fabric)?.label ?? fabric;

/** A garment in the cart, with the labels shown when it was added. */
export type CartItem = {
  readonly id: number;
  readonly garmentType: string;
  readonly fabric: Fabric;
  readonly alterations: readonly { readonly code: string; readonly label: string }[];
};

export const toItemRequests = (cart: readonly CartItem[]): ItemRequest[] =>
  cart.map(({ garmentType, fabric, alterations }) => ({
    garmentType,
    fabric,
    alterationCodes: alterations.map((alteration) => alteration.code),
  }));

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
export const formatEuros = (cents: number): string => euros.format(cents / 100);

/** Two-hour windows within the tailors' working day (8:00 to 20:00). */
export const SLOT_HOURS: readonly (readonly [number, number])[] = [
  [9, 11],
  [11, 13],
  [14, 16],
  [16, 18],
  [18, 20],
];

/** The next days, starting tomorrow, at local midnight. */
export function upcomingDays(now: Date, count: number): Date[] {
  return Array.from(
    { length: count },
    (_, index) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + index + 1),
  );
}

export function slotOf(day: Date, [startHour, endHour]: readonly [number, number]): TimeSlot {
  const at = (hour: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);
  return { start: at(startHour), end: at(endHour) };
}

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
export const formatDay = (day: Date): string => dayFormat.format(day);
export const formatSlot = (slot: TimeSlot): string =>
  `${formatDay(slot.start)}, ${slot.start.getHours()}h – ${slot.end.getHours()}h`;

/** French wording of the refusals the customer can act on. */
const MESSAGES: Record<string, string> = {
  AREA_NOT_SERVED: 'Tilli intervient pour l’instant à Paris intra-muros uniquement (75001 à 75020).',
  UNKNOWN_PRICE_GRID_VERSION: 'Nos tarifs ont changé depuis votre devis. Revenez à l’étape 1 pour le mettre à jour.',
  ALTERATION_NOT_OFFERED: 'Une des retouches n’est plus proposée pour ce vêtement. Revenez à l’étape 1.',
  INVALID_ORDER: 'Votre commande est incomplète, ou un créneau est déjà passé. Vérifiez le formulaire.',
  INVALID_REQUEST: 'Votre commande est incomplète. Vérifiez le formulaire.',
};

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return MESSAGES[error.code] ?? 'Une erreur est survenue. Réessayez dans un instant.';
  return 'Impossible de joindre Tilli. Vérifiez votre connexion et réessayez.';
}
