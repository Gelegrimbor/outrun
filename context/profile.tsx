import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import { useSession } from '@/context/ctx';
import { fetchProfile, createProfile, type Profile, type ProfileInput } from '@/lib/profiles';

interface ProfileContextValue {
  profile: Profile | null;
  isLoading: boolean;
  completeOnboarding: (input: ProfileInput) => Promise<{ error: string | null }>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return ctx;
}

export function ProfileProvider({ children }: PropsWithChildren) {
  const { user } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetchProfile(user.id)
      .then((result) => {
        if (!cancelled) setProfile(result);
      })
      .catch((err) => {
        console.warn('Failed to load profile:', err);
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const completeOnboarding = async (input: ProfileInput): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not signed in.' };
    try {
      const created = await createProfile(user.id, input);
      setProfile(created);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to save profile.' };
    }
  };

  return (
    <ProfileContext.Provider value={{ profile, isLoading, completeOnboarding }}>
      {children}
    </ProfileContext.Provider>
  );
}
