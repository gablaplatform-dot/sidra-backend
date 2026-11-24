// Per-category booking defaults so the demo services catalogue (services-20261124 batch) is
// actually bookable (appointments, add-on items, response windows) instead of browse-only.
// Shared by import-services.js (new rows) and backfill-services-booking.js (existing rows).
// Values are intentionally loose - `normalizeBookingConfig` on the server clamps/falls back on
// anything out of range, so this only needs to be a reasonable starting point per trade, not a
// perfectly validated config.
export const BOOKING_PROFILES = {
  'Construction': {
    bookingMode: 'request',
    booking: { unit: 'day', responseHours: 48, advanceDays: 60, cancellation: 'moderate' },
    items: [
      { name: 'Site visit & quote', price: null, required: false },
      { name: 'Materials sourcing', price: null, required: false }
    ]
  },
  'Service providers': {
    bookingMode: 'request',
    booking: { unit: 'hour', responseHours: 24, leadTimeHours: 4 },
    items: [
      { name: 'Call-out fee', price: 15000, required: true },
      { name: 'Materials (if needed)', price: null, required: false }
    ]
  },
  'IT and Technology': {
    bookingMode: 'request',
    booking: { unit: 'hour', responseHours: 12, leadTimeHours: 2 },
    items: [
      { name: 'Remote support session', price: null, required: false },
      { name: 'On-site visit', price: 30000, required: false }
    ]
  },
  'Printing and signage': {
    bookingMode: 'request',
    booking: { unit: 'day', responseHours: 24, advanceDays: 30 },
    items: [
      { name: 'Rush delivery (24h)', price: 30000, required: false },
      { name: 'Design proof', price: null, required: false }
    ]
  },
  'Legal consultancy services': {
    bookingMode: 'request',
    booking: { unit: 'hour', responseHours: 24, leadTimeHours: 24 },
    items: [
      { name: 'Document review', price: 50000, required: false },
      { name: 'Follow-up consultation', price: null, required: false }
    ]
  },
  'Jobs': {
    bookingMode: 'request',
    booking: { unit: 'hour', responseHours: 48 },
    items: [{ name: 'Candidate shortlist call', price: null, required: false }]
  },
  'Drivers': {
    bookingMode: 'instant',
    booking: { unit: 'hour', leadTimeHours: 2, inventory: 3 },
    items: [
      { name: 'Airport pickup sign', price: null, required: false },
      { name: 'Extra luggage', price: 10000, required: false }
    ]
  },
  'Destination tourism services': {
    bookingMode: 'request',
    booking: { unit: 'day', responseHours: 24, advanceDays: 90, depositPercent: 30, cancellation: 'moderate' },
    items: [
      { name: 'Private guide', price: 60000, required: false },
      { name: 'Transport included', price: null, required: false }
    ]
  },
  'Education': {
    bookingMode: 'request',
    booking: { unit: 'appointment', slotMinutes: 60, daysOfWeek: [1, 2, 3, 4, 5, 6], openFrom: '09:00', openTo: '19:00', responseHours: 24 },
    items: [{ name: 'Study materials', price: 10000, required: false }]
  },
  'Health care': {
    bookingMode: 'instant',
    booking: { unit: 'appointment', slotMinutes: 30, daysOfWeek: [1, 2, 3, 4, 5, 6], openFrom: '08:00', openTo: '18:00', leadTimeHours: 1 },
    items: [{ name: 'Home visit', price: 25000, required: false }]
  },
  'Events': {
    bookingMode: 'request',
    booking: { unit: 'day', responseHours: 48, advanceDays: 180, depositPercent: 30, cancellation: 'moderate' },
    items: [
      { name: 'Extra serving staff', price: 20000, required: false },
      { name: 'Equipment hire', price: null, required: false }
    ]
  },
  'Entertainment': {
    bookingMode: 'request',
    booking: { unit: 'hour', responseHours: 24, leadTimeHours: 48 },
    items: [
      { name: 'Extra hour', price: 50000, required: false },
      { name: 'Sound equipment', price: 100000, required: false }
    ]
  },
  'Venue': {
    bookingMode: 'request',
    booking: { unit: 'day', responseHours: 48, advanceDays: 180, depositPercent: 50, cancellation: 'strict' },
    items: [
      { name: 'Decoration package', price: 150000, required: false },
      { name: 'Catering coordination', price: null, required: false }
    ]
  },
  'Media': {
    bookingMode: 'instant',
    booking: { unit: 'hour', leadTimeHours: 24, inventory: 2 },
    items: [
      { name: 'Extra edited photos', price: 15000, required: false },
      { name: 'Drone footage', price: 80000, required: false }
    ]
  },
  'Veterinary and pet services': {
    bookingMode: 'request',
    booking: { unit: 'appointment', slotMinutes: 45, daysOfWeek: [1, 2, 3, 4, 5, 6], openFrom: '08:00', openTo: '17:00', responseHours: 12 },
    items: [{ name: 'Home visit', price: 20000, required: false }]
  }
};
export const DEFAULT_PROFILE = { bookingMode: 'request', booking: { unit: 'hour', responseHours: 24 }, items: [] };
