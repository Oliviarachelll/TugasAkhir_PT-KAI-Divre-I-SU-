import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { ShieldAlert, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/auth.store';

// Mock authentication logic (akan diganti dengan API)
const mockAuthenticate = async (email, password) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (email === 'admin@rache.id' && password === 'admin') {
        resolve({ token: 'mock-token-admin', user: { id: 1, nama: 'Admin Global', email, peran: 'ADMIN_GLOBAL' } });
      } else if (email === 'it@rache.id' && password === 'admin') {
        resolve({ token: 'mock-token-it', user: { id: 2, nama: 'IT Support', email, peran: 'IT' } });
      } else if (email === 'unit@rache.id' && password === 'admin') {
        resolve({ token: 'mock-token-unit', user: { id: 3, nama: 'User Unit 1', email, peran: 'USER_UNIT', unit: { id_unit: 1, nama_unit: 'DAOP 1' } } });
      } else if (email === 'terkunci@rache.id' && password === 'admin') {
        reject({ response: { status: 403, data: { message: 'Akun Terkunci. Silakan hubungi Helpdesk IT.' } } });
      } else {
        reject({ response: { status: 401, data: { message: 'Kredensial tidak valid' } } });
      }
    }, 1000);
  });
};

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  const navigate = useNavigate();
  const { setAuth, isAuthenticated, user } = useAuthStore();

  // Jika sudah login, redirect sesuai role
  if (isAuthenticated && user) {
    if (user.peran === 'IT') return <Navigate to="/dashboard/it" replace />;
    if (user.peran === 'ADMIN_GLOBAL') return <Navigate to="/dashboard/admin" replace />;
    return <Navigate to="/dashboard/unit" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLocked(false);
    
    if (!email || !password) {
      setErrorMsg('Email dan Password wajib diisi.');
      return;
    }

    setIsLoading(true);

    try {
      // TODO: Ganti dengan panggilan API asli
      // const response = await loginAPI({ email, password });
      const response = await mockAuthenticate(email, password);
      
      setAuth(response.user, response.token);
      toast.success('Login berhasil!');
      
      // Navigasi dilakukan oleh efek re-render karena state isAuthenticated berubah
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message || 'Terjadi kesalahan pada server';
      
      if (status === 403) {
        setIsLocked(true);
        setErrorMsg(message);
      } else {
        setErrorMsg(message);
      }
      toast.error('Gagal login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-split">
      {/* Sisi Kiri (Gelap) */}
      <div className="login-left">
        <div className="w-32 h-32 bg-gray-200/20 rounded-md flex items-center justify-center mb-6 text-gray-300" style={{ width: '120px', height: '120px', background: '#E5E7EB', color: '#9CA3AF', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Logo
        </div>
        <h1 className="text-3xl font-bold mb-2">Judul Aplikasi</h1>
        <h2 className="text-xl font-medium text-gray-300 mb-8">Sub-judul Sistem</h2>
        <p className="text-gray-400 text-sm">Nama Perusahaan</p>
        
        {/* Mockup kotak untuk dekorasi/ikon tambahan seperti di wireframe */}
        <div className="flex gap-4 mt-8" style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
          <div className="w-12 h-12 border border-gray-600 rounded"></div>
          <div className="w-10 h-10 border border-gray-600 rounded-full mt-1"></div>
          <div className="w-12 h-12 border border-gray-600 rounded"></div>
          <div className="w-8 h-8 border border-gray-600 rounded-full mt-2"></div>
        </div>
      </div>

      {/* Sisi Kanan (Terang/Form) */}
      <div className="login-right">
        <div className="login-form-container">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Judul Halaman</h2>
          <p className="text-gray-500 mb-8">Nama Perusahaan</p>

          <form onSubmit={handleLogin} className="space-y-6" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control"
                placeholder="Email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="Password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            
            <p className="text-sm text-gray-500">Lorem ipsum teks bantuan</p>

            {/* Error State */}
            {errorMsg && !isLocked && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md" style={{ padding: '16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px' }}>
                <p className="text-sm text-red-600">[Error state] {errorMsg}</p>
              </div>
            )}

            {/* Locked State */}
            {isLocked && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-md" style={{ padding: '16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px' }}>
                <div className="flex gap-3" style={{ display: 'flex', gap: '12px' }}>
                  <ShieldAlert className="text-amber-500 flex-shrink-0" size={20} />
                  <div>
                    <p className="text-sm text-amber-800 mb-3 font-medium">
                      [Locked state] {errorMsg}
                    </p>
                    <button 
                      type="button"
                      className="btn btn-secondary btn-sm bg-white"
                      onClick={() => navigate('/helpdesk')}
                    >
                      Bantuan IT
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                className="btn"
                disabled={isLoading}
                style={{ 
                  backgroundColor: '#D1D5DB', 
                  color: '#111827', 
                  border: '1px solid #9CA3AF',
                  padding: '8px 24px'
                }}
              >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Masuk'}
              </button>
            </div>
            
          </form>
          
          <div className="mt-16 text-center text-xs text-gray-400" style={{ marginTop: '64px', textAlign: 'center', fontSize: '12px', color: '#9CA3AF' }}>
            © {new Date().getFullYear()} Nama Perusahaan
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
