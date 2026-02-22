import React from 'react';
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';

type MockStripeProviderProps = {
  children: React.ReactNode;
};

/**
 * Using the REAL StripeProvider now. 
 * Ensure your .env file has EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY set.
 */
export function MockStripeProvider({ children }: MockStripeProviderProps) {
  return (
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""}
    >
      {children}
    </StripeProvider>
  );
}

export const useStripePayment = useStripe;