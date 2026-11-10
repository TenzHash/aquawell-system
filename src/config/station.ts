// Single place for store details shown on the landing page, receipts and billing statements.
// Edit these values before the defense so every printed document carries the real station details.
export const STATION = {
  name: "AquaWell Water Refilling Station",
  shortName: "AquaWell",
  tagline: "Clean water, delivered and refilled with care.",
  address: "Willi De Legazpi Couture Building, Rizal St, Legazpi City, Albay",
  phone: " +63 918 452 5450",
  email:"aquawell@gmail.com",
  hours: "Mon – Sat · 7:00 AM – 7:00 PM",
  receiptFooter: "Thank you for choosing AquaWell. This receipt is proof of your transaction.",
  // Station position used as the origin of the live delivery map (approximate).
  lat: 13.144115592463125,
  lng: 123.7275290778202,
} as const;

/** The shop's pinned map position. Owner/staff can move it from the "Shop Location" page; this is the fallback until they do. */
export interface StationPin { lat: number; lng: number; label?: string | null; updated_at?: string | null; pinned?: boolean; }
export const DEFAULT_STATION_PIN: StationPin = { lat: STATION.lat, lng: STATION.lng, label: null, updated_at: null, pinned: false };
