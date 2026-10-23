import { ComposerPanel, SheetHost } from '@/features/input-sheet/sheet-host';
import { InputSheetProvider } from '@/features/input-sheet/sheet-provider';
import { getMyCategories, getMyProfile } from '@/lib/queries/profile';
import { Trail } from '@/features/locker/trail';
import { getMyTrail, groupByDay } from '@/lib/queries/trail';
import { createClient } from '@/lib/supabase/server';
import { todayIn } from '@/lib/time';

/**
 * The shell: the page and the composer — a bottom sheet from the drop bar
 * on a phone, a standing card in the right half on a wide screen (review).
 * No tab bar since H22: Home's menu reaches the Locker, and the drop bar is
 * the way in. Each page lays out its own column, because Home's ground is
 * full-bleed and the white pages are not. The composer needs the lanes
 * only: sessions are date-based, so it has no session field.
 */
export default async function ShellLayout({ children }: LayoutProps<'/'>) {
  const supabase = await createClient();
  const profile = await getMyProfile(supabase);

  // A page without a profile redirects to sign-in on its own, so the shell
  // just renders around it.
  const context = profile
    ? {
        categories: await getMyCategories(supabase),
        timeZone: profile.timezone,
        today: todayIn(profile.timezone),
      }
    : null;
  // The Locker's Trail under the wide screen's composer: a wide screen has
  // no Locker tab, the archive reads beside the writing.
  const trail = profile ? (
    <Trail
      days={groupByDay(await getMyTrail(supabase, profile.id, profile.timezone), profile.timezone)}
      timeZone={profile.timezone}
      origin="month"
    />
  ) : null;

  return (
    <InputSheetProvider>
      <div className="flex min-h-dvh flex-col">
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
          {context ? <ComposerPanel context={context} trail={trail} /> : null}
        </div>
      </div>
      {context ? <SheetHost context={context} /> : null}
    </InputSheetProvider>
  );
}
