import { Platform } from "react-native";

const revenueCatEnvKeys = [
  "EXPO_PUBLIC_REVENUECAT_API_KEY",
  "EXPO_PUBLIC_REVENUECAT_PRO_ENTITLEMENT_ID",
  "EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID",
  "EXPO_PUBLIC_REVENUECAT_YEARLY_PRODUCT_ID",
] as const;

type RevenueCatEnvKey = (typeof revenueCatEnvKeys)[number];

type RevenueCatConfig = {
  apiKey: string;
  entitlementId: string;
  monthlyProductId: string;
  yearlyProductId: string;
  isComplete: boolean;
  missingEnvVars: RevenueCatEnvKey[];
  errorMessage: string | null;
};

const isNativeMobile = Platform.OS === "ios" || Platform.OS === "android";

const readEnvVar = (key: RevenueCatEnvKey) => process.env[key]?.trim() ?? "";

const buildMissingConfigMessage = (missingEnvVars: RevenueCatEnvKey[]) =>
  `Missing required RevenueCat configuration: ${missingEnvVars.join(
    ", "
  )}. Set these EXPO_PUBLIC_* env vars before building a production native app.`;

const buildRevenueCatConfig = (): RevenueCatConfig => {
  const values = {
    apiKey: readEnvVar("EXPO_PUBLIC_REVENUECAT_API_KEY"),
    entitlementId: readEnvVar("EXPO_PUBLIC_REVENUECAT_PRO_ENTITLEMENT_ID"),
    monthlyProductId: readEnvVar("EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID"),
    yearlyProductId: readEnvVar("EXPO_PUBLIC_REVENUECAT_YEARLY_PRODUCT_ID"),
  };

  const missingEnvVars = revenueCatEnvKeys.filter((key) => readEnvVar(key).length === 0);
  const errorMessage =
    missingEnvVars.length > 0 ? buildMissingConfigMessage(missingEnvVars) : null;

  if (errorMessage) {
    if (!__DEV__ && isNativeMobile) {
      throw new Error(errorMessage);
    }

    if (__DEV__) {
      console.warn(`[runtime-config] ${errorMessage}`);
    }
  }

  return {
    ...values,
    isComplete: missingEnvVars.length === 0,
    missingEnvVars,
    errorMessage,
  };
};

export const runtimeConfig = {
  revenueCat: buildRevenueCatConfig(),
};

export const revenueCatConfig = runtimeConfig.revenueCat;
