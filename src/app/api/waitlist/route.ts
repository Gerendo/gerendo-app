import { NextResponse } from "next/server";
import { Resend } from "resend";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

const WELCOME_SUBJECT = "thanks for joining the Gerendo waitlist";

const WELCOME_TEXT = `Hey,

Ermina here — co-founder behind Gerendo.

Thanks for dropping your email. You're on the waitlist for the alpha.

Quick context: I work with a marketing agency and I see the same thing happen over and over. A client says one thing in WhatsApp, Asana shows another, the deck shows a third. We end up apologizing for deadlines that keep getting pushed, or burning hours hunting for information we should already have. I want a single brain the whole team can ask.

If any of this sounds familiar, hit reply and tell me about it.

I'll keep you posted as we open up access.

— Ermina
gerendo.com
`;

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !from || !audienceId) {
    console.error("Missing RESEND_* env vars");
    return json({ error: "Server not configured." }, 500);
  }
  const resend = new Resend(apiKey);

  let email: string;
  try {
    const body = (await request.json()) as { email?: unknown };
    if (typeof body.email !== "string") throw new Error("invalid");
    email = body.email.trim().toLowerCase();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Please enter a valid email." }, 400);
  }

  const contact = await resend.contacts.create({
    email,
    audienceId,
    unsubscribed: false,
  });

  if (contact.error && !/already exists/i.test(contact.error.message ?? "")) {
    console.error("Resend contacts.create failed", contact.error);
    return json({ error: "Could not save your email. Try again." }, 502);
  }

  const send = await resend.emails.send({
    from,
    to: email,
    subject: WELCOME_SUBJECT,
    text: WELCOME_TEXT,
    replyTo: "contact@gerendo.com",
  });

  if (send.error) {
    console.error("Resend emails.send failed", send.error);
    return json({ error: "Could not send welcome email. Try again." }, 502);
  }

  return json({ ok: true }, 200);
}
