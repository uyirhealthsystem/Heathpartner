export function createReferralCode() {
  const value = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `HP${value}`;
}
