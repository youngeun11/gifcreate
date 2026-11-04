async function encodeAnimatedGif(frames, width, height, delayMs, onProgress) {
  const delayCs = Math.max(2, Math.round(delayMs / 10));
  const bytes = [];
  const put = (v) => bytes.push(v & 255);
  const put16 = (v) => {
    put(v);
    put(v >> 8);
  };
  const putStr = (s) => {
    for (let i = 0; i < s.length; i++) put(s.charCodeAt(i));
  };

  putStr("GIF89a");
  put16(width);
  put16(height);
  put(0xf0);
  put(0);
  put(0);
  for (let i = 0; i < 6; i++) put(0);

  put(0x21);
  put(0xff);
  put(11);
  putStr("NETSCAPE2.0");
  put(3);
  put(1);
  put16(0);
  put(0);

  for (let index = 0; index < frames.length; index++) {
    const rgba = frames[index];
    const { palette, indexed } = quantizeFrame(rgba, width, height);
    put(0x21);
    put(0xf9);
    put(4);
    put(0x04);
    put16(delayCs);
    put(0);
    put(0);

    put(0x2c);
    put16(0);
    put16(0);
    put16(width);
    put16(height);
    put(0x87);

    for (let i = 0; i < 256; i++) {
      const color = palette[i] || [0, 0, 0];
      put(color[0]);
      put(color[1]);
      put(color[2]);
    }

    const compressed = lzwEncode(indexed, 8);
    put(8);
    for (let i = 0; i < compressed.length; i += 255) {
      const chunk = compressed.subarray(i, i + 255);
      put(chunk.length);
      for (let j = 0; j < chunk.length; j++) put(chunk[j]);
    }
    put(0);
    if (onProgress) onProgress((index + 1) / frames.length);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  put(0x3b);
  return new Blob([new Uint8Array(bytes)], { type: "image/gif" });
}

function quantizeFrame(rgba, width, height) {
  const counts = new Map();
  const step = Math.max(1, Math.floor((width * height) / 12000));
  for (let p = 0, i = 0; i < rgba.length; i += 4, p++) {
    if (p % step !== 0) continue;
    const key = ((rgba[i] & 0xf8) << 8) | ((rgba[i + 1] & 0xf8) << 3) | (rgba[i + 2] >> 3);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 256);
  const palette = ranked.map(([key]) => [
    (key >> 8) & 0xf8,
    (key >> 3) & 0xf8,
    (key << 3) & 0xf8,
  ]);
  while (palette.length < 256) palette.push([0, 0, 0]);

  const indexOf = new Map();
  ranked.forEach(([key], i) => indexOf.set(key, i));
  const indexed = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    const key = ((rgba[i] & 0xf8) << 8) | ((rgba[i + 1] & 0xf8) << 3) | (rgba[i + 2] >> 3);
    let idx = indexOf.get(key);
    if (idx === undefined) {
      idx = nearestColor(rgba[i], rgba[i + 1], rgba[i + 2], palette);
      indexOf.set(key, idx);
    }
    indexed[p] = idx;
  }
  return { palette, indexed };
}

function nearestColor(r, g, b, palette) {
  let best = 0;
  let dist = Infinity;
  for (let i = 0; i < 256; i++) {
    const pr = palette[i][0] - r;
    const pg = palette[i][1] - g;
    const pb = palette[i][2] - b;
    const d = pr * pr + pg * pg + pb * pb;
    if (d < dist) {
      dist = d;
      best = i;
    }
  }
  return best;
}

function lzwEncode(indexed, minCodeSize) {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoi + 1;
  const dict = new Map();
  const out = [];
  let acc = 0;
  let bits = 0;

  const write = (code, size) => {
    acc |= code << bits;
    bits += size;
    while (bits >= 8) {
      out.push(acc & 255);
      acc >>= 8;
      bits -= 8;
    }
  };

  const reset = () => {
    dict.clear();
    codeSize = minCodeSize + 1;
    nextCode = eoi + 1;
  };

  write(clear, codeSize);
  let prefix = indexed[0];
  for (let i = 1; i < indexed.length; i++) {
    const k = indexed[i];
    const key = (prefix << 12) | k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    write(prefix, codeSize);
    if (nextCode < 4096) {
      dict.set(key, nextCode);
      if (nextCode === 1 << codeSize && codeSize < 12) codeSize += 1;
      nextCode += 1;
    } else {
      write(clear, codeSize);
      reset();
    }
    prefix = k;
  }
  write(prefix, codeSize);
  write(eoi, codeSize);
  if (bits > 0) out.push(acc & 255);
  return Uint8Array.from(out);
}
