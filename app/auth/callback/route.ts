import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { bootstrapProfile } from '@/features/auth/bootstrap-profile';
import { safeNext } from '@/lib/next-path';
import { NEXT_COOKIE, siteUrl, TIMEZONE_COOKIE } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code');
  const home = siteUrl();

  if (!code) {
    return NextResponse.redirect(`${home}/sign-in?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${home}/sign-in?error=exchange_failed`);
  }

  const cookieStore = await cookies();
  const timezone = cookieStore.get(TIMEZONE_COOKIE)?.value;

  const { user } = data;
  // Idempotent: an account can reach here with a session but no profile if an
  // earlier attempt died after the exchange, and this is where it recovers.
  await bootstrapProfile(supabase, {
    userId: user.id,
    displayName:
      user.user_metadata.full_name ?? user.user_metadata.name ?? user.email?.split('@')[0] ?? 'You',
    avatarUrl: user.user_metadata.avatar_url ?? null,
    timezone: timezone ? decodeURIComponent(timezone) : 'UTC',
  });

  const next = cookieStore.get(NEXT_COOKIE)?.value;
  const response = NextResponse.redirect(
    `${home}${safeNext(next ? decodeURIComponent(next) : null)}`,
  );
  response.cookies.delete(TIMEZONE_COOKIE);
  response.cookies.delete(NEXT_COOKIE);
  return response;
}
