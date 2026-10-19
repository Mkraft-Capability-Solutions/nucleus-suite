import NotFoundView from '@/components/NotFoundView';

export const metadata = {
  title: '404 - Page Not Found | Nucleus One HRMS',
  description: 'The requested page or resource could not be found.',
};

export default function NotFoundPage() {
  return <NotFoundView />;
}
