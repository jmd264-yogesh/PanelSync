// src/lib/recalibrate/fixWebmDuration.ts
// Port of Yuri Sitnikov's fix-webm-duration to TypeScript
// Injects missing Duration metadata into MediaRecorder WebM blobs so Chromium enables seeking

/* eslint-disable @typescript-eslint/no-explicit-any */
const sections: Record<number, { name: string; type: string }> = {
  0xa45dfa3: { name: 'EBML', type: 'Container' },
  0x286: { name: 'EBMLVersion', type: 'Uint' },
  0x2f7: { name: 'EBMLReadVersion', type: 'Uint' },
  0x2f2: { name: 'EBMLMaxIDLength', type: 'Uint' },
  0x2f3: { name: 'EBMLMaxSizeLength', type: 'Uint' },
  0x282: { name: 'DocType', type: 'String' },
  0x287: { name: 'DocTypeVersion', type: 'Uint' },
  0x285: { name: 'DocTypeReadVersion', type: 'Uint' },
  0x6c: { name: 'Void', type: 'Binary' },
  0x3f: { name: 'CRC-32', type: 'Binary' },
  0x8538067: { name: 'Segment', type: 'Container' },
  0x14d9b74: { name: 'SeekHead', type: 'Container' },
  0xdbb: { name: 'Seek', type: 'Container' },
  0x13ab: { name: 'SeekID', type: 'Binary' },
  0x13ac: { name: 'SeekPosition', type: 'Uint' },
  0x549a966: { name: 'Info', type: 'Container' },
  0x33a4: { name: 'SegmentUID', type: 'Binary' },
  0x3384: { name: 'SegmentFilename', type: 'String' },
  0xad7b1: { name: 'TimecodeScale', type: 'Uint' },
  0x489: { name: 'Duration', type: 'Float' },
  0x461: { name: 'DateUTC', type: 'Date' },
  0x3ba9: { name: 'Title', type: 'String' },
  0xd80: { name: 'MuxingApp', type: 'String' },
  0x1741: { name: 'WritingApp', type: 'String' },
  0x67: { name: 'Timecode', type: 'Uint' },
  0x654ae6b: { name: 'Tracks', type: 'Container' },
  0x2e: { name: 'TrackEntry', type: 'Container' },
  0x57: { name: 'TrackNumber', type: 'Uint' },
  0x33c5: { name: 'TrackUID', type: 'Uint' },
  0x3: { name: 'TrackType', type: 'Uint' },
  0x6: { name: 'CodecID', type: 'String' },
  0x23a2: { name: 'CodecPrivate', type: 'Binary' },
  0x61: { name: 'Audio', type: 'Container' },
  0x35: { name: 'SamplingFrequency', type: 'Float' },
  0x1f: { name: 'Channels', type: 'Uint' },
  0x2264: { name: 'BitDepth', type: 'Uint' },
};

function padHex(hex: string): string {
  return hex.length % 2 === 1 ? '0' + hex : hex;
}

class WebmBase {
  name: string;
  type: string;
  source!: Uint8Array;
  data: any;

  constructor(name?: string, type?: string) {
    this.name = name || 'Unknown';
    this.type = type || 'Unknown';
  }
  updateBySource() {}
  setSource(source: Uint8Array) {
    this.source = source;
    this.updateBySource();
  }
  updateByData() {}
  setData(data: any) {
    this.data = data;
    this.updateByData();
  }
}

class WebmUint extends WebmBase {
  constructor(name?: string, type?: string) {
    super(name, type || 'Uint');
  }
  override updateBySource() {
    this.data = '';
    for (let i = 0; i < this.source.length; i++) {
      const hex = this.source[i].toString(16);
      this.data += padHex(hex);
    }
  }
  override updateByData() {
    const length = this.data.length / 2;
    this.source = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      const hex = this.data.substring(i * 2, i * 2 + 2);
      this.source[i] = parseInt(hex, 16);
    }
  }
  getValue(): number {
    return parseInt(this.data, 16);
  }
  setValue(value: number) {
    this.setData(padHex(value.toString(16)));
  }
}

class WebmFloat extends WebmBase {
  constructor(name?: string, type?: string) {
    super(name, type || 'Float');
  }
  getFloatArrayType() {
    return this.source && this.source.length === 4 ? Float32Array : Float64Array;
  }
  override updateBySource() {
    const byteArray = new Uint8Array(this.source.slice().reverse());
    const FloatArrayType = this.getFloatArrayType();
    const floatArray = new FloatArrayType(byteArray.buffer);
    this.data = floatArray[0];
  }
  override updateByData() {
    const FloatArrayType = this.getFloatArrayType();
    const floatArray = new FloatArrayType([this.data]);
    const byteArray = new Uint8Array(floatArray.buffer);
    this.source = new Uint8Array(byteArray.slice().reverse());
  }
  getValue(): number {
    return this.data;
  }
  setValue(value: number) {
    this.setData(value);
  }
}

class WebmContainer extends WebmBase {
  offset = 0;

  constructor(name?: string, type?: string) {
    super(name, type || 'Container');
  }
  readByte(): number {
    return this.source[this.offset++];
  }
  readUint(): number {
    const firstByte = this.readByte();
    const bytes = 8 - firstByte.toString(2).length;
    let value = firstByte - (1 << (7 - bytes));
    for (let i = 0; i < bytes; i++) {
      value *= 256;
      value += this.readByte();
    }
    return value;
  }
  override updateBySource() {
    this.data = [];
    for (this.offset = 0; this.offset < this.source.length; ) {
      const id = this.readUint();
      const len = this.readUint();
      const end = Math.min(this.offset + len, this.source.length);
      const data = this.source.slice(this.offset, end);

      const info = sections[id] || { name: 'Unknown', type: 'Unknown' };
      let section: WebmBase;
      switch (info.type) {
        case 'Container':
          section = new WebmContainer(info.name, info.type);
          break;
        case 'Uint':
          section = new WebmUint(info.name, info.type);
          break;
        case 'Float':
          section = new WebmFloat(info.name, info.type);
          break;
        default:
          section = new WebmBase(info.name, info.type);
          break;
      }
      section.setSource(data);
      this.data.push({ id, idHex: id.toString(16), data: section });
      this.offset = end;
    }
  }
  writeUint(x: number, draft?: boolean) {
    let bytes = 1;
    let flag = 0x80;
    for (; x >= flag && bytes < 8; bytes++, flag *= 0x80) {}

    if (!draft) {
      let value = flag + x;
      for (let i = bytes - 1; i >= 0; i--) {
        const c = value % 256;
        this.source[this.offset + i] = c;
        value = (value - c) / 256;
      }
    }
    this.offset += bytes;
  }
  writeSections(draft?: boolean): number {
    this.offset = 0;
    for (let i = 0; i < this.data.length; i++) {
      const section = this.data[i];
      const content = section.data.source;
      const contentLength = content.length;
      this.writeUint(section.id, draft);
      this.writeUint(contentLength, draft);
      if (!draft) {
        this.source.set(content, this.offset);
      }
      this.offset += contentLength;
    }
    return this.offset;
  }
  override updateByData() {
    const length = this.writeSections(true);
    this.source = new Uint8Array(length);
    this.writeSections(false);
  }
  getSectionById(id: number): any {
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i].id === id) {
        return this.data[i].data;
      }
    }
    return null;
  }
}

class WebmFile extends WebmContainer {
  constructor(source: Uint8Array) {
    super('File', 'File');
    this.setSource(source);
  }
  fixDuration(duration: number): boolean {
    const segmentSection = this.getSectionById(0x8538067);
    if (!segmentSection) return false;

    const infoSection = segmentSection.getSectionById(0x549a966);
    if (!infoSection) return false;

    const timeScaleSection = infoSection.getSectionById(0xad7b1);
    if (!timeScaleSection) return false;

    let durationSection = infoSection.getSectionById(0x489);
    if (durationSection) {
      if (durationSection.getValue() <= 0) {
        durationSection.setValue(duration);
      } else {
        return false;
      }
    } else {
      durationSection = new WebmFloat('Duration', 'Float');
      durationSection.setValue(duration);
      infoSection.data.push({ id: 0x489, data: durationSection });
    }

    timeScaleSection.setValue(1000000); // 1ms scale
    infoSection.updateByData();
    segmentSection.updateByData();
    this.updateByData();
    return true;
  }
  toBlob(mimeType: string): Blob {
    return new Blob([this.source.buffer as ArrayBuffer], { type: mimeType });
  }
}

/**
 * Patches a MediaRecorder WebM blob with duration metadata so that
 * Chromium browsers (Chrome, Edge, Brave) can display full duration and enable seeking.
 */
export async function fixWebmDuration(blob: Blob, durationMs: number): Promise<Blob> {
  // Only attempt on webm blobs with positive duration
  if (!blob || !blob.type.includes('webm') || durationMs <= 0) {
    return blob;
  }

  try {
    const buffer = await blob.arrayBuffer();
    const file = new WebmFile(new Uint8Array(buffer));
    if (file.fixDuration(durationMs)) {
      return file.toBlob(blob.type);
    }
    return blob;
  } catch (err) {
    console.warn('[fixWebmDuration] Failed to patch WebM header:', err);
    return blob;
  }
}
