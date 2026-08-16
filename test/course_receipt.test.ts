import assert from "node:assert/strict";
import test from "node:test";
import { sendCourseReceipt, type ReceiptEmailPort } from "../src/course_receipt.js";

test("puts the access deadline in the receipt and hands message_id to reporting", async () => {
  let sentHtml = "";
  let reportedMessageId = "";
  const email: ReceiptEmailPort = {
    email: {
      async send(body) {
        sentHtml = body.html;
        return { message_id: "msg_course_42" };
      },
      async get(messageId) {
        reportedMessageId = messageId;
        return { state: "accepted" };
      },
    },
  };

  const result = await sendCourseReceipt({
    orderId: "order-42",
    learner: { name: "Avery", email: "avery@example.com" },
    course: {
      title: "Practical TypeScript",
      startsAt: "2026-09-01T09:00:00.000Z",
      accessDays: 30,
    },
    amountCents: 4900,
    currency: "USD",
  }, email);

  assert.equal(result.accessDeadline, "2026-10-01T09:00:00.000Z");
  assert.match(sentHtml, /Course access ends: 2026-10-01T09:00:00.000Z/);
  assert.equal(reportedMessageId, "msg_course_42");
  assert.deepEqual(result.educatorReport, {
    messageId: "msg_course_42",
    delivery: { state: "accepted" },
  });
});
