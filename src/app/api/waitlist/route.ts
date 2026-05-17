import { NextResponse } from "next/server";
import { Resend } from "resend";
import { notifyError } from "@/lib/notify-error";

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

const WELCOME_SUBJECT = "you're on the waitlist - a note from Ermina";

const WELCOME_TEXT = `Hey,

Ermina here - co-founder of Gerendo.

Thanks for dropping your email. You're on the waitlist for the alpha.

I work close to marketing agency teams, and I see the same pattern over and over. A client says one thing in email, Asana shows another, the deck shows a third. We end up apologizing for slipped deadlines or hunting for context that should already be there. I want a single brain the whole team can ask.

You signed up early - thank you so much for joining us in the journey of helping marketing agencies with Gerendo. The first agencies here will shape what we build. If any of this sounds familiar, hit reply and tell me what's most painful right now.

I'll keep you posted as you are part of our journey.

Thank you for your trust!
- Ermina
`;

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !from || !audienceId) {
    console.error("Missing RESEND_* env vars");
    await notifyError({
      route: "/api/waitlist",
      error: new Error("Missing RESEND_* env vars"),
      context: {
        hasApiKey: !!apiKey,
        hasFrom: !!from,
        hasAudienceId: !!audienceId,
      },
    });
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
    await notifyError({
      route: "/api/waitlist",
      error: contact.error,
      context: { step: "contacts.create", email },
    });
    return json({ error: "Could not save your email. Try again." }, 502);
  }

  const send = await resend.emails.send({
    from,
    to: email,
    subject: WELCOME_SUBJECT,
    text: WELCOME_TEXT,
    replyTo: "ermina@gerendo.com",
  });

  if (send.error) {
    console.error("Resend emails.send failed", send.error);
    await notifyError({
      route: "/api/waitlist",
      error: send.error,
      context: { step: "emails.send", email },
    });
    return json({ error: "Could not send welcome email. Try again." }, 502);
  }

  return json({ ok: true }, 200);
}
