import RootLayout from './(suite)/layout';
import NotFoundView from '@/components/NotFoundView';

export const metadata = {
  title: '404 - Page Not Found | Nucleus One HRMS',
  description: 'The requested page or resource could not be found.',
};

/** Unmatched URLs: the app has two root layouts ((landing) and (suite)), so the 404 renders inside the suite shell. */
export default function GlobalNotFound() {
  return (
    <RootLayout>
      <NotFoundView />
    </RootLayout>
  );
}
