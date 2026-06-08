import React from 'react';
import useAuthStore from '../../store/auth.store';
import HelpdeskUser from './HelpdeskUser';
import HelpdeskIT from './HelpdeskIT';

const HelpdeskPage = () => {
  const { user } = useAuthStore();

  if (user?.peran === 'USER_UNIT') {
    return <HelpdeskUser />;
  }

  // IT dan ADMIN_GLOBAL melihat view IT (untuk menghandle tiket)
  return <HelpdeskIT />;
};

export default HelpdeskPage;
