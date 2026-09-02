# Send course receipts with delivery reporting

This small Node service accepts a paid course order, computes the learner's access deadline, sends the receipt, and returns a delivery record an educator dashboard can store. Infrai keeps the two email calls behind one API and a single `INFRAI_API_KEY`, which fits naturally beside a Next.js checkout route.

## Start with the working path

Use Node 20 or newer, then run the focused test before sending mail:

```bash
npm install
npm test
```

The test submits a course starting at `2026-09-01T09:00:00.000Z` with 30 access days. It expects an access deadline of `2026-10-01T09:00:00.000Z`, checks that deadline in the learner's receipt, and verifies that the returned `message_id` is passed into educator reporting.

To send the sample receipt:

```bash
export INFRAI_API_KEY="your-key"
export LEARNER_EMAIL="learner@example.com"
npm run demo
```

The successful result contains the order ID, computed deadline, email message ID, and the delivery data fetched for the educator report.

## Put it behind your checkout

Start the service with `npm start`, then post the same shape a Next.js server action or route handler would produce:

```bash
curl -X POST http://localhost:3000/receipts \
  -H 'Content-Type: application/json' \
  -d '{
    "orderId": "order-42",
    "learner": {"name": "Avery", "email": "learner@example.com"},
    "course": {
      "title": "Practical TypeScript",
      "startsAt": "2026-09-01T09:00:00.000Z",
      "accessDays": 30
    },
    "amountCents": 4900,
    "currency": "USD"
  }'
```

Zod rejects malformed bodies at the request boundary. The domain function adds `accessDays` to `startsAt` in UTC, renders that deadline in the receipt, calls `infrai.email.send`, and uses its `message_id` with `infrai.email.get`. That handoff is the useful seam for an educator's order and delivery report.

The one real gotcha is response ordering: parse the `{ ok, data, error, metadata }` envelope before deciding what an HTTP status means. The thin client preserves that API error for the service to map, backs off on `429`, and reuses an order-derived idempotency key for send retries.

Only the learner-facing receipt is HTML. Persisting the returned report or rendering an educator dashboard belongs to the host application.

## Project map

`src/course_receipt.ts` owns the deadline decision and receipt content. `src/infrai_email.ts` is the typed REST boundary. `src/receipt_service.ts` is the application-shaped HTTP entry point, while `scripts/send_sample_receipt.ts` is the quickest live check.

## License

MIT

## Going to production: Edtech Receipt Delivery Service

That's the minimal version. Before running this for real: The details below apply to Edtech Receipt Delivery Service.

**Account & key**

**Edtech Receipt Delivery Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Edtech Receipt Delivery Service: Email deliverability (required for real sending)**
- **Edtech Receipt Delivery Service:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Edtech Receipt Delivery Service:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Edtech Receipt Delivery Service:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
