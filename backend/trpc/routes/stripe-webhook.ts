import { Hono } from "hono";
import Stripe from "stripe";
import { storeApi } from "../store";

export const webhookRouter = new Hono();

// Helper to get Stripe instance safely
const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is missing from environment variables");
  }
  return new Stripe(key, { apiVersion: "2023-10-16" });
};

webhookRouter.post("/stripe", async (c) => {
  const sig = c.req.header("stripe-signature");
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !endpointSecret) {
    console.error("⚠️ Webhook secret or signature missing.");
    return c.text("Webhook Error", 400);
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    const rawBody = await c.req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err: any) {
    console.error(`⚠️ Webhook signature verification failed:`, err.message);
    return c.text(`Webhook Error: ${err.message}`, 400);
  }

  // Handle the specific payment events
  switch (event.type) {
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        const customerId = invoice.customer as string;
        
        // 🔥 FIX: Must use await for Supabase/Drizzle
        const user = await storeApi.findUserByStripeId(customerId);
        
        if (user) {
          await storeApi.upsertUser({ ...user, isPro: true });
          console.log(`🚀 Success! User ${user.id} is now PRO!`);
        } else {
          console.warn(`Error: No user matches Stripe ID ${customerId}`);
        }
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      
      const user = await storeApi.findUserByStripeId(customerId);
      if (user) {
        await storeApi.upsertUser({ ...user, isPro: false });
        console.log(`📉 User ${user.id} downgraded from PRO.`);
      }
      break;
    }
  }

  return c.text("Received", 200);
});