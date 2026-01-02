import { User } from './users';

/**
 * Check if a user is an admin based on their role
 */
export function isAdmin(user?: User | null): boolean {
  if (!user) return false;
  return user.role === 'admin';
}
