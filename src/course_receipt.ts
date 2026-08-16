import { z } from "zod";

export const receiptRequestSchema = z.object({
  orderId: z.string().min(1).max(80),
  learner: z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
  }),
  course: z.object({
    title: z.string().min(1).max(160),
    startsAt: z.string().datetime({ offset: true }),
    accessDays: z.number().int().positive().max(730),
  }),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
});

export type ReceiptRequest = z.infer<typeof receiptRequestSchema>;

export type ReceiptEmailPort = {
  email: {
    send(body: { to: string; subject: string; html: string }, idempotencyKey: string): Promise<{ message_id: string }>;
    get(messageId: string): Promise<unknown>;
  };
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] as string);

export function accessDeadline(startsAt: string, accessDays: number): string {
  const deadline = new Date(startsAt);
  deadline.setUTCDate(deadline.getUTCDate() + accessDays);
  return deadline.toISOString();
}

export async function sendCourseReceipt(input: ReceiptRequest, infrai: ReceiptEmailPort) {
  const deadline = accessDeadline(input.course.startsAt, input.course.accessDays);
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: input.currency,
  }).format(input.amountCents / 100);

  const sent = await infrai.email.send({
    to: input.learner.email,
    subject: `Receipt ${input.orderId}: ${input.course.title}`,
    html: `<h1>Enrollment confirmed</h1><p>Hi ${escapeHtml(input.learner.name)}, your ${escapeHtml(input.course.title)} order is paid.</p><p>Paid: ${escapeHtml(amount)}</p><p>Course access ends: ${escapeHtml(deadline)}</p>`,
  }, `course-receipt:${input.orderId}`);

  const delivery = await infrai.email.get(sent.message_id);
  return {
    orderId: input.orderId,
    messageId: sent.message_id,
    accessDeadline: deadline,
    educatorReport: { messageId: sent.message_id, delivery },
  };
}
