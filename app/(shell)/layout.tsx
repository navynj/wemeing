import { SheetHost } from '@/features/input-sheet/sheet-host';
import { InputSheetProvider } from '@/features/input-sheet/sheet-provider';
import { getMyCategories, getMyProfile } from '@/lib/queries/profile';
import { createClient } from '@/lib/supabase/server';
import { todayIn } from '@/lib/time';

/**
 * The shell: the page and the composer, a bottom sheet from the compose
 * disc at every width (review: the wide screen's standing composer
 * retired; its right half is the board's). Each page lays out its own
 * column, because Home's ground is full-bleed and the white pages are not.
 * The composer needs the lanes only: sessions are date-based, so it has no
 * session field.
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
  return (
    <InputSheetProvider>
      <div className="flex min-h-dvh flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
      {context ? <SheetHost context={context} /> : null}
    </InputSheetProvider>
  );
}
