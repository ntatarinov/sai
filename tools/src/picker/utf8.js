// Well-formed UTF-8 check by the table of the Unicode standard ("Well-Formed UTF-8 Byte
// Sequences"); it accepts and rejects the same bytes as a fatal TextDecoder (design
// REQ-054, 5.2), and in addition tells where the first bad byte is.

// The index of the first byte at which the sequence stops being well-formed UTF-8, or -1.
// The index points at the leading byte of the bad sequence.
export function firstInvalidUtf8(bytes) {
  const n = bytes.length;
  let i = 0;
  while (i < n) {
    const lead = bytes[i];
    if (lead <= 0x7f) {
      i += 1;
      continue;
    }
    let tail; // how many continuation bytes follow the leading one
    let lo = 0x80; // the allowed range of the first continuation byte
    let hi = 0xbf;
    if (lead >= 0xc2 && lead <= 0xdf) {
      tail = 1;
    } else if (lead >= 0xe0 && lead <= 0xef) {
      tail = 2;
      if (lead === 0xe0) lo = 0xa0;
      else if (lead === 0xed) hi = 0x9f;
    } else if (lead >= 0xf0 && lead <= 0xf4) {
      tail = 3;
      if (lead === 0xf0) lo = 0x90;
      else if (lead === 0xf4) hi = 0x8f;
    } else {
      return i; // a stray continuation byte, C0, C1 or F5..FF
    }
    if (i + tail >= n) return i; // the sequence is cut off by the end
    const first = bytes[i + 1];
    if (first < lo || first > hi) return i;
    for (let k = 2; k <= tail; k++) {
      const b = bytes[i + k];
      if (b < 0x80 || b > 0xbf) return i;
    }
    i += tail + 1;
  }
  return -1;
}
