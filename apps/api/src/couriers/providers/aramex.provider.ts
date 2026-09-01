import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { CourierAccount } from '@mnadhem/database';
import { CourierApiError, courierFetch, fetchLabelPdf } from '../courier-http';
import type {
  AramexCredentials,
  AwbRequest,
  AwbResult,
  PickupResult,
} from '../carrier.types';

/**
 * Aramex Shipping Services API.
 *
 * Element names, nesting and types below come from Aramex's published schema at
 * `https://ws.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc?xsd=xsd0`, not
 * from the PDF manual — the manual's structure diagrams are outlined vectors and
 * its tables print display names with spaces ("Description of Goods"), which are
 * NOT the wire names. Field requirements and enums do come from the manual.
 *
 * Two names look like typos and are not ours to fix: `AccountingInstrcutions`
 * and `TransportType_x0020_` (an XML-encoded trailing space) are spelled exactly
 * that way in Aramex's schema. Correcting them makes Aramex ignore the field.
 *
 * Every member of every contract is marked required. WCF rejects the whole
 * request with an HTTP 400 and no `Notifications` when a member is merely
 * absent — "the required data members 'Reference2, Reference3, Reference4,
 * Reference5' were not found" — so each object below is sent complete, padding
 * unused members with `''`, `0`, `[]` or `null` rather than omitting them. A
 * member present as `null` satisfies the check; an absent one does not. Do not
 * "tidy" the empty fields away.
 */

const TEST_HOST = 'https://ws.dev.aramex.net';
const LIVE_HOST = 'https://ws.aramex.net';
const SERVICE_PATH = '/shippingapi.v2/shipping/service_1_0.svc/json';

/**
 * The only label template the manual publishes (Table 26). `URL` returns a link
 * to a PDF; `RPT` returns the bytes inline.
 */
const LABEL_REPORT_ID = 9201;

/**
 * Cash on Delivery service code. Appendix C — the authoritative code table —
 * lists `CODS`; Table 22's prose says "COD", which is loose shorthand for the
 * same thing. Sending "COD" gets the service silently ignored.
 */
const COD_SERVICE = 'CODS';

/** Aramex's public tracking page, which takes the AWB as a query parameter. */
const TRACKING_PAGE = 'https://www.aramex.com/track/results?ShipmentNumber=';

interface AramexNotification {
  Code?: string;
  Message?: string;
}

interface AramexEnvelope {
  HasErrors?: boolean;
  Notifications?: AramexNotification[];
}

@Injectable()
export class AramexProvider {
  private readonly logger = new Logger(AramexProvider.name);

  /**
   * The manual gives the base `.../service_1_0.svc/json` but never a per-operation
   * path — Appendix G/H prints the same URL for all seven methods. This follows
   * WCF's webHttp convention of appending the operation name from the WSDL.
   * `ARAMEX_BASE_URL` overrides the host so it can be corrected, or pointed at a
   * stub, without a code change.
   */
  private url(account: CourierAccount, operation: string): string {
    const override = process.env['ARAMEX_BASE_URL'];
    if (override) return `${override.replace(/\/+$/, '')}/${operation}`;

    const host = account.testMode ? TEST_HOST : LIVE_HOST;
    return `${host}${SERVICE_PATH}/${operation}`;
  }

  /** Sent with every request. Every field is required (manual, p.22). */
  private clientInfo(creds: AramexCredentials): Record<string, unknown> {
    const { account, password, accountPin } = creds;
    return {
      UserName: account.username,
      Password: password,
      Version: account.version,
      AccountNumber: account.accountNumber,
      AccountPin: accountPin,
      AccountEntity: account.accountEntity,
      AccountCountryCode: account.accountCountryCode,
      // Integer, default 24 per the manual — Aramex assigns a different value
      // only if they set one up for data-mining purposes.
      Source: 24,
      // Language Aramex writes its notification messages in. Not the merchant's
      // dashboard locale: these strings are logged and mapped by code, not shown.
      PreferredLanguageCode: 'en',
    };
  }

  /**
   * Aramex echoes this back untouched, so it correlates a response with the
   * order that caused it. All five references are required even when unused.
   */
  private transaction(reference: string): Record<string, unknown> {
    return {
      Reference1: reference,
      Reference2: '',
      Reference3: '',
      Reference4: '',
      Reference5: '',
    };
  }

  /**
   * Aramex reports failure in-band: a 200 response can still be an error. The
   * flag appears both for the call and again per processed shipment, so both
   * levels are checked.
   *
   * Matching is on `Code` and never on `Message` — several documented messages
   * interpolate `{placeholder}` values (ERR53–ERR55), so the text is unstable.
   */
  private assertNoErrors(body: AramexEnvelope, context: string): void {
    if (!body?.HasErrors) return;

    const notes = body.Notifications ?? [];
    const detail =
      notes.map((n) => `${n.Code ?? '?'}: ${n.Message ?? ''}`.trim()).join('; ') ||
      'no detail supplied';

    this.logger.warn(`Aramex ${context} rejected — ${detail}`);
    throw new CourierApiError(`Aramex rejected the ${context}: ${detail}`, this.codeFor(notes));
  }

  /**
   * Maps the handful of Aramex codes worth telling a merchant apart. ERR48 is
   * documented as a catch-all, so the code space is open — anything unmapped
   * stays a generic carrier error rather than being guessed at.
   */
  private codeFor(notes: AramexNotification[]): string {
    const codes = new Set(notes.map((n) => n.Code));
    if (codes.has('ERR01')) return 'ARAMEX_INVALID_CREDENTIALS';
    if (codes.has('ERR02') || codes.has('ERR51')) return 'ARAMEX_INVALID_ACCOUNT';
    if (codes.has('ERR03')) return 'ARAMEX_ACCOUNT_BLOCKED';
    if (codes.has('ERR30')) return 'ARAMEX_DUPLICATE_REFERENCE';
    if ([...codes].some((c) => c?.startsWith('REQ'))) return 'ARAMEX_MISSING_FIELD';
    return 'COURIER_API_ERROR';
  }

  /**
   * Aramex's WCF endpoint deserialises with `DataContractJsonSerializer`, which
   * takes .NET epoch syntax only. An ISO-8601 string is rejected outright:
   * "DateTime content '…Z' does not start with '/Date(' and end with ')/' as
   * required".
   */
  private date(value: Date): string {
    return `/Date(${value.getTime()})/`;
  }

  private money(value: number, currency: string): Record<string, unknown> {
    return { CurrencyCode: currency, Value: value };
  }

  /**
   * The merchant's own address and contact, required as the Shipper on every
   * shipment and again as the pickup address. Refused early with a coded error
   * rather than letting Aramex answer with REQ10/REQ21, which a merchant cannot
   * act on.
   */
  private shipper(account: CourierAccount): Record<string, unknown> {
    const missing = (
      [
        ['shipperCompany', account.shipperCompany],
        ['shipperContactName', account.shipperContactName],
        ['shipperPhone', account.shipperPhone],
        ['shipperEmail', account.shipperEmail],
        ['shipperLine1', account.shipperLine1],
        ['shipperCity', account.shipperCity],
      ] as const
    ).filter(([, v]) => !v?.trim());

    if (missing.length > 0) {
      throw new BadRequestException({
        code: 'ARAMEX_SHIPPER_INCOMPLETE',
        message:
          'Your pickup address and contact details are incomplete. Fill them in under ' +
          'Settings before generating labels.',
      });
    }

    return {
      Reference1: '',
      Reference2: '',
      AccountNumber: account.accountNumber,
      PartyAddress: this.shipperAddress(account),
      Contact: this.shipperContact(account),
    };
  }

  /** All 16 members of Aramex's `Address` contract — see the header note. */
  private address(parts: {
    line1: string;
    line2?: string | null;
    city: string;
    stateOrProvinceCode?: string | null;
    postCode?: string | null;
    countryCode: string;
  }): Record<string, unknown> {
    return {
      Line1: parts.line1,
      Line2: parts.line2 ?? '',
      Line3: '',
      City: parts.city,
      StateOrProvinceCode: parts.stateOrProvinceCode ?? '',
      PostCode: parts.postCode ?? '',
      CountryCode: parts.countryCode,
      Longitude: 0,
      Latitude: 0,
      BuildingNumber: '',
      BuildingName: '',
      Floor: '',
      Apartment: '',
      POBox: '',
      Description: '',
      AddressShortCode: '',
    };
  }

  private shipperAddress(account: CourierAccount): Record<string, unknown> {
    return this.address({
      line1: account.shipperLine1 ?? '',
      city: account.shipperCity ?? '',
      stateOrProvinceCode: account.shipperStateCode,
      postCode: account.shipperPostCode,
      countryCode: account.shipperCountryCode || account.accountCountryCode || '',
    });
  }

  private shipperContact(account: CourierAccount): Record<string, unknown> {
    return {
      Department: '',
      PersonName: account.shipperContactName,
      Title: '',
      CompanyName: account.shipperCompany,
      PhoneNumber1: account.shipperPhone,
      PhoneNumber1Ext: '',
      PhoneNumber2: '',
      PhoneNumber2Ext: '',
      FaxNumber: '',
      // Required for pickup creation specifically (manual, Fig.29).
      CellPhone: account.shipperCellPhone || account.shipperPhone,
      EmailAddress: account.shipperEmail,
      Type: '',
    };
  }

  /**
   * The customer. A COD order never captures an email, but Aramex requires one
   * on shipment creation (REQ24), so the merchant's own address is used — they
   * are who Aramex would contact about the parcel anyway.
   */
  private consignee(request: AwbRequest, account: CourierAccount): Record<string, unknown> {
    return {
      Reference1: request.reference,
      Reference2: '',
      AccountNumber: '',
      PartyAddress: this.address({
        line1: request.address || request.commune || request.wilaya,
        line2: request.commune,
        city: request.wilaya,
        countryCode: account.shipperCountryCode || account.accountCountryCode || '',
      }),
      Contact: {
        Department: '',
        PersonName: request.customerName,
        Title: '',
        // Aramex requires a company name even for a private recipient.
        CompanyName: request.customerName,
        PhoneNumber1: request.customerPhone,
        PhoneNumber1Ext: '',
        PhoneNumber2: '',
        PhoneNumber2Ext: '',
        FaxNumber: '',
        CellPhone: request.customerPhone,
        EmailAddress: account.shipperEmail,
        Type: '',
      },
    };
  }

  // ── Operations ────────────────────────────────────────────────────────────

  /**
   * There is no dedicated ping in the API, so the credentials are exercised
   * against PrintLabel with a waybill that cannot exist. Invalid credentials
   * come back as ERR01/ERR02 and are reported; "shipment does not exist"
   * (ERR40) means the account authenticated, which is what we are testing.
   */
  async testConnection(creds: AramexCredentials): Promise<void> {
    const body = (await courierFetch({
      url: this.url(creds.account, 'PrintLabel'),
      method: 'POST',
      body: {
        ClientInfo: this.clientInfo(creds),
        Transaction: this.transaction('connection-test'),
        ShipmentNumber: '0',
        ProductGroup: creds.account.productGroup,
        OriginEntity: creds.account.accountEntity,
        LabelInfo: { ReportID: LABEL_REPORT_ID, ReportType: 'URL' },
      },
    })) as AramexEnvelope;

    if (!body?.HasErrors) return;

    const codes = new Set((body.Notifications ?? []).map((n) => n.Code));
    // The account is valid; only the fake waybill was rejected.
    if (codes.has('ERR40') || codes.has('ERR41')) return;

    this.assertNoErrors(body, 'connection test');
  }

  async generateAwb(request: AwbRequest, creds: AramexCredentials): Promise<AwbResult> {
    const { account } = creds;

    const shipment: Record<string, unknown> = {
      Reference1: request.reference,
      Reference2: '',
      Reference3: '',
      Shipper: this.shipper(account),
      Consignee: this.consignee(request, account),
      ThirdParty: null,
      ShippingDateTime: this.date(new Date()),
      DueDate: this.date(new Date()),
      Comments: '',
      PickupLocation: '',
      OperationsInstructions: '',
      // Aramex's own misspelling — see the file header.
      AccountingInstrcutions: '',
      Details: this.shipmentDetails(request, account),
      Attachments: [],
      ForeignHAWB: request.reference,
      // Aramex's own encoded trailing space — see the file header.
      TransportType_x0020_: 0,
      PickupGUID: '',
      // Left empty so Aramex allocates the waybill and returns it.
      Number: '',
      ScheduledDelivery: null,
      IsLocalized: false,
    };

    const body = (await courierFetch({
      url: this.url(account, 'CreateShipments'),
      method: 'POST',
      body: {
        ClientInfo: this.clientInfo(creds),
        Transaction: this.transaction(request.reference),
        Shipments: [shipment],
        LabelInfo: { ReportID: LABEL_REPORT_ID, ReportType: 'URL' },
      },
    })) as AramexEnvelope & { Shipments?: ProcessedShipment[] };

    this.assertNoErrors(body, 'shipment');

    const processed = body.Shipments?.[0];
    if (!processed) {
      throw new CourierApiError(
        'Aramex accepted the request but returned no shipment.',
        'COURIER_BAD_RESPONSE',
      );
    }
    // Errors repeat per shipment; a batch can partially fail.
    this.assertNoErrors(processed, 'shipment');

    if (!processed.ID) {
      throw new CourierApiError(
        'Aramex returned a shipment with no waybill number.',
        'COURIER_BAD_RESPONSE',
      );
    }

    return {
      awbNumber: String(processed.ID),
      labelPdf: await this.readLabel(processed.ShipmentLabel),
      labelPdfUrl: processed.ShipmentLabel?.LabelURL ?? null,
    };
  }

  private shipmentDetails(
    request: AwbRequest,
    account: CourierAccount,
  ): Record<string, unknown> {
    const pieces = request.items.reduce((sum, item) => sum + item.quantity, 0) || 1;
    const hasCod = request.codAmount > 0;

    return {
      Dimensions: null,
      // Aramex requires a weight and the app does not track one; 0.5 kg is a
      // floor, and Aramex reweighs at intake and bills on the higher value.
      ActualWeight: { Unit: 'KG', Value: 0.5 },
      ChargeableWeight: null,
      DescriptionOfGoods:
        request.items.map((i) => `${i.quantity}x ${i.name}`).join(', ').slice(0, 100) ||
        'Goods',
      GoodsOriginCountry: account.shipperCountryCode || account.accountCountryCode,
      NumberOfPieces: pieces,
      ProductGroup: account.productGroup,
      ProductType: account.productType,
      // Prepaid: the merchant is billed for carriage, separately from the COD
      // the courier collects for them.
      PaymentType: 'P',
      PaymentOptions: '',
      CustomsValueAmount: null,
      CashOnDeliveryAmount: hasCod
        ? this.money(request.codAmount, account.codCurrency)
        : null,
      InsuranceAmount: null,
      CashAdditionalAmount: null,
      CashAdditionalAmountDescription: '',
      CollectAmount: null,
      // Comma-separated when there is more than one (manual, Table 22).
      Services: hasCod ? COD_SERVICE : '',
      Items: [],
      DeliveryInstructions: null,
      AdditionalProperties: [],
      ContainsDangerousGoods: false,
      PieceDimensions: [],
      // Undocumented and unnamed for anything; Aramex's schema declares it and
      // requires it present, like `AccountingInstrcutions`. Not ours to remove.
      IsTrue: false,
    };
  }

  /** Prefers inline bytes, falling back to downloading the hosted label. */
  private async readLabel(label: ShipmentLabel | undefined): Promise<Buffer | null> {
    if (label?.LabelFileContents) {
      return Buffer.from(label.LabelFileContents, 'base64');
    }
    return label?.LabelURL ? fetchLabelPdf(label.LabelURL) : null;
  }

  /**
   * Aramex schedules and prices a pickup per visit, so all the waybills go in
   * one call. Table 31 omits several fields that error codes REQ26–REQ32 prove
   * are required, so the error codes are followed rather than the table.
   */
  async requestPickup(awbNumbers: string[], creds: AramexCredentials): Promise<PickupResult> {
    const { account } = creds;

    // Aramex rejects a pickup dated in the past (ERR17) or more than a week out
    // (ERR18). Today, with a window that has not already closed.
    const ready = new Date();
    ready.setHours(Math.max(ready.getHours() + 1, 9), 0, 0, 0);
    const last = new Date(ready);
    last.setHours(18, 0, 0, 0);
    const closing = new Date(last);

    const body = (await courierFetch({
      url: this.url(account, 'CreatePickup'),
      method: 'POST',
      body: {
        ClientInfo: this.clientInfo(creds),
        Transaction: this.transaction(`pickup-${Date.now()}`),
        Pickup: {
          PickupAddress: this.shipperAddress(account),
          PickupContact: this.shipperContact(account),
          PickupLocation: account.shipperLine1,
          PickupDate: this.date(ready),
          ReadyTime: this.date(ready),
          LastPickupTime: this.date(last),
          ClosingTime: this.date(closing),
          Comments: '',
          Reference1: `MNADHEM-${Date.now()}`,
          Reference2: '',
          Vehicle: '',
          Shipments: [],
          PickupItems: [
            {
              ProductGroup: account.productGroup,
              ProductType: account.productType,
              NumberOfShipments: awbNumbers.length,
              PackageType: 'Box',
              Payment: 'P',
              ShipmentWeight: { Unit: 'KG', Value: 0.5 * awbNumbers.length },
              ShipmentVolume: { Unit: 'Cm3', Value: 0 },
              NumberOfPieces: awbNumbers.length,
              CashAmount: null,
              ExtraCharges: null,
              ShipmentDimensions: null,
              Comments: '',
            },
          ],
          Status: 'Ready',
          ExistingShipments: [],
          Branch: '',
          RouteCode: '',
          Dispatcher: 0,
        },
        LabelInfo: null,
      },
    })) as AramexEnvelope & { ProcessedPickup?: ProcessedPickup };

    this.assertNoErrors(body, 'pickup request');

    // The GUID, not the ID: it is what cancels the pickup later and what a
    // subsequent shipment sends back as PickupGUID.
    const reference = body.ProcessedPickup?.GUID ?? body.ProcessedPickup?.ID;
    if (!reference) {
      throw new CourierApiError(
        'Aramex accepted the pickup but returned no reference.',
        'COURIER_BAD_RESPONSE',
      );
    }

    return { pickupReference: String(reference), scheduledAt: ready };
  }

  /**
   * Tracking is a separate Aramex API and is not covered by the shipping
   * manual, so this links to their public tracking page rather than calling one.
   */
  trackingUrl(awbNumber: string): string {
    return `${TRACKING_PAGE}${encodeURIComponent(awbNumber)}`;
  }
}

interface ShipmentLabel {
  LabelURL?: string | null;
  LabelFileContents?: string | null;
}

interface ProcessedShipment extends AramexEnvelope {
  ID?: string;
  ShipmentLabel?: ShipmentLabel;
}

interface ProcessedPickup {
  ID?: string;
  GUID?: string;
}
