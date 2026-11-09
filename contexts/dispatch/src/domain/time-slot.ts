export type TimeSlot = {
  readonly start: Date;
  readonly end: Date;
};

export function TimeSlot(start: Date, end: Date): TimeSlot {
  if (end <= start) throw new RangeError(`A time slot must end after it starts (${start.toISOString()})`);
  return { start, end };
}

export function isWithin(slot: TimeSlot, availability: TimeSlot): boolean {
  return availability.start <= slot.start && slot.end <= availability.end;
}

export function copyTimeSlot(slot: TimeSlot): TimeSlot {
  return { start: new Date(slot.start), end: new Date(slot.end) };
}
