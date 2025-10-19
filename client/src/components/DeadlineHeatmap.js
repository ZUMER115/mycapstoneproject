import { addDays, format } from 'date-fns';
import { useMemo } from 'react';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';

export default function DeadlineHeatmap({ ranges }) {
  // ranges: [{ start: Date, end: Date }] (end exclusive)
  const values = useMemo(() => {
    const map = new Map();
    ranges.forEach(({ start, end }) => {
      if (!start || !end) return;
      let d = new Date(start);
      while (d < end) {
        const key = format(d, 'yyyy-MM-dd');
        map.set(key, (map.get(key) || 0) + 1);
        d = addDays(d, 1);
      }
    });
    return Array.from(map, ([date, count]) => ({ date, count }));
  }, [ranges]);

  const today = new Date();
  const yearAgo = new Date();
  yearAgo.setDate(today.getDate() - 365);

  return (
    <div className="card" style={{ padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>
      <h3 style={{ marginTop: 0 }}>Busiest Days (last 12 months)</h3>
      <CalendarHeatmap
        startDate={yearAgo}
        endDate={today}
        values={values}
        classForValue={(v) => {
          if (!v || !v.count) return 'color-empty';
          if (v.count >= 5) return 'color-github-4';
          if (v.count >= 3) return 'color-github-3';
          if (v.count >= 2) return 'color-github-2';
          return 'color-github-1';
        }}
        showWeekdayLabels
      />
    </div>
  );
}
