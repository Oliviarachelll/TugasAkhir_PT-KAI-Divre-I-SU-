import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const SettingsPage = () => {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState(localStorage.getItem('app-theme') || 'Terang');

  useEffect(() => {
    if (mode === 'Gelap') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('app-theme', mode);
  }, [mode]);

  const toggleMode = () => {
    setMode(prev => prev === 'Terang' ? 'Gelap' : 'Terang');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">{t('menu.settings')} <span className="mx-1">&gt;</span> <span className="text-primary">{t('menu.settings')}</span></div>
        </div>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-lg font-bold">{t('settings.title')}</h3>
        </div>

        {/* Bahasa */}
        <div className="flex justify-between items-center" style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h4 className="font-bold text-base mb-1">{t('settings.lang_title')}</h4>
            <p className="text-sm text-muted">{t('settings.lang_desc')}</p>
          </div>
          <div>
            <select 
              className="form-control" 
              style={{ width: '200px', cursor: 'pointer' }}
              value={i18n.language === 'en' ? 'English' : 'Bahasa Indonesia'}
              onChange={(e) => {
                const newLang = e.target.value === 'English' ? 'en' : 'id';
                i18n.changeLanguage(newLang);
              }}
            >
              <option value="Bahasa Indonesia">Bahasa Indonesia</option>
              <option value="English">English</option>
            </select>
          </div>
        </div>

        {/* Mode Tampilan */}
        <div className="flex justify-between items-center" style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h4 className="font-bold text-base mb-1">{t('settings.mode_title')}</h4>
            <p className="text-sm text-muted">{t('settings.mode_desc')}</p>
          </div>
          <div 
            onClick={toggleMode}
            style={{
              width: '56px',
              height: '32px',
              borderRadius: '16px',
              backgroundColor: mode === 'Gelap' ? 'var(--brand-500)' : '#E5E7EB',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background-color 0.3s ease'
            }}
          >
            <div 
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                position: 'absolute',
                top: '4px',
                left: mode === 'Gelap' ? '28px' : '4px',
                transition: 'left 0.3s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3" style={{ padding: '24px' }}>
          <button className="btn btn-secondary" style={{ backgroundColor: '#e2e8f0', color: '#1e293b', border: '1px solid #cbd5e1' }}>{t('settings.save')}</button>
          <button className="btn btn-secondary" style={{ backgroundColor: 'transparent', border: '1px solid var(--border)' }}>{t('settings.reset')}</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
