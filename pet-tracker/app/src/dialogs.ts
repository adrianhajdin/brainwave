import { Alert, Platform } from 'react-native';

/**
 * Asks before something important: an explanation before a system permission
 * prompt, or a destructive action. Resolves true only when the user confirms.
 */
export function ask(title: string, message: string, yes: string, destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: yes, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));
