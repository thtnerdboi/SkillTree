import React from 'react';

/**
 * This is a "Dummy" version of Stripe for the Web.
 * It prevents the web bundler from crashing while 
 * letting the rest of the app load in your browser.
 */

export function MockStripeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export const useStripePayment = () => {
  return {
    initPaymentSheet: async () => ({ error: { message: "Stripe not available on web" } }),
    presentPaymentSheet: async () => ({ error: { message: "Stripe not available on web" } }),
    loading: false,
  };
};