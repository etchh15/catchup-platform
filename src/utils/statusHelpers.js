// Status badge styling
export const STATUS_BADGE_MAP = {
  open: 'badge-green',
  active: 'badge-blue',
  completed: 'badge-muted',
  archived: 'badge-muted',
  expired: 'badge-muted',
};

export const CATEGORY_BADGE_MAP = {
  Mechanic: 'gold',
  Tutor: 'blue',
  Cleaning: 'green',
  Electrician: 'muted',
  Plumber: 'muted',
  Painter: 'muted',
};

export function getBadgeType(status) {
  return STATUS_BADGE_MAP[status] || 'badge-muted';
}

export function getCategoryBadgeType(category) {
  return CATEGORY_BADGE_MAP[category] || 'muted';
}

export const CATEGORIES = ['Mechanic', 'Cleaning', 'Electrician', 'Tutor', 'Plumber', 'Painter'];
export const DISTRICTS = ['Tala', 'Shibin El Kom', 'Menouf', 'Ashmoun', 'Quesna'];

export function formatCurrency(amount) {
  return `${Number(amount).toLocaleString()} EGP`;
}

export function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString();
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
