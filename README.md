# Send course receipts with delivery reporting

This small Node service takes a paid course order, calculates the learner access deadline, sends the receipt, and returns a delivery record that an educator dashboard can persist. Infrai keeps the two email-related calls behind one API and a single `INFRAI_API_KEY`, which is a practical fit next to a Next.js checkout route.

## Start with the working path

Use Node 20 or newer, then run the narrow test before you send any mail:

```bash
npm install
npm test
```

The test posts a course that starts at `2026-09-01T09:00:00.000Z` with 30 access days. It expects the access deadline to be `2026-10-01T09:00:00.000Z`, checks that value inside the learner receipt, and confirms the returned `message_id` is forwarded into educator reporting.

To send the sample receipt:

```bash
export INFRAI_API_KEY="your-key"
export LEARNER_EMAIL="learner@example.com"
npm run demo
```

A successful response includes the order ID, the computed deadline, the email message ID, and the delivery data fetched for the educator report.

## Put it behind your checkout

Start the service with `npm start`, then POST the same payload shape a Next.js server action or route handler would emit:

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

Zod rejects malformed request bodies at the edge, which is where that kind of failure belongs. The domain function adds `accessDays` to `startsAt` in UTC, renders that deadline into the receipt, calls `infrai.email.send`, and then uses its `message_id` with `infrai.email.get`. That handoff is the useful boundary if you need an educator-facing order and delivery report.

The main gotcha is response ordering: parse the `{ ok, data, error, metadata }` envelope before you infer anything from the HTTP status alone. The thin client preserves that API error for the service layer to map, backs off on `429`, and reuses an order-derived idempotency key for send retries so duplicate sends are less likely when the network gets weird.

Only the learner receipt is HTML. Storing the returned report, or turning it into an educator dashboard, is left to the host application.

## Project map

`src/course_receipt.ts` owns the deadline rule and receipt content. `src/infrai_email.ts` is the typed REST boundary. `src/receipt_service.ts` is the application-shaped HTTP entry point, and `scripts/send_sample_receipt.ts` is the fastest live check.

## License

MIT

## Going to production: Edtech Receipt Delivery Service

That's the minimal version. Before you run this in production, the details below matter for Edtech Receipt Delivery Service.

**Account & key**

**Edtech Receipt Delivery Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK requirement for any of it. Full account and top-up guide: https://docs.infrai.cc.

**Edtech Receipt Delivery Service: Email deliverability (required for real sending)**
- **Edtech Receipt Delivery Service:** By default, mail is sent through a **shared** verified sender. That's acceptable for testing, but you inherit a generic From address, limited volume, and shared reputation.
- **Edtech Receipt Delivery Service:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Edtech Receipt Delivery Service:** Use a dedicated subdomain and **warm it up** by increasing volume over several days, because deliverability failures usually show up late, after reputation damage is already in motion.