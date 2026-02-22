import React, { createContext, useContext } from "react";
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';

type MockStripeProviderProps = {
  publishableKey?: string;
  children: React.ReactNode;
};

export function MockStripeProvider({ children }: MockStripeProviderProps) {
  // Now using the REAL Stripe Provider!
  return (
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""}
    >
      {children}
    </StripeProvider>
  );
}

// Export the real stripe hooks so the payment sheet works
export const useStripePayment = useStripe;

  const presentPaymentSheet = useCallback(async () => {
    console.log("[stripe] presentPaymentSheet called (mock) — simulating success");
    setLoading(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 1600));
    setLoading(false);
    return {};
  }, []);

  return (
    <StripeContext.Provider value={{ initPaymentSheet, presentPaymentSheet, loading }}>
      {children}
    </StripeContext.Provider>
  );
}

export function useStripePayment() {
  const ctx = useContext(StripeContext);
  if (!ctx) throw new Error("useStripePayment must be used inside MockStripeProvider");
  return ctx;
}
