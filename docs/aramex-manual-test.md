# Aramex — manual test credentials

Values for exercising the Settings → Aramex form by hand.

**Source:** §4.1.1 of `shipping-services-api-manual.pdf` (page 37). The credentials are embedded
there as a screenshot, not text, which is why every text extraction of that section comes back
blank. Read out of the image directly — verified against the pixels, not retyped from a
third-party guide.

## Aramex account

| Field                | Value                   |
| -------------------- | ----------------------- |
| Username (email)     | `testingapi@aramex.com` |
| Password             | `R123456789$r`          |
| Account number       | `102331`                |
| Account PIN          | `321321`                |
| Account entity       | `LON`                   |
| Account country      | `GB`                    |
| API version          | `v1`                    |

`GB`, not `GN` — the letters are easy to confuse at that image's resolution. `LON` is Aramex's
London entity, so `GB` is the reading that makes the pair coherent.

`v1`, not `v1.0`. Our stored default is `v1.0`, which was inferred from the field's 4-character
limit before this section was readable. Type `v1` into the **API version** field under *Shipping
defaults*. (See "Follow-up" below.)

## Which environment

Appendix G (page 65) confirms the test URL is exactly what the code already targets:

```
https://ws.dev.aramex.net/shippingapi.v2/shipping/service_1_0.svc/json
```

So the `TEST_HOST` constant is right. **But that host is unreachable from this network** — it
resolves to `193.189.148.206` and then times out on TCP 443. Rechecked just now; unchanged.
Aramex's sandbox appears to be IP-allowlisted.

This matters more than it did before. These are *genuine sandbox credentials*, so on the host they
were issued for they should actually authenticate — meaning a real waybill, a real label PDF and a
real pickup, which is the end-to-end test that has never yet been possible. **If you can reach
`ws.dev.aramex.net` from another network — mobile hotspot, VPN, a deployed environment — do the
test there.** That is the run worth doing.

### If you can only test from this network

Leave *Use the Aramex test environment* **off**, which sends requests to live. You will get:

```
ERR75: ClientInfo - Failed to login using Portal Service
```

That is the correct and expected outcome: sandbox credentials are not supposed to authenticate
against the live Portal Service. It still proves the whole path on our side — URL, payload shape,
date format, credential encryption/decryption, error handling — and proves nothing about Aramex's
side. It is a shape test, not a functional one.

Testing against live is safe here: authentication fails before anything is created, and the Test
button's operation (`PrintLabel` on waybill `0`) creates nothing even with valid credentials.

## Pickup address

All six of the first fields are required — the provider refuses the call client-side with
"Your pickup address and contact details are incomplete" if any is blank, and the request never
reaches Aramex.

Kept consistent with the `LON`/`GB` account, so the payload is coherent:

| Field                 | Value                 |
| --------------------- | --------------------- |
| Company name          | `Test Co`             |
| Contact name          | `Test Person`         |
| Phone                 | `02079460000`         |
| Mobile                | `07700900000`         |
| Email                 | `test@example.com`    |
| Street address        | `12 Test Street`      |
| City                  | `London`              |
| State / province code | *(leave blank)*       |
| Post code             | `SW1A 1AA`            |

## Shipping defaults

| Field         | Value | Confidence |
| ------------- | ----- | ---------- |
| Product group | `EXP` | Correct for this international express test account. |
| Product type  | `PPX` | Same. |
| COD currency  | `USD` | Same — the manual requires USD. |
| API version   | `v1`  | **From §4.1.1.** Change this from the `v1.0` default. |

## Steps and what you should see

1. **Fill the form and Save.** → green *"Carrier saved."*
   Secrets are encrypted at rest, so the password and PIN fields clear and show a "stored" hint.
   Re-type them only to change them.

2. **Click Test connection.**

**On `ws.dev.aramex.net` (test mode on, reachable network):**

| Result | Meaning |
| --- | --- |
| green *"Connection succeeded"* | **Full pass.** Authenticated. Go on to generate an AWB and request a pickup from Orders — those should now produce a real waybill and label. |
| `ERR01` / `ERR02` | Credentials reached Aramex and were rejected — recheck the values, especially `GB`. |
| `Could not reach the carrier: no response within 15000ms` | Still blocked at the network level. |

**On `ws.aramex.net` (test mode off):**

| Result | Meaning |
| --- | --- |
| `ERR75: ClientInfo - Failed to login using Portal Service` | **Pass for a shape test.** Payload parsed; login refused, as it should be. Shows as a red *"Connection failed"* toast — that is still the pass condition here. |
| `Carrier returned 400: <?xml … Request Error …` | **Fail — payload shape.** A required member is missing; the WCF text names the contract and fields. Fix in `aramex.provider.ts` and rebuild. |
| green *"Connection succeeded"* | Unexpected. It would mean this account has been made live. |

The last-test result persists under the header, so you can re-read the message without re-running.

## Testing the rest of the pipeline

The Test button only calls `PrintLabel`. Generating an AWB and requesting a pickup from Orders
exercise `CreateShipments` and `CreatePickup`. Both are already verified at the wire level against
live, so on this network they will also stop at `ERR75` — a *different* error from either is the
interesting signal. On a network that reaches the sandbox, these are the calls that finally prove
the pipeline end to end.

Tick **Enabled** for the Orders actions to run. The Test button deliberately works on a
saved-but-disabled account, since that is the point of testing it.

## Follow-up

- **`version` default.** `packages/database/prisma/schema.prisma` defaults `CourierAccount.version`
  to `v1.0`; §4.1.1 says `v1`, and the WSDL namespace is `.../ShippingAPI/v1/`. Worth changing the
  default (a one-line schema change plus a migration). Per-account, so the form value wins either
  way — this only affects newly created accounts.
- **Still unanswered by the manual**, and worth asking Aramex when you request your own
  credentials: product group / product type for a **domestic Tunisian** account (the manual
  documents International Express codes only), and COD currency (it requires USD, which does not
  fit TND parcels).
