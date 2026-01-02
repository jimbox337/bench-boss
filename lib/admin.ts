/**
 * Check if a user is an admin
 */
export function isAdmin(username?: string | null): boolean {
  if (!username) return false;

  const adminUsernames = process.env.ADMIN_USERNAMES?.split(',').map(u => u.trim().toLowerCase()) || [];
  return adminUsernames.includes(username.toLowerCase());
}
