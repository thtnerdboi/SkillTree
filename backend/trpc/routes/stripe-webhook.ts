import { Hono } from "hono";
import Stripe from "stripe";
import { storeApi } from "../store"; // Adjust this path if your store.ts is somewhere else!

// Initialize Stripe (Make sure your test secret key is in your .env!)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2026-02-25.clover", 
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
      const invoice = event.data.object;
      
      // We only care if this is a subscription payment
      // TypeScript workaround: Stripe Invoice may have subscription property at runtime
      const subscriptionId = (invoice as any).subscription;
      if (subscriptionId) {
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (!customerId) {
          console.warn(`⚠️ Invoice payment succeeded but no customer ID found`);
          break;
        }
        
        console.log(`💰 Payment succeeded for Stripe Customer: ${customerId}`);
        
        // 1. Find the user in our database using the new function we added
        const user = storeApi.findUserByStripeId(customerId);
        
        if (user) {
          // 2. UPGRADE THEM TO PRO SECURELY!
          const updatedUser = storeApi.upsertUser({ ...user, isPro: true });
          console.log(`🚀 Success! User ${user.id} is now PRO!`);
        } else {
          console.warn(`⚠️ No user found with Stripe ID ${customerId} - payment received but unable to upgrade account`);
        }
      }
      break;
    }
    case "customer.subscription.deleted": {
      // If they cancel or their card declines for too long, downgrade them
      const subscription = event.data.object;
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
      
      if (!customerId) {
        console.warn(`⚠️ Subscription deleted but no customer ID found`);
        break;
      }
      
      const user = storeApi.findUserByStripeId(customerId);
      if (user) {
        const updatedUser = storeApi.upsertUser({ ...user, isPro: false });
        console.log(`📉 User ${user.id} downgraded from PRO.`);
      } else {
        console.warn(`⚠️ No user found with Stripe ID ${customerId} - unable to process subscription cancellation`);
      }
      break;
    }
    default:
      console.log(`Unhandled Stripe event type: ${event.type}`);
  }

  // Always send a 200 back so Stripe knows you received it
  return c.text("Received", 200);
});