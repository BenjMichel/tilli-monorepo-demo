/** The postal codes where Tilli tailors work. */
export class ServiceArea {
  private readonly postalCodes: ReadonlySet<string>;

  constructor(postalCodes: Iterable<string>) {
    this.postalCodes = new Set(postalCodes);
  }

  covers(postalCode: string): boolean {
    return this.postalCodes.has(postalCode.trim());
  }
}
