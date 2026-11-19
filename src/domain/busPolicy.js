// All deadlines are absolute instants. Display them in East Africa Time at the UI boundary.
export const departureTime = (trip) =>
  new Date(
    new Date(trip.departureAt).getTime() + (trip.delayMinutes || 0) * 60000,
  );
export const cancellationDeadline = (booking) =>
  booking.cancellationClosesAt
    ? new Date(booking.cancellationClosesAt)
    : new Date(
        departureTime(booking.trip).getTime() -
          (booking.cancellationMinutes ?? 120) * 60000,
      );
export const canCancelBooking = (booking, now = new Date()) =>
  booking.status === "confirmed" &&
  !booking.lockedAt &&
  !booking.handoverAt &&
  booking.trip.status === "scheduled" &&
  !(booking.tickets ?? []).some((t) => t.status === "used") &&
  now < cancellationDeadline(booking) &&
  now < departureTime(booking.trip);
