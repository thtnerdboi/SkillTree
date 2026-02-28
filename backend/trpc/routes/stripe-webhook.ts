import { Hono } from "hono";
import Stripe from "stripe";
import { storeApi } from "../store"; // Adjust this path if your store.ts is somewhere else!

// Initialize Stripe (Make sure your test secret key is in your .env!)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16", 
});

export const webhookRouter = new Hono();

webhookRouter.post("/stripe", async (c) => {
  const sig = c.req.header("stripe-signature");
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !endpointSecret) {
    console.error("⚠️ Webhook secret or signature missing.");
    return c.text("Webhook Error: Missing secret or signature", 400);
  }

  let event: Stripe.Event;

  try {
    // CRITICAL: Stripe requires the RAW string to mathematically verify the signature.
    // Hono makes this super easy with c.req.text()
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
      
      // We only care if this is a subscription payment
      if (invoice.subscription) {
        const customerId = invoice.customer as string;
        console.log(`💰 Payment succeeded for Stripe Customer: ${customerId}`);
        
        // 1. Find the user in our database using the new function we added
        const user = storeApi.findUserByStripeId(customerId);
        
        if (user) {
          // 2. UPGRADE THEM TO PRO SECURELY!
          storeApi.upsertUser({ ...user, isPro: true });
          console.log(`🚀 Success! User ${user.id} is now PRO!`);
        } else {
          console.warn(`Error: Nobody in the database matches Stripe ID ${customerId}`);
        }
      }
      break;
    }
    case "customer.subscription.deleted": {
      // If they cancel or their card declines for too long, downgrade them
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      
      const user = storeApi.findUserByStripeId(customerId);
      if (user) {
        storeApi.upsertUser({ ...user, isPro: false });
        console.log(`📉 User ${user.id} downgraded from PRO.`);
      }
      break;
    }
    default:
      console.log(`Unhandled Stripe event type: ${event.type}`);
  }

  // Always send a 200 back so Stripe knows you received it
  return c.text("Received", 200);
});