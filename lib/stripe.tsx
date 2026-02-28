// lib/stripe.tsx
import { usePaymentSheet } from '@stripe/stripe-react-native';

// BUG 4 FIX: Map to usePaymentSheet instead of useStripe so initPaymentSheet works
export const useStripePayment = usePaymentSheet;

// BUGS 1 & 13 FIX: We deleted the confusing MockStripeProvider. 
// Your app/_layout.tsx is already handling the real StripeProvider safely!