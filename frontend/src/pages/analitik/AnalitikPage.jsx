import React from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Filter, TrendingUp } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';

const dummyDataBar = [
  { name: 'Jan', realisasi: 4000, target: 4500 },
  { name: 'Feb', realisasi: 3000, target: 4000 },
  { name: 'Mar', realisasi: 5000, target: 4800 },
  { name: 'Apr', realisasi: 4500, target: 5000 },
  { name: 'May', realisasi: 6000, target: 5500 },
  { name: 'Jun', realisasi: 5500, target: 6000 },
];

const dummyDataPie = [
  { name: 'DAOP 1', value: 400 },
  { name: 'DAOP 2', value: 300 },
  { name: 'DAOP 3', value: 300 },
  { name: 'DAOP 4', value: 200 },
];
const COLORS = ['var(--chart-bar-primary)', 'var(--chart-bar-highlight)', 'var(--success)', 'var(--danger)'];

const AnalitikPage = () => {
  const { t } = useTranslation();
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="text-sm text-muted font-medium mb-1">{t('analitik.breadcrumb').split('&')[0].trim()} <span className="mx-1">&gt;</span> <span className="text-primary">{t('analitik.breadcrumb')}</span></div>
          <p className="page-subtitle">{t('analitik.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary">
            <Filter size={18} /> {t('analitik.filter')}
          </button>
          <button className="btn btn-primary">
            <Download size={18} /> {t('analitik.export')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '24px' }}>
        
        {/* Bar Chart Realisasi vs Target */}
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="section-title" style={{ marginBottom: '4px' }}>{t('analitik.trend_title')}</h3>
              <p className="text-sm text-muted">{t('analitik.trend_sub')}</p>
            </div>
          </div>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <BarChart data={dummyDataBar}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--chart-axis)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--chart-axis)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--chart-card)', borderColor: 'var(--border)', borderRadius: '8px', boxShadow: 'var(--shadow-sm)' }}
                  itemStyle={{ color: 'var(--text-primary)', fontWeight: '500' }}
                  cursor={{ fill: 'var(--chart-grid)' }}
                />
                <Bar dataKey="realisasi" name={t('analitik.realization')} fill="var(--chart-bar-primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target" name={t('analitik.target')} fill="var(--bg-card-2)" stroke="var(--border)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Area Chart Pertumbuhan */}
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="section-title" style={{ marginBottom: '4px' }}>{t('analitik.growth_title')}</h3>
              <p className="text-sm text-muted">{t('analitik.growth_sub')}</p>
            </div>
            <div className="flex items-center gap-1 text-success bg-success/10 px-2 py-1 rounded-md text-sm font-bold" style={{ background: 'rgba(52,211,153,0.1)', color: 'var(--success)' }}>
              <TrendingUp size={16} /> +12.5%
            </div>
          </div>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <AreaChart data={dummyDataBar}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--chart-axis)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--chart-axis)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--chart-card)', borderColor: 'var(--border)', borderRadius: '8px', boxShadow: 'var(--shadow-sm)' }}
                  itemStyle={{ color: 'var(--text-primary)', fontWeight: '500' }}
                />
                <Area type="monotone" dataKey="realisasi" stroke="var(--chart-line-blue)" fill="var(--chart-bar-primary)" fillOpacity={0.2} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart Kontribusi */}
        <div className="card">
          <h3 className="section-title mb-6">{t('analitik.contrib_title')}</h3>
          <div className="flex items-center" style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '50%', height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={dummyDataPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {dummyDataPie.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--chart-card)', borderColor: 'var(--border)', borderRadius: '8px', boxShadow: 'var(--shadow-sm)' }}
                    itemStyle={{ color: 'var(--text-primary)', fontWeight: '500' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 pl-6" style={{ width: '50%', paddingLeft: '24px' }}>
              <ul className="space-y-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {dummyDataPie.map((item, index) => (
                  <li key={item.name} className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="w-3 h-3 rounded-full" style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <span className="font-bold">{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        
        {/* Ringkasan Insight */}
        <div className="card">
          <h3 className="section-title mb-6">{t('analitik.insight_title')}</h3>
          <div className="space-y-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="p-4 rounded-lg bg-card-2 border border-border" style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-card-2)', border: '1px solid var(--border)' }}>
              <h4 className="font-bold text-success mb-1">{t('analitik.insight_top')}</h4>
              <p className="text-sm text-secondary">{t('analitik.insight_top_desc')}</p>
            </div>
            <div className="p-4 rounded-lg bg-card-2 border border-border" style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-card-2)', border: '1px solid var(--border)' }}>
              <h4 className="font-bold text-warning mb-1">{t('analitik.insight_warn')}</h4>
              <p className="text-sm text-secondary">{t('analitik.insight_warn_desc')}</p>
            </div>
            <div className="p-4 rounded-lg bg-card-2 border border-border" style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-card-2)', border: '1px solid var(--border)' }}>
              <h4 className="font-bold text-info mb-1">{t('analitik.insight_rec')}</h4>
              <p className="text-sm text-secondary">{t('analitik.insight_rec_desc')}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AnalitikPage;
