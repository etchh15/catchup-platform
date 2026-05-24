import { supabase } from '../supabaseClient';

const SPECIALIST_FIELDS =
  'id, full_name, email, role, is_verified, hourly_rate, job_title, professional_title, bio, district_tag, portfolio_images';

/** Profile name exactly as set in Profile → Full Name (no job-title fallbacks). */
export const getProfileDisplayName = (profile) => {
  const name = profile?.full_name?.trim();
  return name || null;
};

export const getSpecialistAvatarUrl = (profile) => {
  const images = profile?.portfolio_images;
  if (Array.isArray(images) && images.length > 0 && images[0]) return images[0];
  return profile?.avatarUrl ?? null;
};

export const getInitialsFromName = (name) => {
  if (!name?.trim()) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

export const mapDbRowToUiProfile = (row) => {
  if (!row) {
    return { fullName: '', specialty: '', portfolio: [], avatarUrl: null };
  }
  const portfolio = Array.isArray(row.portfolio_images) ? row.portfolio_images : [];
  return {
    fullName: row.full_name ?? '',
    specialty: row.professional_title ?? row.job_title ?? '',
    portfolio,
    avatarUrl: portfolio[0] ?? null,
  };
};

export const mapSpecialistRow = (row) => {
  const profileName = getProfileDisplayName(row);
  const avatarUrl = getSpecialistAvatarUrl(row);
  return {
    ...row,
    profileName,
    avatarUrl,
    specialtyLine: row.professional_title?.trim() || row.job_title?.trim() || null,
  };
};

export async function fetchRegisteredSpecialists() {
  const { data, error } = await supabase
    .from('profiles')
    .select(SPECIALIST_FIELDS)
    .eq('role', 'specialist')
    .order('full_name', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('Failed to load registered specialists:', error);
    throw error;
  }

  return (data ?? []).map(mapSpecialistRow);
}

export async function fetchProfileById(profileId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle();

  if (error) throw error;
  return mapDbRowToUiProfile(data);
}

export async function saveUserProfile({
  id,
  fullName,
  specialty,
  portfolio = [],
  email,
  role = 'specialist',
}) {
  const portfolio_images = Array.isArray(portfolio) ? portfolio : [];
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id,
        full_name: fullName?.trim() || null,
        professional_title: specialty?.trim() || null,
        portfolio_images,
        email: email ?? undefined,
        role,
        is_verified: true,
      },
      { onConflict: 'id' }
    )
    .select()
    .single();

  return { data, error };
}

export function subscribeToSpecialistProfiles(onChange) {
  const channel = supabase
    .channel('profiles-specialists')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: 'role=eq.specialist',
      },
      () => onChange()
    )
    .subscribe();

  return () => {
    console.log('🔌 Scaling protection: Dissolving channel profiles-specialists');
    supabase.removeChannel(channel);
  };
}
