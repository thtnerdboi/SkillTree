import { publicProcedure, router } from "../trpc";
import { z } from "zod";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export const stripeRouter = router({
  createPaymentSheet: publicProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      // 1. Create or retrieve a customer
      const customer = await stripe.customers.create({
        metadata: { userId: input.userId },
      });

      // 2. Create an Ephemeral Key (Allows the mobile SDK to manage the customer)
      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customer.id },
        { apiVersion: "2023-10-16" }
      );

      // 3. Create a Payment Intent ($19.99 for Pro Lifetime/Yearly)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 1999, // In cents
        currency: "usd",
        customer: customer.id,
        automatic_payment_methods: { enabled: true },
      });

      return {
        paymentIntent: paymentIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: customer.id,
        publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      };
    }),
});