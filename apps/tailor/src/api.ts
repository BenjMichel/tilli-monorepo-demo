/**
 * Client of the tailor routes of the API. Offers come from Dispatch and never name the
 * customer; interventions come from Fulfillment, the only place with their contact details.
 */

export type Fabric = 'basic' | 'dressy';

/** Dates travel as ISO strings in JSON. */
export type TimeSlot = { readonly start: string; readonly end: string };

export type PendingOffer = {
  readonly missionId: string;
  readonly postalCode: string;
  readonly slots: readonly TimeSlot[];
  readonly garmentTypes: readonly string[];
  readonly fabrics: readonly Fabric[];
  readonly expiresAt: string | null;
};

export type InterventionStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';

export type Intervention = {
  readonly id: string;
  readonly orderId: string;
  readonly status: InterventionStatus;
  readonly customer: {
    readonly fullName: string;
    readonly phone: string;
    readonly address: { readonly street: string; readonly postalCode: string; readonly city: string };
  };
  readonly workSheet: readonly {
    readonly garmentType: string;
    readonly fabric: Fabric;
    readonly alterationCodes: readonly string[];
  }[];
  readonly appointment: TimeSlot;
};

export type TailorApi = {
  listOffers(tailorId: string): Promise<PendingOffer[]>;
  acceptOffer(missionId: string, tailorId: string, appointmentStart: string): Promise<void>;
  declineOffer(missionId: string, tailorId: string): Promise<void>;
  listInterventions(tailorId: string): Promise<Intervention[]>;
  startIntervention(interventionId: string, tailorId: string): Promise<void>;
  completeIntervention(interventionId: string, tailorId: string): Promise<void>;
};

/** A refusal of the API, with the stable error code it published. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function httpApi(baseUrl = '/api', fetchFn: typeof fetch = (...args) => fetch(...args)): TailorApi {
  async function call(path: string, init?: { method: 'POST'; body: unknown }): Promise<unknown> {
    const response = await fetchFn(
      `${baseUrl}${path}`,
      init && { method: init.method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(init.body) },
    );
    const body: unknown = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      const { error, message } = (body ?? {}) as { error?: unknown; message?: unknown };
      throw new ApiError(
        response.status,
        typeof error === 'string' ? error : 'UNEXPECTED_RESPONSE',
        typeof message === 'string' ? message : `HTTP ${response.status}`,
      );
    }
    return body;
  }

  const id = encodeURIComponent;
  const post = async (path: string, body: unknown) => {
    await call(path, { method: 'POST', body });
  };

  return {
    listOffers: async (tailorId) => (await call(`/tailors/${id(tailorId)}/offers`)) as PendingOffer[],
    acceptOffer: (missionId, tailorId, appointmentStart) =>
      post(`/missions/${id(missionId)}/accept`, { tailorId, appointmentStart }),
    declineOffer: (missionId, tailorId) => post(`/missions/${id(missionId)}/decline`, { tailorId }),
    listInterventions: async (tailorId) => (await call(`/tailors/${id(tailorId)}/interventions`)) as Intervention[],
    startIntervention: (interventionId, tailorId) => post(`/interventions/${id(interventionId)}/start`, { tailorId }),
    completeIntervention: (interventionId, tailorId) =>
      post(`/interventions/${id(interventionId)}/complete`, { tailorId }),
  };
}
