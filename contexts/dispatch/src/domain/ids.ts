declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type MissionId = Brand<string, 'MissionId'>;
export type OrderId = Brand<string, 'OrderId'>;
export type CandidateId = Brand<string, 'CandidateId'>;

export const MissionId = (value: string): MissionId => value as MissionId;
export const OrderId = (value: string): OrderId => value as OrderId;
export const CandidateId = (value: string): CandidateId => value as CandidateId;

/** One mission per order: deriving the id makes a redelivered OrderPlaced harmless. */
export const missionIdForOrder = (orderId: OrderId): MissionId => MissionId(`mission-${orderId}`);
