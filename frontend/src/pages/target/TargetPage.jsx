import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Save, Loader2 } from 'lucide-react';
import useAuthStore from '../../store/auth.store';
import { targetApi } from '../../api/target.api';
import { unitApi } from '../../api/unit.api';
import { API_ERROR_TOAST_ID } from '../../api/client';
import { unitKategori } from '../../utils/unit';
import { formatNumber } from '../../utils/format';
import FormattedNumberInput from '../laporan/components/FormattedNumberInput';

const TargetPage = () => {
  const { user } = useAuthStore();
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
    setIsLoading(true);
    try {
      const params = { tahun: year };
      if (!isUnit && selectedUnit) params.id_unit = selectedUnit;
      const res = await targetApi.getAll(params);
      setTargets(res.data || []);
    } catch {
      toast.error(t('target.fetch_fail'), { id: API_ERROR_TOAST_ID });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => { await fetchUnits(); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => { await fetchTargets(); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, selectedUnit]);

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
