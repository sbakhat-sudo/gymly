import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { encode } from 'uqr';

const QUIET_ZONE = 4; // modules of white margin required by the QR standard

/**
 * QR code generated LOCALLY (pure-JS `uqr` + react-native-svg): nothing leaves the device and no
 * native module is needed. Always black on white, even in dark mode, so any scanner can read it.
 */
export function QrCode({ value, size, accessibilityLabel }: { value: string; size: number; accessibilityLabel: string }) {
  const qr = useMemo(() => {
    try {
      const { data } = encode(value, { ecc: 'M', border: 0 });
      const n = data.length;
      // One subpath per horizontal run of dark modules: smaller path, no hairline seams between modules.
      let path = '';
      for (let y = 0; y < n; y++) {
        const row = data[y];
        if (!row) continue;
        let x = 0;
        while (x < n) {
          if (!row[x]) {
            x++;
            continue;
          }
          let end = x;
          while (end < n && row[end]) end++;
          path += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h${end - x}v1h-${end - x}z`;
          x = end;
        }
      }
      return { path, modules: n + QUIET_ZONE * 2 };
    } catch {
      return null; // payload too long for a QR: render nothing rather than crash
    }
  }, [value]);

  if (!qr) return null;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${qr.modules} ${qr.modules}`}>
        <Rect x={0} y={0} width={qr.modules} height={qr.modules} fill="#FFFFFF" />
        <Path d={qr.path} fill="#000000" />
      </Svg>
    </View>
  );
}
