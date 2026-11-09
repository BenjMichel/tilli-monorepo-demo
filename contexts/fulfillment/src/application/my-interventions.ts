import type { TailorId } from '../domain/ids';
import type { InterventionSnapshot } from '../domain/intervention';
import type { InterventionRepository } from '../domain/intervention-repository';

export type InterventionView = Pick<
  InterventionSnapshot,
  'id' | 'orderId' | 'status' | 'customer' | 'workSheet' | 'appointment'
>;

/** "Mes interventions": the only screen where a tailor sees the customer's contact details. */
export class MyInterventions {
  constructor(private readonly interventions: InterventionRepository) {}

  async list(tailorId: TailorId): Promise<InterventionView[]> {
    const interventions = await this.interventions.findByTailor(tailorId);
    return interventions.map((intervention) => {
      const { id, orderId, status, customer, workSheet, appointment } = intervention.toSnapshot();
      return { id, orderId, status, customer, workSheet, appointment };
    });
  }
}
