import { createServer } from "node:http";
import { ZodError } from "zod";
import { receiptRequestSchema, sendCourseReceipt } from "./course_receipt.js";
import { InfraiEmailClient, InfraiError } from "./infrai_email.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");

const infrai = new InfraiEmailClient(apiKey);
const port = Number(process.env.PORT ?? 3000);

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST" || request.url !== "/receipts") {
    response.writeHead(404).end(JSON.stringify({ error: "Not found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = receiptRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await sendCourseReceipt(input, infrai);
    response.writeHead(201).end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.writeHead(400).end(JSON.stringify({ error: "Invalid receipt request" }));
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.writeHead(status).end(JSON.stringify({ error: error.message }));
      return;
    }
    response.writeHead(500).end(JSON.stringify({ error: "Unexpected service error" }));
  }
});

server.listen(port, () => console.log(`Receipt service listening on http://localhost:${port}`));
