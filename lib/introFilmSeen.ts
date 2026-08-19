// Seen-once memory for the pre-signup intro films. A user who has already
// watched a role's film shouldn't sit through it on every pass of the
// funnel — choose-role checks this and routes straight to the onboarding
// slides instead. Storage failures fall back to "not seen" (worst case:
// the user sees a great film again).

import AsyncStorage from '@react-native-async-storage/async-storage';

type FilmRole = 'applicant' | 'sponsor';

const key = (role: FilmRole) => `intro_film_seen_${role}`;

export async function hasSeenIntroFilm(role: FilmRole): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(role))) === '1';
  } catch {
    return false;
  }
}

export function markIntroFilmSeen(role: FilmRole): void {
  AsyncStorage.setItem(key(role), '1').catch(() => {});
}
