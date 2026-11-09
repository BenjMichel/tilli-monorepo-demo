import { MissionAwardedV1, OrderCancelledV1, OrderPlacedV1 } from '@tilli/contracts';
import type { UpstreamReactions } from '../application/upstream-reactions';
import { OrderId, TailorId } from '../domain/ids';

/**
 * Anti-corruption layer facing Ordering and Dispatch. Unlike Dispatch, Fulfillment keeps the
 * customer's contact details from OrderPlaced: the awarded tailor needs them. It drops prices.
 */
export class UpstreamAcl {
  constructor(private readonly reactions: UpstreamReactions) {}

  readonly onOrderPlaced = async (raw: unknown): Promise<void> => {
    const { payload } = OrderPlacedV1.parse(raw);
    await this.reactions.orderPlaced({
      orderId: OrderId(payload.orderId),
      customer: {
        fullName: `${payload.customer.firstName} ${payload.customer.lastName}`,
        phone: payload.customer.phone,
        address: payload.address,
      },
      workSheet: payload.items.map((item) => ({
        garmentType: item.garmentType,
        fabric: item.fabric,
        alterationCodes: item.alterations.map((alteration) => alteration.code),
      })),
      proposedSlots: payload.slots.map((slot) => ({ start: new Date(slot.start), end: new Date(slot.end) })),
    });
  };

  readonly onMissionAwarded = async (raw: unknown): Promise<void> => {
    const { payload } = MissionAwardedV1.parse(raw);
    await this.reactions.missionAwarded(OrderId(payload.orderId), TailorId(payload.tailorId));
  };

  readonly onOrderCancelled = async (raw: unknown): Promise<void> => {
    const { payload } = OrderCancelledV1.parse(raw);
    await this.reactions.orderCancelled(OrderId(payload.orderId));
  };
}
