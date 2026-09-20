import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Building2 } from 'lucide-react';
import ManajemenUser from '../manajemen/ManajemenUser';
import ManajemenUnit from '../manajemen/ManajemenUnit';

const MonitoringPage = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('user');

  const tabs = [
    { id: 'user', label: t('menu.manajemen_user'), icon: Users },
    { id: 'unit', label: t('menu.manajemen_unit'), icon: Building2 },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', overflowX: 'auto' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '8px',
                backgroundColor: isActive ? 'var(--brand-50)' : 'transparent',
                color: isActive ? 'var(--brand-600)' : 'var(--text-muted)',
                fontWeight: isActive ? '600' : '500',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'user' ? <ManajemenUser /> : <ManajemenUnit />}
    </div>
  );
};

export default MonitoringPage;
