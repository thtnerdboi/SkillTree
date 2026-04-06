import { publicProcedure, createTRPCRouter } from "../create-context"; // Corrected import name
import { z } from "zod";
import Stripe from "stripe";
import { TRPCError } from "@trpc/server";

const getStripeClient = () => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Stripe is not configured on the server.",
    });
  }
  return new Stripe(secret);
};

export const stripeRouter = createTRPCRouter({ // Corrected function name
  createPaymentSheet: publicProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      const stripe = getStripeClient();

      // 1. Create or retrieve a customer
      const customer = await stripe.customers.create({
        metadata: { userId: input.userId },
      });

      // 2. Create an Ephemeral Key (Allows the mobile SDK to manage the customer)
      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customer.id },
        { apiVersion: "2025-03-31.basil" }
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
