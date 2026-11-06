import { redirect } from 'next/navigation';

// Custom leagues were replaced by test mode; keep old links working.
export default function CustomTeamRedirect() {
  redirect('/teams/test');
}
