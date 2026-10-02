export interface ParsedID3 {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  track?: string;
  pictureUrl?: string;
  pictureBlob?: Blob;
  pictureMimeType?: string;
  pictureExtension?: 'jpg' | 'png' | 'webp';
}

const MAX_METADATA_BYTES = 12 * 1024 * 1024;

const synchsafeToInt = (a: number, b: number, c: number, d: number) =>
  ((a & 0x7f) << 21) |
  ((b & 0x7f) << 14) |
  ((c & 0x7f) << 7) |
  (d & 0x7f);

const uint32be = (bytes: Uint8Array, offset: number) =>
  (
    ((bytes[offset] || 0) * 0x1000000) +
    ((bytes[offset + 1] || 0) << 16) +
    ((bytes[offset + 2] || 0) << 8) +
    (bytes[offset + 3] || 0)
  ) >>> 0;

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

const inferImageType = (bytes: Uint8Array, declaredMime = '') => {
  const mime = declaredMime.toLowerCase();
  if (mime.includes('png')) {
    return { mime: 'image/png', extension: 'png' as const };
  }
  if (mime.includes('webp')) {
    return { mime: 'image/webp', extension: 'webp' as const };
  }
  if (mime.includes('jpeg') || mime.includes('jpg')) {
    return { mime: 'image/jpeg', extension: 'jpg' as const };
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { mime: 'image/png', extension: 'png' as const };
  }

  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === 'RIFF' &&
    ascii(bytes, 8, 4) === 'WEBP'
  ) {
    return { mime: 'image/webp', extension: 'webp' as const };
  }

  return { mime: 'image/jpeg', extension: 'jpg' as const };
};

const makePictureResult = (bytes: Uint8Array, declaredMime = '') => {
  if (!bytes.length) return null;
  const type = inferImageType(bytes, declaredMime);
  const blob = new Blob([new Uint8Array(bytes).buffer], { type: type.mime });
  return {
    pictureBlob: blob,
    pictureMimeType: type.mime,
    pictureExtension: type.extension,
    pictureUrl: URL.createObjectURL(blob)
  };
};

const descriptionEnd = (data: Uint8Array, start: number, encoding: number) => {
  if (encoding === 1 || encoding === 2) {
    for (let i = start; i + 1 < data.length; i += 2) {
      if (data[i] === 0 && data[i + 1] === 0) return i + 2;
    }
    return data.length;
  }

  for (let i = start; i < data.length; i += 1) {
    if (data[i] === 0) return i + 1;
  }
  return data.length;
};

const extractApic = (frameData: Uint8Array) => {
  if (frameData.length < 5) return null;

  try {
    const encoding = frameData[0];
    let p = 1;
    const mimeEnd = frameData.indexOf(0, p);
    if (mimeEnd < 0) return null;

    const declaredMime = new TextDecoder('iso-8859-1')
      .decode(frameData.subarray(p, mimeEnd))
      .trim();

    p = mimeEnd + 1;
    if (p >= frameData.length) return null;

    p += 1; // picture type
    p = descriptionEnd(frameData, p, encoding);

    if (p >= frameData.length) return null;
    return makePictureResult(frameData.subarray(p), declaredMime);
  } catch {
    return null;
  }
};

const extractMp4Cover = (bytes: Uint8Array) => {
  // M4A/MP4 cover art lives in a covr atom containing a data atom.
  // A byte scan is intentionally used here because the file may contain nested
  // metadata atoms and we only need the embedded artwork, not a full MP4 parser.
  for (let i = 4; i + 20 < bytes.length; i += 1) {
    if (
      bytes[i] !== 0x63 || // c
      bytes[i + 1] !== 0x6f || // o
      bytes[i + 2] !== 0x76 || // v
      bytes[i + 3] !== 0x72 // r
    ) {
      continue;
    }

    const covrStart = i - 4;
    const covrSize = uint32be(bytes, covrStart);
    if (covrSize < 16) continue;

    const covrEnd = Math.min(bytes.length, covrStart + covrSize);
    let p = i + 4;

    while (p + 16 <= covrEnd) {
      const boxSize = uint32be(bytes, p);
      const boxType = ascii(bytes, p + 4, 4);
      if (boxSize < 16 || p + boxSize > covrEnd) break;

      if (boxType === 'data') {
        const dataType = uint32be(bytes, p + 8) & 0xffffff;
        const imageStart = p + 16;
        const imageEnd = p + boxSize;
        if (imageEnd > imageStart) {
          const declaredMime =
            dataType === 14 ? 'image/png' :
            dataType === 27 ? 'image/webp' :
            'image/jpeg';
          return makePictureResult(bytes.subarray(imageStart, imageEnd), declaredMime);
        }
      }

      p += boxSize;
    }
  }

  return null;
};

export async function parseID3Tags(file: File): Promise<ParsedID3> {
  const cleanName = file.name.replace(/\.[^/.]+$/, '');
  const fallback = () => {
    const parts = cleanName.split(/[-_]/);
    if (parts.length > 1) {
      return {
        title: parts[1].trim(),
        artist: parts[0].trim()
      } satisfies ParsedID3;
    }
    return { title: cleanName } satisfies ParsedID3;
  };

  const firstHeader = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  const hasId3 =
    firstHeader.length >= 10 &&
    firstHeader[0] === 0x49 &&
    firstHeader[1] === 0x44 &&
    firstHeader[2] === 0x33;

  if (!hasId3) {
    const firstChunk = new Uint8Array(
      await file.slice(0, Math.min(file.size, MAX_METADATA_BYTES)).arrayBuffer()
    );
    let picture = extractMp4Cover(firstChunk);

    if (!picture && file.size > MAX_METADATA_BYTES) {
      const tailStart = Math.max(0, file.size - MAX_METADATA_BYTES);
      const tailChunk = new Uint8Array(await file.slice(tailStart).arrayBuffer());
      picture = extractMp4Cover(tailChunk);
    }

    return {
      ...fallback(),
      ...(picture || {})
    };
  }

  const tagSize = synchsafeToInt(
    firstHeader[6],
    firstHeader[7],
    firstHeader[8],
    firstHeader[9]
  );
  const bytesToRead = Math.min(
    file.size,
    Math.max(10, Math.min(tagSize + 10, MAX_METADATA_BYTES))
  );
  const bytes = new Uint8Array(await file.slice(0, bytesToRead).arrayBuffer());

  const result: ParsedID3 = {};
  const version = bytes[3] || 3;
  let offset = 10;
  const maxOffset = Math.min(bytes.length, tagSize + 10);

  const textDecoderUtf8 = new TextDecoder('utf-8');
  const textDecoderIso = new TextDecoder('iso-8859-1');
  const textDecoderUtf16 = new TextDecoder('utf-16');

  function decodeText(slice: Uint8Array): string {
    if (slice.length === 0) return '';
    const encoding = slice[0];
    const data = slice.subarray(1);
    try {
      if (encoding === 0) return textDecoderIso.decode(data).replace(/\0/g, '').trim();
      if (encoding === 1 || encoding === 2) return textDecoderUtf16.decode(data).replace(/\0/g, '').trim();
      if (encoding === 3) return textDecoderUtf8.decode(data).replace(/\0/g, '').trim();
      return textDecoderUtf8.decode(data).replace(/\0/g, '').trim();
    } catch {
      return '';
    }
  }

  while (offset + 10 <= maxOffset) {
    const frameId = ascii(bytes, offset, 4);
    if (!/^[A-Z0-9]{4}$/.test(frameId)) break;

    const frameSize = version === 4
      ? synchsafeToInt(
          bytes[offset + 4],
          bytes[offset + 5],
          bytes[offset + 6],
          bytes[offset + 7]
        )
      : uint32be(bytes, offset + 4);

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
    } else if (frameId === 'APIC' && !result.pictureBlob) {
      const picture = extractApic(frameData);
      if (picture) Object.assign(result, picture);
    }

    offset += 10 + frameSize;
  }

  if (!result.title) {
    Object.assign(result, fallback());
  }

  return result;
}
