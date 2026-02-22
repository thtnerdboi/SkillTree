import React, { createContext, useCallback, useContext, useState } from "react";

type StripeContextValue = {
  initPaymentSheet: (params: { clientSecret: string; merchantDisplayName: string }) => Promise<{ error?: { message: string } }>;
  presentPaymentSheet: () => Promise<{ error?: { message: string } }>;
  loading: boolean;
};

const StripeContext = createContext<StripeContextValue | undefined>(undefined);

type MockStripeProviderProps = {
  publishableKey: string;
  children: React.ReactNode;
};

export function MockStripeProvider({ publishableKey: _publishableKey, children }: MockStripeProviderProps) {
  const [loading, setLoading] = useState<boolean>(false);

  const initPaymentSheet = useCallback(
    async (_params: { clientSecret: string; merchantDisplayName: string }) => {
      console.log("[stripe] initPaymentSheet called (mock)");
      return {};
    },
    []
  );

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
