export interface ParsedID3 {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  track?: string;
  pictureUrl?: string;
}

export async function parseID3Tags(file: File): Promise<ParsedID3> {
  const buffer = await file.slice(0, 512 * 1024).arrayBuffer(); // read first 512KB
  const bytes = new Uint8Array(buffer);

  // Check ID3 header
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    // fallback: infer title from filename without extension
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    const parts = cleanName.split(/[-_]/);
    if (parts.length > 1) {
      return {
        title: parts[1].trim(),
        artist: parts[0].trim()
      };
    }
    return { title: cleanName };
  }

  const result: ParsedID3 = {};
  let offset = 10;
  const tagSize = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
  const maxOffset = Math.min(bytes.length, tagSize + 10);

  const textDecoderUtf8 = new TextDecoder('utf-8');
  const textDecoderIso = new TextDecoder('iso-8859-1');
  const textDecoderUtf16 = new TextDecoder('utf-16le');

  function decodeText(slice: Uint8Array): string {
    if (slice.length === 0) return '';
    const encoding = slice[0];
    const data = slice.subarray(1);
    try {
      if (encoding === 0) return textDecoderIso.decode(data).replace(/\0/g, '').trim();
      if (encoding === 1) return textDecoderUtf16.decode(data).replace(/\0/g, '').trim();
      if (encoding === 3) return textDecoderUtf8.decode(data).replace(/\0/g, '').trim();
      return textDecoderUtf8.decode(data).replace(/\0/g, '').trim();
    } catch {
      return '';
    }
  }

  while (offset + 10 < maxOffset) {
    const frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    if (!/^[A-Z0-9]{4}$/.test(frameId)) break;

    const frameSize = (bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7];
    if (frameSize <= 0 || offset + 10 + frameSize > bytes.length) break;

    const frameData = bytes.subarray(offset + 10, offset + 10 + frameSize);

    if (frameId === 'TIT2') {
      result.title = decodeText(frameData);
    } else if (frameId === 'TPE1') {
      result.artist = decodeText(frameData);
    } else if (frameId === 'TALB') {
      result.album = decodeText(frameData);
    } else if (frameId === 'TDRC' || frameId === 'TYER') {
      result.year = decodeText(frameData);
    } else if (frameId === 'TRCK') {
      result.track = decodeText(frameData);
    } else if (frameId === 'APIC') {
      try {
        // extract image
        let p = 1;
        while (p < frameData.length && frameData[p] !== 0) p++; // mime
        p++; // null
        p++; // picture type
        while (p < frameData.length && frameData[p] !== 0) p++; // description
        p++; // null
        if (p < frameData.length) {
          const imgBytes = frameData.subarray(p);
          const blob = new Blob([imgBytes]);
          result.pictureUrl = URL.createObjectURL(blob);
        }
      } catch {
        // ignore image error
      }
    }

    offset += 10 + frameSize;
  }

  if (!result.title) {
    result.title = file.name.replace(/\.[^/.]+$/, '');
  }

  return result;
}
