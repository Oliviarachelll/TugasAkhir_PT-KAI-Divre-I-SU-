import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Save, Loader2 } from 'lucide-react';
import useAuthStore from '../../store/auth.store';
import { targetApi } from '../../api/target.api';
import { unitApi } from '../../api/unit.api';
import { komoditiApi } from '../../api/komoditi.api';
import { programApi } from '../../api/program.api';
import { API_ERROR_TOAST_ID } from '../../api/client';
import { unitKategori } from '../../utils/unit';
import { formatNumber } from '../../utils/format';
import FormattedNumberInput from '../laporan/components/FormattedNumberInput';

const TargetPage = () => {
  const { user, isAuthenticated } = useAuthStore();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const isUnit = user?.peran === 'USER_UNIT';
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [nilai, setNilai] = useState('');
  const [targets, setTargets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Program tahunan per komoditi (khusus unit barang, diisi sekali setahun).
  const [komoditi, setKomoditi] = useState([]);
  const [progVals, setProgVals] = useState({});
  const [progLoading, setProgLoading] = useState(false);
  const [progSaving, setProgSaving] = useState(false);

  const myUnitId = user?.id_unit;
  const myUnitName = user?.unit?.nama_unit || '';

  // Unit yang dipakai form: unit sendiri (USER_UNIT) atau pilihan (ADMIN/IT).
  const formUnitId = isUnit ? myUnitId : (selectedUnit ? parseInt(selectedUnit) : '');
  const formUnitName = useMemo(() => {
    if (isUnit) return myUnitName;
    return units.find((u) => String(u.id_unit) === String(selectedUnit))?.nama_unit || '';
  }, [isUnit, myUnitName, units, selectedUnit]);
  const kategori = useMemo(() => unitKategori(formUnitName), [formUnitName]);

  const fetchUnits = async () => {
    if (isUnit) return;
    try {
      const res = await unitApi.getAll({ limit: 100 });
      setUnits(res.data || []);
    } catch {
      toast.error(t('manajemen.unit.fetch_fail'), { id: API_ERROR_TOAST_ID });
    }
  };

  const fetchTargets = async () => {
    // Jangan tembak API tanpa sesi login: request tanpa token pasti 401
    // dan interceptor global akan me-logout paksa pengguna.
    if (!isAuthenticated) return;
    setIsLoading(true);
    setFetchError('');
    try {
      const params = { tahun: year };
      if (!isUnit && selectedUnit) params.id_unit = selectedUnit;
      const res = await targetApi.getAll(params);
      setTargets(res.data || []);
    } catch (error) {
      const status = error?.response?.status;
      // 401 sudah ditangani interceptor global (toast + redirect login),
      // jadi tampilkan pesan inline yang mengarahkan user login ulang.
      setFetchError(status === 401 ? t('api.session_expired') : t('target.fetch_fail'));
      toast.error(t('target.fetch_fail'), { id: API_ERROR_TOAST_ID });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => { await fetchUnits(); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => { await fetchTargets(); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, selectedUnit, isAuthenticated]);

  const fetchProgram = async () => {
    if (!isAuthenticated || kategori !== 'BARANG' || !formUnitId) {
      setKomoditi([]);
      setProgVals({});
      return;
    }
    setProgLoading(true);
    try {
      const [komRes, progRes] = await Promise.all([
        komoditiApi.getAll({ id_unit: formUnitId }),
        programApi.getAll({ tahun: year }),
      ]);
      // Hanya komoditi tetap (kecualikan CUSTOM 98 & TOTAL 99).
      const tetap = (komRes.data || []).filter((k) => k.id_komoditi !== 98 && k.id_komoditi !== 99);
      setKomoditi(tetap);
      const map = {};
      (progRes.data || []).forEach((p) => {
        map[p.id_komoditi] = {
          volume_program: p.volume_program ?? '',
          pendapatan_program: p.pendapatan_program ?? '',
        };
      });
      setProgVals(map);
    } catch {
      toast.error(t('target.fetch_fail'), { id: API_ERROR_TOAST_ID });
    } finally {
      setProgLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => { await fetchProgram(); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, selectedUnit, isAuthenticated, kategori, formUnitId]);

  const handleSaveProgram = async () => {
    if (!year || !formUnitId || komoditi.length === 0) {
      toast.error(t('target.need_value'));
      return;
    }
    setProgSaving(true);
    try {
      const items = komoditi.map((k) => ({
        id_komoditi: k.id_komoditi,
        volume_program: progVals[k.id_komoditi]?.volume_program === '' ? null : Number(progVals[k.id_komoditi]?.volume_program ?? null),
        pendapatan_program: progVals[k.id_komoditi]?.pendapatan_program === '' ? null : Number(progVals[k.id_komoditi]?.pendapatan_program ?? null),
      }));
      await programApi.save({ tahun: parseInt(year), items });
      toast.success(t('target.update_success'));
      fetchProgram();
    } catch (error) {
      toast.error(error?.response?.data?.message || t('target.save_fail'), { id: API_ERROR_TOAST_ID });
    } finally {
      setProgSaving(false);
    }
  };

  const progTotalVol = komoditi.reduce((s, k) => s + (Number(progVals[k.id_komoditi]?.volume_program) || 0), 0);
  const progTotalPdt = komoditi.reduce((s, k) => s + (Number(progVals[k.id_komoditi]?.pendapatan_program) || 0), 0);

  const handleSave = async () => {
    if (!year || !formUnitId || nilai === '' || nilai === null) {
      toast.error(t('target.need_value'));
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        tahun: parseInt(year),
        kategori,
        nilai: Number(nilai),
        id_unit: parseInt(formUnitId),
      };
      const existing = targets.find(
        (item) =>
          Number(item.tahun) === payload.tahun &&
          item.kategori === payload.kategori &&
          Number(item.id_unit) === payload.id_unit
      );
      if (existing) {
        await targetApi.update(existing.id_target, payload);
        toast.success(t('target.update_success'));
      } else {
        await targetApi.create(payload);
        toast.success(t('target.create_success'));
      }
      setNilai('');
      fetchTargets();
    } catch (error) {
      toast.error(error?.response?.data?.message || t('target.save_fail'), { id: API_ERROR_TOAST_ID });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">
            {t('router.my_target')} <span className="mx-1">&gt;</span> <span className="text-primary">{t('target.title')}</span>
          </div>
          <p className="page-subtitle">{t('target.subtitle')}</p>
        </div>
      </div>

      <div className="card mb-4" style={{ padding: '24px', marginBottom: '24px' }}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <div className="form-group mb-0">
            <label className="form-label">{t('target.year')}</label>
            <input
              type="number"
              className="form-control"
              min="2000"
              max="2100"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>
          <div className="form-group mb-0">
            <label className="form-label">{t('target.unit')}</label>
            {isUnit ? (
              <input type="text" className="form-control bg-card-2 text-muted" value={myUnitName} disabled />
            ) : (
              <select className="form-control" value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)}>
                <option value="">{t('target.all_units')}</option>
                {units.map((u) => (
                  <option key={u.id_unit} value={u.id_unit}>{u.nama_unit}</option>
                ))}
              </select>
            )}
          </div>
          <div className="form-group mb-0">
            <label className="form-label">{t('target.category')}</label>
            <input type="text" className="form-control bg-card-2 text-muted" value={kategori} disabled />
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{t('target.category_auto')}</p>
          </div>
          <div className="form-group mb-0">
            <label className="form-label">{t('target.value')}</label>
            <FormattedNumberInput className="form-control" placeholder="0" value={nilai} onChange={(val) => setNilai(val)} />
          </div>
        </div>
        <div className="mt-4">
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || !formUnitId}>
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {isSaving ? t('target.saving') : t('target.save')}
          </button>
        </div>
      </div>

      {kategori === 'BARANG' && !!formUnitId && (
        <div className="card mb-4" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ padding: '0 0 16px 0' }}>
            <h3 className="font-bold text-lg m-0">{t('target.program_title')}</h3>
            <p className="page-subtitle" style={{ marginTop: '4px' }}>{t('target.program_sub')}</p>
          </div>
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>{t('target.program_komoditi')}</th>
                  <th style={{ textAlign: 'right' }}>{t('target.program_vol')}</th>
                  <th style={{ textAlign: 'right' }}>{t('target.program_pend')}</th>
                </tr>
              </thead>
              <tbody>
                {progLoading ? (
                  <tr><td colSpan="3" className="text-center p-4">{t('target.loading')}</td></tr>
                ) : komoditi.length === 0 ? (
                  <tr><td colSpan="3" className="text-center p-4 text-muted">{t('target.empty')}</td></tr>
                ) : (
                  <>
                    {komoditi.map((k) => (
                      <tr key={k.id_komoditi}>
                        <td className="font-medium">{k.nama_komoditi}</td>
                        <td style={{ textAlign: 'right' }}>
                          <FormattedNumberInput
                            className="form-control"
                            placeholder="0"
                            value={progVals[k.id_komoditi]?.volume_program ?? ''}
                            onChange={(val) => setProgVals((prev) => ({ ...prev, [k.id_komoditi]: { ...prev[k.id_komoditi], volume_program: val } }))}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <FormattedNumberInput
                            className="form-control"
                            placeholder="0"
                            value={progVals[k.id_komoditi]?.pendapatan_program ?? ''}
                            onChange={(val) => setProgVals((prev) => ({ ...prev, [k.id_komoditi]: { ...prev[k.id_komoditi], pendapatan_program: val } }))}
                          />
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="font-bold">{t('target.program_total')}</td>
                      <td style={{ textAlign: 'right' }} className="font-bold">{formatNumber(progTotalVol, lang)}</td>
                      <td style={{ textAlign: 'right' }} className="font-bold">{formatNumber(progTotalPdt, lang)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <button className="btn btn-primary" onClick={handleSaveProgram} disabled={progSaving || progLoading || komoditi.length === 0}>
              {progSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {progSaving ? t('target.saving') : t('target.save')}
            </button>
          </div>
        </div>
      )}

      <div className="card p-0" style={{ padding: 0 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h3 className="font-bold text-lg m-0">{t('target.list_title')}</h3>
        </div>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>{t('target.th_year')}</th>
                <th>{t('target.th_category')}</th>
                <th>{t('target.th_unit')}</th>
                <th style={{ textAlign: 'right' }}>{t('target.th_value')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="4" className="text-center p-4">{t('target.loading')}</td></tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan="4" className="text-center p-4">
                    <div className="mb-2" style={{ color: 'var(--danger)' }}>{fetchError}</div>
                    <button className="btn btn-secondary btn-sm" onClick={fetchTargets}>{t('target.retry')}</button>
                  </td>
                </tr>
              ) : targets.length === 0 ? (
                <tr><td colSpan="4" className="text-center p-4 text-muted">{t('target.empty')}</td></tr>
              ) : (
                targets.map((item) => (
                  <tr key={item.id_target}>
                    <td>{item.tahun}</td>
                    <td>{item.kategori}</td>
                    <td>{item.unit?.nama_unit || '-'}</td>
                    <td style={{ textAlign: 'right' }}>{formatNumber(item.nilai, lang)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TargetPage;
