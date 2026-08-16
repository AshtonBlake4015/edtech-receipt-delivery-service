import { InfraiEmailClient } from "../src/infrai_email.js";
import { receiptRequestSchema, sendCourseReceipt } from "../src/course_receipt.js";

const apiKey = process.env.INFRAI_API_KEY;
const learnerEmail = process.env.LEARNER_EMAIL;
if (!apiKey || !learnerEmail) {
  throw new Error("INFRAI_API_KEY and LEARNER_EMAIL are required");
}

const input = receiptRequestSchema.parse({
  orderId: `demo-${Date.now()}`,
  learner: { name: "Avery", email: learnerEmail },
  course: {
    title: "Practical TypeScript",
    startsAt: "2026-09-01T09:00:00+00:00",
    accessDays: 30,
  },
  amountCents: 4900,
  currency: "USD",
});

const result = await sendCourseReceipt(input, new InfraiEmailClient(apiKey));
console.log(JSON.stringify(result, null, 2));
