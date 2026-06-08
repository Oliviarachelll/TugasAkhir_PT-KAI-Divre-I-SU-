import React, { useState } from 'react';
import useAuthStore from '../../store/auth.store';

const SettingsPage = () => {
  const { user } = useAuthStore();
  const [activeMenu, setActiveMenu] = useState('profil');

  const menuItems = [
    { id: 'profil', label: 'Profil Pribadi' },
    { id: 'keamanan', label: 'Keamanan & Password' },
    { id: 'notifikasi', label: 'Notifikasi' },
    { id: 'tampilan', label: 'Tampilan' },
  ];

  return (
    <div className="flex flex-col gap-6" style={{ padding: '0' }}>
      
      {/* Container Settings (Grid 2 Kolom) */}
      <div className="grid grid-cols-[250px_1fr] gap-6 items-start">
        
        {/* Kiri: Sidebar Menu Settings */}
        <div className="card" style={{ padding: '0', borderRadius: '4px', overflow: 'hidden' }}>
          <div className="flex flex-col">
            {menuItems.map(item => (
              <button 
                key={item.id}
                onClick={() => setActiveMenu(item.id)}
                className={`text-left px-4 py-3 text-sm font-medium border-l-4 transition-colors ${
                  activeMenu === item.id 
                    ? 'border-gray-800 bg-gray-100 text-gray-900' 
                    : 'border-transparent text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Kanan: Konten Settings */}
        <div className="card" style={{ padding: '24px', borderRadius: '4px' }}>
          
          {activeMenu === 'profil' && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-6">Profil Pribadi</h3>
              
              <div className="flex items-center gap-6 mb-8">
                <div className="w-20 h-20 rounded-full bg-gray-200 border border-gray-400 flex items-center justify-center text-xl font-bold text-gray-600">
                  {user?.nama?.substring(0, 2).toUpperCase() || 'NA'}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-lg mb-1">{user?.nama || 'Nama Lengkap'}</h4>
                  <p className="text-sm text-gray-500 mb-3">{user?.peran} {user?.unit?.nama_unit && `• ${user.unit.nama_unit}`}</p>
                  <button className="px-3 py-1.5 border border-gray-400 text-sm font-medium hover:bg-gray-50">
                    Ganti Foto
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-gray-700">Nama Lengkap</label>
                  <input 
                    type="text" 
                    className="p-2 border border-gray-300 rounded focus:outline-none focus:border-gray-500 text-sm"
                    defaultValue={user?.nama} 
                  />
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-gray-700">Email</label>
                  <input 
                    type="email" 
                    className="p-2 border border-gray-300 rounded bg-gray-50 text-gray-500 text-sm"
                    defaultValue={user?.email} 
                    disabled 
                  />
                  <span className="text-xs text-gray-400">Email tidak dapat diubah.</span>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-gray-700">Nomor Telepon</label>
                  <input 
                    type="text" 
                    className="p-2 border border-gray-300 rounded focus:outline-none focus:border-gray-500 text-sm"
                    defaultValue="+62" 
                  />
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-gray-200">
                <button className="px-4 py-2 bg-gray-800 text-white font-medium text-sm rounded-sm hover:bg-gray-900">
                  Simpan Perubahan
                </button>
              </div>
            </div>
          )}

          {activeMenu === 'keamanan' && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-6">Keamanan & Password</h3>
              <p className="text-sm text-gray-500">Fitur sedang dalam pengembangan.</p>
            </div>
          )}

          {activeMenu === 'notifikasi' && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-6">Pengaturan Notifikasi</h3>
              <p className="text-sm text-gray-500">Fitur sedang dalam pengembangan.</p>
            </div>
          )}

          {activeMenu === 'tampilan' && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-6">Pengaturan Tampilan</h3>
              <p className="text-sm text-gray-500">Tema dan preferensi tampilan.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
