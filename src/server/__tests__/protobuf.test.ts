import { describe, expect, it } from 'vitest';
import { decodeMessage, getFloat, getInt, getMessages, getString, getUint } from '../gtfs/protobuf.ts';

/** Minimal test-only encoder, so fixtures are readable instead of hex blobs. */
function varint(value: bigint): number[] {
  const out: number[] = [];
  let v = BigInt.asUintN(64, value);
  do {
    let byte = Number(v & 0x7fn);
    v >>= 7n;
    if (v > 0n) byte |= 0x80;
    out.push(byte);
  } while (v > 0n);
  return out;
}

const tag = (field: number, wire: number): number[] => varint(BigInt((field << 3) | wire));
const encVarint = (field: number, value: number | bigint): number[] => [...tag(field, 0), ...varint(BigInt(value))];
const encBytes = (field: number, bytes: number[]): number[] => [...tag(field, 2), ...varint(BigInt(bytes.length)), ...bytes];
const encString = (field: number, value: string): number[] => encBytes(field, [...new TextEncoder().encode(value)]);
const encFloat = (field: number, value: number): number[] => {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, value, true);
  return [...tag(field, 5), ...new Uint8Array(buf)];
};

describe('protobuf reader', () => {
  it('decodes a hand-computed byte sequence', () => {
    // FeedMessage { header { gtfs_realtime_version: "2.0" } }
    // 0x0A = field 1, wire 2. Length 5. Inner: 0x0A, len 3, "2.0".
    const bytes = new Uint8Array([0x0a, 0x05, 0x0a, 0x03, 0x32, 0x2e, 0x30]);
    const root = decodeMessage(bytes);
    const header = getMessages(root, 1)[0];
    expect(getString(header, 1)).toBe('2.0');
  });

  it('round-trips strings, varints and floats', () => {
    const bytes = new Uint8Array([
      ...encString(1, 'trip-42'),
      ...encVarint(2, 300),
      ...encFloat(3, 49.2827),
    ]);
    const fields = decodeMessage(bytes);
    expect(getString(fields, 1)).toBe('trip-42');
    expect(getUint(fields, 2)).toBe(300);
    expect(getFloat(fields, 3)).toBeCloseTo(49.2827, 4);
  });

  it('sign-extends negative int32 values', () => {
    // Protobuf encodes -180 as a 10-byte sign-extended varint.
    const bytes = new Uint8Array(encVarint(5, -180));
    expect(getInt(decodeMessage(bytes), 5)).toBe(-180);
  });

  it('keeps repeated fields in order', () => {
    const bytes = new Uint8Array([...encString(1, 'a'), ...encString(1, 'b'), ...encString(1, 'c')]);
    const fields = decodeMessage(bytes);
    expect(fields.get(1)).toHaveLength(3);
    // Scalar accessors take the last value, per protobuf merge semantics.
    expect(getString(fields, 1)).toBe('c');
  });

  it('ignores unknown fields rather than failing', () => {
    const bytes = new Uint8Array([...encString(1, 'known'), ...encVarint(999, 7)]);
    expect(getString(decodeMessage(bytes), 1)).toBe('known');
  });

  it('rejects truncated input', () => {
    expect(() => decodeMessage(new Uint8Array([0x0a, 0x05, 0x61]))).toThrow(/truncated/);
  });

  it('rejects an over-long varint instead of silently wrapping', () => {
    const tooLong = new Uint8Array([0x08, ...Array(10).fill(0x80), 0x01]);
    expect(() => decodeMessage(tooLong)).toThrow(/64 bits/);
  });
});

export { encBytes, encFloat, encString, encVarint };
