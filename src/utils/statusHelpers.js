// Status badge styling
export const STATUS_BADGE_MAP = {
  open: 'badge-green',
  active: 'badge-blue',
  completed: 'badge-muted',
  archived: 'badge-muted',
  expired: 'badge-muted',
};

export const CATEGORY_BADGE_MAP = {
  Cleaning: 'green',
  Tutoring: 'blue',
  Beauty: 'gold',
  'Moving help': 'muted',
  'Simple repairs': 'muted',
};

export function getBadgeType(status) {
  return STATUS_BADGE_MAP[status] || 'badge-muted';
}

export function getCategoryBadgeType(category) {
  return CATEGORY_BADGE_MAP[category] || 'muted';
}

export const CATEGORIES = ['Cleaning', 'Tutoring', 'Beauty', 'Moving help', 'Simple repairs'];
export const BETA_MARKETS = ['Cairo', 'Giza'];
export const EGYPT_MARKETS = [
  'Cairo',
  'Giza',
  'Alexandria',
  'Qalyubia',
  'Sharqia',
  'Dakahlia',
  'Gharbia',
  'Menoufia',
  'Beheira',
  'Kafr El Sheikh',
  'Damietta',
  'Port Said',
  'Ismailia',
  'Suez',
  'Fayoum',
  'Beni Suef',
  'Minya',
  'Assiut',
  'Sohag',
  'Qena',
  'Luxor',
  'Aswan',
  'Red Sea',
  'New Valley',
  'Matrouh',
  'North Sinai',
  'South Sinai',
];

export const DISTRICTS = BETA_MARKETS;

const LEGACY_MENOUFIA_MARKETS = new Set([
  'tala',
  'shibin el kom',
  'shebin',
  'menouf',
  'ashmoun',
  'quesna',
]);

export function normalizeEgyptMarket(value, fallback = 'Egypt') {
  if (!value) return fallback;
  const normalized = String(value).trim();
  if (!normalized) return fallback;
  if (LEGACY_MENOUFIA_MARKETS.has(normalized.toLowerCase())) return 'Menoufia';
  return normalized;
}

export function matchesEgyptMarket(value, filter) {
  if (!filter || filter === 'all') return true;
  const filterLower = String(filter).toLowerCase();
  const rawLower = String(value || '').toLowerCase();
  return rawLower === filterLower || normalizeEgyptMarket(value, '').toLowerCase() === filterLower;
}

export function formatCurrency(amount) {
  return `${Number(amount).toLocaleString()} EGP`;
}

export function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString();
}

export function isProposalExpired(bid) {
  if (!bid) return false;
  if (bid.status === 'expired') return true;
  if (bid.status !== 'pending') return false;
  if (!bid.expires_at) return false;
  return new Date(bid.expires_at).getTime() <= Date.now();
}

export function proposalWindowLabel(bid) {
  if (!bid?.expires_at) return '24h response window';
  if (isProposalExpired(bid)) return 'Expired';

  const remainingMs = new Date(bid.expires_at).getTime() - Date.now();
  const remainingHours = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));

  if (remainingHours >= 24) return '24h response window';
  if (remainingHours === 1) return '1h left';
  return `${remainingHours}h left`;
}

export function getInitials(name) {
  return name
    ?.split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

export function getSpecialistColor(name) {
  const colors = [
    ['var(--blue-dim)', 'var(--blue)'],
    ['var(--green-dim)', 'var(--green)'],
    ['var(--gold-dim)', 'var(--gold)'],
    ['var(--red-dim)', 'var(--red)'],
  ];
  const hue = (name?.charCodeAt(0) ?? 0) % 4;
  return colors[hue];
}
