import * as SecureStore from 'expo-secure-store';

const REMEMBER_ME_KEY = 'outrun-remember-me';

/** Defaults to true (remembered) until the user explicitly opts out. */
export async function getRememberMePreference(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(REMEMBER_ME_KEY);
  return value !== '0';
}

export async function setRememberMePreference(remember: boolean): Promise<void> {
  await SecureStore.setItemAsync(REMEMBER_ME_KEY, remember ? '1' : '0');
}
