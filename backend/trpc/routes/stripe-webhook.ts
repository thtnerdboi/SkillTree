import { Hono } from "hono";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "../../db"; 
import { users } from "../../db/schema"; 

const getStripeClient = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }
  return new Stripe(secret);
};

// We export a standalone Hono router for the webhook
export const stripeWebhookRouter = new Hono();

stripeWebhookRouter.post("/", async (c) => {
  const stripe = getStripeClient();
  const signature = c.req.header("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!signature) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  if (!webhookSecret) {
    return c.json({ error: "Missing STRIPE_WEBHOOK_SECRET on server." }, 500);
  }

  // 🔥 Get the raw text body BEFORE anything tries to parse it into JSON
  const rawBody = await c.req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret 
    );
  } catch (err: any) {
    console.error(`❌ Webhook signature verification failed: ${err.message}`);
    return c.json({ error: err.message }, 400);
  }

  try {
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      const customer = await stripe.customers.retrieve(customerId);
      
      if (!customer.deleted && customer.metadata?.userId) {
        const userId = customer.metadata.userId;

        // Upgrade the user to Pro in Supabase
        await db.update(users)
          .set({ isPro: true })
          .where(eq(users.id, userId));

        console.log(`✅ [Webhook] Success: User ${userId} is now PRO`);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      
      const customer = await stripe.customers.retrieve(customerId);
      
      if (!customer.deleted && customer.metadata?.userId) {
        const userId = customer.metadata.userId;

        // Downgrade the user if they cancel
        await db.update(users)
          .set({ isPro: false })
          .where(eq(users.id, userId));

        console.log(`🔻 [Webhook] Cancelled: User ${userId} is now FREE`);
      }
    }

    return c.json({ received: true });
    
  } catch (error) {
    console.error("❌ Error processing webhook event:", error);
    return c.json({ error: "Webhook handler failed" }, 500);
  }
});
