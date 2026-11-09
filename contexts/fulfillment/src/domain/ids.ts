declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type InterventionId = Brand<string, 'InterventionId'>;
export type OrderId = Brand<string, 'OrderId'>;
export type TailorId = Brand<string, 'TailorId'>;

export const InterventionId = (value: string): InterventionId => value as InterventionId;
export const OrderId = (value: string): OrderId => value as OrderId;
export const TailorId = (value: string): TailorId => value as TailorId;

/** One intervention per order: deriving the id makes a redelivered MissionAwarded harmless. */
export const interventionIdForOrder = (orderId: OrderId): InterventionId => InterventionId(`intervention-${orderId}`);
