import type { CourierAccount } from '@mnadhem/database';

/**
 * The vocabulary the fulfillment actions speak, kept separate from Aramex's own
 * wire format so `OrderFulfillmentService` never sees an Aramex field name.
 *
 * There is deliberately no `ICourierProvider` interface: there is one carrier
 * and one implementation, and an interface with a single implementor is
 * indirection without a payer.
 */

/** The parcel details Aramex needs to produce a label. */
export interface AwbRequest {
  reference: string;
  customerName: string;
  customerPhone: string;
  /** Governorate — maps to Aramex's Address.City. */
  wilaya: string;
  commune: string | null;
  address: string | null;
  /** Cash to collect on delivery. Zero means a prepaid parcel. */
  codAmount: number;
  items: { name: string; quantity: number }[];
}

export interface AwbResult {
  /** Aramex's waybill number. Stored as `Shipment.trackingNumber`. */
  awbNumber: string;
  /** Label bytes, when Aramex returns them inline rather than as a URL. */
  labelPdf: Buffer | null;
  labelPdfUrl: string | null;
}

export interface PickupResult {
  /** Aramex's pickup GUID — also what a later shipment sends as PickupGUID. */
  pickupReference: string;
  scheduledAt: Date | null;
}

/**
 * An account with its two secrets decrypted, as the provider needs them. The
 * ciphertext never leaves `CourierRegistryService`.
 */
export interface AramexCredentials {
  account: CourierAccount;
  password: string;
  accountPin: string;
}
