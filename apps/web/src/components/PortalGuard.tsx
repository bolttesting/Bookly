import { Navigate, useLocation } from 'react-router-dom';

import { usePortalStore } from '../stores/portalStore';

type Props = {
  children: React.ReactElement;
};

export const PortalGuard = ({ children }: Props) => {
  const token = usePortalStore((state) => state.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/portal/login" state={{ from: location }} replace />;
  }

  return children;
};

