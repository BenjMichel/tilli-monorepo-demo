/** Euro amounts in cents. Duplicated per context on purpose: there is no shared kernel. */
export type Money = { readonly cents: number };

export function Money(cents: number): Money {
  if (!Number.isInteger(cents) || cents < 0) throw new RangeError(`Invalid amount: ${cents} cents`);
  return { cents };
}

export const ZERO: Money = Money(0);

export const add = (a: Money, b: Money): Money => Money(a.cents + b.cents);
