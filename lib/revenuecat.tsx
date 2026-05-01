import createContextHook from "@nkzw/create-context-hook";
import Constants from "expo-constants";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type PurchasesError,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";

import { useAppState } from "../state/app-state";

export const REVENUECAT_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? "test_gUCxzOBClgZHJiwRceRSkJZaFkr";
export const REVENUECAT_ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_PRO_ENTITLEMENT_ID ?? "arcstep_skilltree_pro";
export const REVENUECAT_PRO_DISPLAY_NAME = "ArcStep's SkillTree Pro";
export const REVENUECAT_MONTHLY_PRODUCT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID ?? "monthly";
export const REVENUECAT_YEARLY_PRODUCT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_YEARLY_PRODUCT_ID ?? "yearly";

const isNativeMobile = Platform.OS === "ios" || Platform.OS === "android";

const isProCustomer = (customerInfo: CustomerInfo | null) =>
  Boolean(customerInfo?.entitlements.active[REVENUECAT_ENTITLEMENT_ID]);

const formatRevenueCatError = (error: unknown) => {
  const purchasesError = error as Partial<PurchasesError> | undefined;
  return purchasesError?.message ?? (error instanceof Error ? error.message : "Something went wrong.");
};

const isPurchaseCancelled = (error: unknown) => {
  const purchasesError = error as Partial<PurchasesError> | undefined;
  return purchasesError?.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
    purchasesError?.userCancelled === true;
};

const findPackage = (
  offering: PurchasesOffering | null,
  productId: string,
  packageTypes: string[]
) => {
  if (!offering) return null;

  const normalizedPackageTypes = packageTypes.map((value) => value.toLowerCase());
  return (
    offering.availablePackages.find((pkg) => pkg.product.identifier === productId) ??
    offering.availablePackages.find((pkg) =>
      normalizedPackageTypes.includes(pkg.packageType.toLowerCase())
    ) ??
    offering.availablePackages.find((pkg) =>
      normalizedPackageTypes.includes(pkg.identifier.replace("$rc_", "").toLowerCase())
    ) ??
    null
  );
};

export const [RevenueCatProvider, useRevenueCat] = createContextHook(() => {
  const { state, setPro } = useAppState();
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncCustomerInfo = useCallback(
    (nextCustomerInfo: CustomerInfo | null) => {
      setCustomerInfo(nextCustomerInfo);
      setPro(isProCustomer(nextCustomerInfo));
    },
    [setPro]
  );

  const refreshCustomerInfo = useCallback(async () => {
    if (!isConfigured) return null;
    try {
      const nextCustomerInfo = await Purchases.getCustomerInfo();
      syncCustomerInfo(nextCustomerInfo);
      return nextCustomerInfo;
    } catch (err) {
      const message = formatRevenueCatError(err);
      setError(message);
      console.log("[revenuecat] Customer info failed:", message);
      return null;
    }
  }, [isConfigured, syncCustomerInfo]);

  const refreshOfferings = useCallback(async () => {
    if (!isConfigured) return null;
    try {
      const offerings = await Purchases.getOfferings();
      setCurrentOffering(offerings.current);
      return offerings.current;
    } catch (err) {
      const message = formatRevenueCatError(err);
      setError(message);
      console.log("[revenuecat] Offerings failed:", message);
      return null;
    }
  }, [isConfigured]);

  useEffect(() => {
    if (!isNativeMobile) {
      setIsLoading(false);
      setError("RevenueCat purchases are only available in native iOS and Android builds.");
      return;
    }

    let isMounted = true;
    const listener = (nextCustomerInfo: CustomerInfo) => {
      if (isMounted) syncCustomerInfo(nextCustomerInfo);
    };

    const configureRevenueCat = async () => {
      try {
        await Purchases.setLogLevel(__DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.INFO);
        Purchases.configure({
          apiKey: REVENUECAT_API_KEY,
          appUserID: state.userId || null,
        });
        Purchases.addCustomerInfoUpdateListener(listener);

        if (state.displayName) {
          Purchases.setDisplayName(state.displayName).catch((err) =>
            console.log("[revenuecat] Display name sync failed:", formatRevenueCatError(err))
          );
        }

        if (isMounted) {
          setIsConfigured(true);
          setError(null);
        }
      } catch (err) {
        const message = formatRevenueCatError(err);
        if (isMounted) setError(message);
        console.log("[revenuecat] Configure failed:", message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    configureRevenueCat();

    return () => {
      isMounted = false;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
    // Configure exactly once; later user/display-name changes are synced in separate effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isConfigured) return;
    setIsLoading(true);
    Promise.all([refreshCustomerInfo(), refreshOfferings()]).finally(() => setIsLoading(false));
  }, [isConfigured, refreshCustomerInfo, refreshOfferings]);

  useEffect(() => {
    if (!isConfigured || !state.userId) return;
    Purchases.logIn(state.userId)
      .then(({ customerInfo: nextCustomerInfo }) => syncCustomerInfo(nextCustomerInfo))
      .catch((err) => console.log("[revenuecat] Login failed:", formatRevenueCatError(err)));
  }, [isConfigured, state.userId, syncCustomerInfo]);

  useEffect(() => {
    if (!isConfigured || !state.displayName) return;
    Purchases.setDisplayName(state.displayName).catch((err) =>
      console.log("[revenuecat] Display name sync failed:", formatRevenueCatError(err))
    );
  }, [isConfigured, state.displayName]);

  const monthlyPackage = useMemo(
    () => findPackage(currentOffering, REVENUECAT_MONTHLY_PRODUCT_ID, ["monthly"]),
    [currentOffering]
  );

  const yearlyPackage = useMemo(
    () => findPackage(currentOffering, REVENUECAT_YEARLY_PRODUCT_ID, ["annual", "yearly"]),
    [currentOffering]
  );

  const purchasePackage = useCallback(
    async (pkg: PurchasesPackage | null) => {
      if (!isConfigured) {
        Alert.alert("Purchases unavailable", "RevenueCat is still starting. Try again in a moment.");
        return false;
      }
      if (!pkg) {
        Alert.alert(
          "Product unavailable",
          "This subscription is not in the current RevenueCat offering yet."
        );
        return false;
      }

      setIsPurchasing(true);
      setError(null);
      try {
        const { customerInfo: nextCustomerInfo } = await Purchases.purchasePackage(pkg);
        syncCustomerInfo(nextCustomerInfo);
        return isProCustomer(nextCustomerInfo);
      } catch (err) {
        if (!isPurchaseCancelled(err)) {
          const message = formatRevenueCatError(err);
          setError(message);
          Alert.alert("Purchase failed", message);
        }
        return false;
      } finally {
        setIsPurchasing(false);
      }
    },
    [isConfigured, syncCustomerInfo]
  );

  const purchaseMonthly = useCallback(
    () => purchasePackage(monthlyPackage),
    [monthlyPackage, purchasePackage]
  );

  const purchaseYearly = useCallback(
    () => purchasePackage(yearlyPackage),
    [purchasePackage, yearlyPackage]
  );

  const restorePurchases = useCallback(async () => {
    if (!isConfigured) return false;
    setIsPurchasing(true);
    setError(null);
    try {
      const nextCustomerInfo = await Purchases.restorePurchases();
      syncCustomerInfo(nextCustomerInfo);
      const restoredPro = isProCustomer(nextCustomerInfo);
      Alert.alert(restoredPro ? "Restored" : "No Pro subscription found");
      return restoredPro;
    } catch (err) {
      const message = formatRevenueCatError(err);
      setError(message);
      Alert.alert("Restore failed", message);
      return false;
    } finally {
      setIsPurchasing(false);
    }
  }, [isConfigured, syncCustomerInfo]);

  const presentProPaywall = useCallback(async () => {
    if (!isConfigured) {
      Alert.alert("Purchases unavailable", "RevenueCat is still starting. Try again in a moment.");
      return false;
    }

    try {
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        offering: currentOffering ?? undefined,
        requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT_ID,
      });

      await refreshCustomerInfo();
      return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
    } catch (err) {
      const message = formatRevenueCatError(err);
      setError(message);
      Alert.alert("Paywall unavailable", message);
      return false;
    }
  }, [currentOffering, isConfigured, refreshCustomerInfo]);

  const openCustomerCenter = useCallback(async () => {
    if (!isConfigured) return;
    try {
      await RevenueCatUI.presentCustomerCenter({
        callbacks: {
          onRestoreCompleted: ({ customerInfo: nextCustomerInfo }) => syncCustomerInfo(nextCustomerInfo),
          onRestoreFailed: ({ error: restoreError }) => setError(formatRevenueCatError(restoreError)),
          onPromotionalOfferSucceeded: ({ customerInfo: nextCustomerInfo }) =>
            syncCustomerInfo(nextCustomerInfo),
        },
      });
      await refreshCustomerInfo();
    } catch (err) {
      const message = formatRevenueCatError(err);
      setError(message);
      Alert.alert("Customer Center unavailable", message);
    }
  }, [isConfigured, refreshCustomerInfo, syncCustomerInfo]);

  return useMemo(
    () => ({
      isConfigured,
      isLoading,
      isPurchasing,
      isPro: isProCustomer(customerInfo),
      customerInfo,
      currentOffering,
      monthlyPackage,
      yearlyPackage,
      error,
      refreshCustomerInfo,
      refreshOfferings,
      purchaseMonthly,
      purchaseYearly,
      restorePurchases,
      presentProPaywall,
      openCustomerCenter,
      isCustomerCenterSupported:
        isNativeMobile && Constants.executionEnvironment !== "storeClient",
    }),
    [
      isConfigured,
      isLoading,
      isPurchasing,
      customerInfo,
      currentOffering,
      monthlyPackage,
      yearlyPackage,
      error,
      refreshCustomerInfo,
      refreshOfferings,
      purchaseMonthly,
      purchaseYearly,
      restorePurchases,
      presentProPaywall,
      openCustomerCenter,
    ]
  );
});
