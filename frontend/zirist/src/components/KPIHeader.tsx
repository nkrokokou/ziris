import React, { useEffect, useRef, useState } from 'react';

interface KPIItem {
  label: string;
  value: number;
}

interface Props {
  items: KPIItem[];
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const CountUp: React.FC<{ target: number; duration?: number }> = ({ target, duration = 1000 }) => {
  const [val, setVal] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    start.current = null;
    let raf: number;
    const step = (ts: number) => {
      if (start.current === null) start.current = ts;
      const p = Math.min(1, (ts - start.current) / duration);
      setVal(Math.round(target * easeOutCubic(p)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return <span className="kpi-value">{val.toLocaleString()}</span>;
};

const KPIHeader: React.FC<Props> = ({ items }) => {
  return (
    <div className="kpi-strip">
      {items.map((it) => (
        <div key={it.label} className="neon-card kpi-card">
          <div className="kpi-icon" aria-hidden="true" />
          <div>
            <div className="kpi-label">{it.label}</div>
            <CountUp target={it.value} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default KPIHeader;
