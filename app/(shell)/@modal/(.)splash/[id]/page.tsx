import { HomeSplash } from '@/features/splash/home-splash';
import { SplashModal } from '@/features/splash/splash-modal';

/** A splash opened from inside the app: its sheet over the current screen; back closes it (review). */
export default async function SplashSheet({ params }: PageProps<'/splash/[id]'>) {
  const { id } = await params;
  return (
    <SplashModal closeTo={null}>
      <HomeSplash id={id} />
    </SplashModal>
  );
}
