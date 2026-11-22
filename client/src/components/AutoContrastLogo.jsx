// 어두운 로고(예: GIANTX 검은 로고)는 어두운 배경에서 안 보이므로 흰색으로 바꿔 표시.
//   별도 Image(crossOrigin)로 불투명 픽셀 평균 밝기를 재서 어두우면 brightness(0) invert(1). 측정 실패(CORS 등) 시 원본 그대로.
import React, { useEffect, useState } from 'react';

const cache = new Map(); // src → true(어두움) / false
const measure = (src) => new Promise((resolve) => {
  if (cache.has(src)) return resolve(cache.get(src));
  const im = new Image();
  im.crossOrigin = 'anonymous';
  im.onload = () => {
    try {
      const n = 32, c = document.createElement('canvas');
      c.width = n; c.height = n;
      const ctx = c.getContext('2d');
      ctx.drawImage(im, 0, 0, n, n);
      const px = ctx.getImageData(0, 0, n, n).data;
      let sum = 0, cnt = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 128) continue; // 투명 픽셀 제외
        sum += (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255; cnt++;
      }
      const dark = cnt > 0 && sum / cnt < 0.22;
      cache.set(src, dark); resolve(dark);
    } catch { cache.set(src, false); resolve(false); }
  };
  im.onerror = () => { cache.set(src, false); resolve(false); };
  im.src = src;
});

export default function AutoContrastLogo({ src, className, ...rest }) {
  const [dark, setDark] = useState(() => cache.get(src) || false);
  useEffect(() => { let alive = true; if (src) measure(src).then((d) => alive && setDark(d)); return () => { alive = false; }; }, [src]);
  if (!src) return null;
  return <img src={src} alt="" className={className} style={dark ? { filter: 'brightness(0) invert(1)' } : undefined} {...rest} />;
}
