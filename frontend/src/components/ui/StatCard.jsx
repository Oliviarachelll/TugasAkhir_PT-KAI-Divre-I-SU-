import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

const StatCard = ({ icon: Icon, color, label, value, subLabel, trend, trendValue }) => {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>
        <Icon size={24} />
      </div>
      <div className="stat-info">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        
        {(subLabel || trend) && (
          <div className="flex items-center gap-2 mt-2">
            {trend && (
              <span className={`stat-change ${trend === 'up' ? 'up' : 'down'}`}>
                {trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {trendValue}
              </span>
            )}
            {subLabel && <span className="stat-sub">{subLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
