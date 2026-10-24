import { PoolScreen } from '@/features/pool/pool-screen';
import { PoolSplash } from '@/features/pool/pool-splash';
import { SplashModal } from '@/features/splash/splash-modal';

/**
 * A pool's splash, visited directly: its sheet over that pool, with the post
 * on top of the stack; closing it leaves the pool. From inside the app the
 * same URL opens as a sheet over the current screen (@modal/(.)pool).
 */
export default async function PoolSplashRoute({ params }: PageProps<'/pool/[id]/splash/[sid]'>) {
  const { id, sid } = await params;
  return (
    <>
      <PoolScreen id={id} top={sid} />
      <SplashModal closeTo={`/pool/${id}?top=${sid}`}>
        <PoolSplash id={id} sid={sid} />
      </SplashModal>
    </>
  );
}
