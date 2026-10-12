import { Stack } from 'expo-router';

import { useAuth } from '@/lib/auth/auth-context';

/** A signed-out member lands on Benvenuto first; sign-in and sign-up are pushed from there. */
export const unstable_settings = { initialRouteName: 'welcome' };

export default function AuthLayout() {
  const auth = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={auth.status === 'signedOut'}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
      </Stack.Protected>
      <Stack.Protected guard={auth.status === 'noProfile'}>
        <Stack.Screen name="complete-profile" />
      </Stack.Protected>
      <Stack.Protected guard={auth.status === 'pending'}>
        <Stack.Screen name="pending" />
      </Stack.Protected>
      <Stack.Protected guard={auth.status === 'rejected'}>
        <Stack.Screen name="rejected" />
      </Stack.Protected>
    </Stack>
  );
}
