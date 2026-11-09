export abstract class OrderingError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidOrder extends OrderingError {
  readonly code = 'INVALID_ORDER';
}

export class AlterationNotOffered extends OrderingError {
  readonly code = 'ALTERATION_NOT_OFFERED';

  constructor(garmentType: string, alteration: string, fabric: string) {
    super(`No price for ${alteration} on ${fabric} ${garmentType}`);
  }
}

export class AreaNotServed extends OrderingError {
  readonly code = 'AREA_NOT_SERVED';

  constructor(postalCode: string) {
    super(`Tilli does not serve postal code ${postalCode}`);
  }
}

export class OrderCannotBeCancelled extends OrderingError {
  readonly code = 'ORDER_CANNOT_BE_CANCELLED';
}
