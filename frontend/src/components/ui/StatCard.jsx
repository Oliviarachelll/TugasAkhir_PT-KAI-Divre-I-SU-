import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

const StatCard = ({ icon: Icon, color, label, value, subLabel, trend, trendValue }) => {
  // Tentukan warna ikon berdasarkan properti color
  const getColorHex = (c) => {
    switch(c) {
      case 'brand': return 'var(--brand-500)';
      case 'amber': return '#f59e0b';
      case 'emerald': return '#10b981';
      case 'rose': return '#f43f5e';
      default: return 'var(--brand-500)';
    }
  };

  const getBgColorHex = (c) => {
    switch(c) {
      case 'brand': return 'var(--brand-50)';
      case 'amber': return '#fef3c7';
      case 'emerald': return '#d1fae5';
      case 'rose': return '#ffe4e6';
      default: return 'var(--brand-50)';
    }
  };

  return (
    <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ 
        width: '48px', 
        height: '48px', 
        borderRadius: '12px', 
        backgroundColor: getBgColorHex(color),
        color: getColorHex(color),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon size={24} strokeWidth={2} />
      </div>
      <div style={{ flex: 1 }}>
        <div className="text-muted text-sm font-medium mb-1">{label}</div>
        <div className="text-2xl font-bold text-gray-800 leading-tight">{value}</div>
        
        {(subLabel || trend) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '12px' }}>
            {trend && (
              <span style={{ 
                display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600,
                color: trend === 'up' ? '#10b981' : '#f43f5e' 
              }}>
                {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {trendValue}
              </span>
            )}
            {subLabel && <span className="text-muted">{subLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
