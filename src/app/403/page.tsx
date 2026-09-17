import ForbiddenView from '@/components/ForbiddenView';

export const metadata = {
  title: '403 - Access Denied | Nucleus One HRMS',
  description: 'Access Denied - You do not have permission to access this resource.',
};

export default function ForbiddenPage() {
  return <ForbiddenView />;
}
