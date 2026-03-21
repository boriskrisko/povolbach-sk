import { cookies } from 'next/headers';

export async function checkAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('dashboard_session');
  return session?.value === 'authenticated';
}
