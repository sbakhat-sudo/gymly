/** Real native drag slider — only ever rendered on web (every screen that uses it is a Manager/Admin
 * web-only screen), so a raw `<input type="range">` is safe without a native fallback. `accentColor`
 * tints the native track/thumb without a custom-drawn track. Shared by `ManagerCapacityScreen`'s
 * band thresholds and the Manager's "Posizione palestra" geofence radius — same control either way. */
export function RangeSlider({
  value,
  min,
  max,
  step,
  onChange,
  color,
  accessibilityLabel,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  color: string;
  accessibilityLabel: string;
}) {
  return (
    <input
      type="range"
      min={min}
      max={Math.max(min, max)}
      step={step ?? 1}
      value={Math.min(Math.max(value, min), Math.max(min, max))}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={accessibilityLabel}
      style={{ width: '100%', height: 24, accentColor: color, cursor: 'pointer' }}
    />
  );
}
