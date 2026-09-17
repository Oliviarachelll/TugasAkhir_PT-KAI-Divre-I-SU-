
import { useTranslation } from 'react-i18next';
import { getLocale } from '../../../utils/format';

const FormattedNumberInput = ({ value, onChange, placeholder = "0", className = "form-control", prefix, suffix, name }) => {
  const { i18n } = useTranslation();
  const displayValue = value !== '' && value != null ? Number(value).toLocaleString(getLocale(i18n.language)) : '';

  const handleChange = (e) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (rawValue === '') {
      onChange('');
    } else {
      onChange(parseFloat(rawValue));
    }
  };

  if (!prefix && !suffix) {
    return (
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        name={name}
        className={className}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
      />
    );
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
      {prefix && <span style={{ position: 'absolute', left: '12px', color: '#9CA3AF', fontSize: '0.875rem', pointerEvents: 'none' }}>{prefix}</span>}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        name={name}
        className={className}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        style={{ 
          paddingLeft: prefix ? (prefix.length > 2 ? '40px' : '36px') : undefined,
          paddingRight: suffix ? '40px' : undefined 
        }}
      />
      {suffix && <span style={{ position: 'absolute', right: '12px', color: '#9CA3AF', fontSize: '0.875rem', pointerEvents: 'none' }}>{suffix}</span>}
    </div>
  );
};

export default FormattedNumberInput;
