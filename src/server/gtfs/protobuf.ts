/**
 * Minimal protobuf wire-format reader.
 *
 * GTFS-Realtime is protobuf, and the usual decoder (`gtfs-realtime-bindings`)
 * pulls in protobufjs, which is awkward to bundle for edge runtimes. We only
 * need to read a handful of fields, and the wire format is small enough to
 * decode directly: parse each message into its raw fields, then pick out the
 * field numbers we care about. Unknown fields are kept rather than rejected,
 * so a producer adding extensions cannot break us.
 *
 * Wire types: 0 varint, 1 fixed64, 2 length-delimited, 5 fixed32.
 * Groups (3, 4) are deprecated and not supported.
 */

export type WireValue =
  | { readonly wire: 0; readonly varint: bigint }
  | { readonly wire: 1; readonly fixed64: bigint }
  | { readonly wire: 2; readonly bytes: Uint8Array }
  | { readonly wire: 5; readonly fixed32: number };

export type Fields = Map<number, WireValue[]>;

function readVarint(buf: Uint8Array, pos: number): { value: bigint; next: number } {
  let result = 0n;
  let shift = 0n;
  let p = pos;
  while (p < buf.length) {
    const byte = buf[p++];
    result |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value: result, next: p };
    shift += 7n;
    if (shift > 63n) throw new Error('protobuf: varint exceeds 64 bits');
  }
  throw new Error('protobuf: truncated varint');
}

export function decodeMessage(buf: Uint8Array, start = 0, end = buf.length): Fields {
  const fields: Fields = new Map();
  let pos = start;

  while (pos < end) {
    const tag = readVarint(buf, pos);
    pos = tag.next;
    const fieldNo = Number(tag.value >> 3n);
    const wire = Number(tag.value & 7n);
    if (fieldNo === 0) throw new Error('protobuf: invalid field number 0');

    let value: WireValue;
    switch (wire) {
      case 0: {
        const v = readVarint(buf, pos);
        pos = v.next;
        value = { wire: 0, varint: v.value };
        break;
      }
      case 1: {
        if (pos + 8 > end) throw new Error('protobuf: truncated fixed64');
        const view = new DataView(buf.buffer, buf.byteOffset + pos, 8);
        value = { wire: 1, fixed64: view.getBigUint64(0, true) };
        pos += 8;
        break;
      }
      case 2: {
        const len = readVarint(buf, pos);
        pos = len.next;
        const size = Number(len.value);
        if (pos + size > end) throw new Error('protobuf: truncated length-delimited field');
        value = { wire: 2, bytes: buf.subarray(pos, pos + size) };
        pos += size;
        break;
      }
      case 5: {
        if (pos + 4 > end) throw new Error('protobuf: truncated fixed32');
        const view = new DataView(buf.buffer, buf.byteOffset + pos, 4);
        value = { wire: 5, fixed32: view.getUint32(0, true) };
        pos += 4;
        break;
      }
      default:
        throw new Error(`protobuf: unsupported wire type ${wire}`);
    }

    const bucket = fields.get(fieldNo);
    if (bucket) bucket.push(value);
    else fields.set(fieldNo, [value]);
  }

  return fields;
}

const last = (fields: Fields, no: number): WireValue | undefined => {
  const bucket = fields.get(no);
  return bucket && bucket.length > 0 ? bucket[bucket.length - 1] : undefined;
};

const decoder = new TextDecoder('utf-8', { fatal: false });

export function getString(fields: Fields, no: number): string | null {
  const v = last(fields, no);
  return v?.wire === 2 ? decoder.decode(v.bytes) : null;
}

/** Reads an `int32`/`int64`. Negative values are sign-extended 64-bit varints. */
export function getInt(fields: Fields, no: number): number | null {
  const v = last(fields, no);
  if (v?.wire !== 0) return null;
  return Number(BigInt.asIntN(64, v.varint));
}

export function getUint(fields: Fields, no: number): number | null {
  const v = last(fields, no);
  if (v?.wire !== 0) return null;
  return Number(v.varint);
}

export function getBool(fields: Fields, no: number): boolean | null {
  const v = last(fields, no);
  return v?.wire === 0 ? v.varint !== 0n : null;
}

export function getFloat(fields: Fields, no: number): number | null {
  const v = last(fields, no);
  if (v?.wire !== 5) return null;
  const buf = new ArrayBuffer(4);
  new DataView(buf).setUint32(0, v.fixed32, true);
  return new DataView(buf).getFloat32(0, true);
}

export function getMessage(fields: Fields, no: number): Fields | null {
  const v = last(fields, no);
  return v?.wire === 2 ? decodeMessage(v.bytes) : null;
}

export function getMessages(fields: Fields, no: number): Fields[] {
  const bucket = fields.get(no);
  if (!bucket) return [];
  const out: Fields[] = [];
  for (const v of bucket) if (v.wire === 2) out.push(decodeMessage(v.bytes));
  return out;
}

export function hasField(fields: Fields, no: number): boolean {
  return fields.has(no);
}
