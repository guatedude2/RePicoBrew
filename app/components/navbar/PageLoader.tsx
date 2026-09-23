import { useNavigation, useRevalidator } from 'react-router';

// Thin indeterminate bar pinned to the bottom edge of the Topbar, shown while a navigation or a
// data revalidation is in flight so slow pages (the Pi is not fast) never look frozen.
export const PageLoader = () => {
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const active = navigation.state !== 'idle' || revalidator.state !== 'idle';

  return (
    <div
      role="progressbar"
      aria-hidden={!active}
      aria-label="Loading page"
      className={`pointer-events-none absolute inset-x-0 -bottom-px h-[2px] overflow-hidden transition-opacity duration-200 ${
        active ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="page-loader-bar h-full w-2/5 rounded-full bg-brand-500" />
    </div>
  );
};
