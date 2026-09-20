/**
 * GTFS-Realtime decoding, limited to the parts MetroPulse actually reads.
 * Field numbers follow the gtfs-realtime.proto spec (v2.0).
 */
import {
  decodeMessage,
  getFloat,
  getInt,
  getMessage,
  getMessages,
  getString,
  getUint,
  type Fields,
} from './protobuf.ts';

export interface RtTripDescriptor {
  tripId: string | null;
  routeId: string | null;
  startDate: string | null;
  startTime: string | null;
}

export interface RtStopTimeUpdate {
  stopId: string | null;
  stopSequence: number | null;
  arrivalDelaySec: number | null;
  arrivalTime: number | null;
  departureDelaySec: number | null;
  departureTime: number | null;
}

export interface RtTripUpdate {
  trip: RtTripDescriptor;
  timestamp: number | null;
  /** Trip-level delay, when the producer supplies one. */
  delaySec: number | null;
  stopTimeUpdates: RtStopTimeUpdate[];
}

export interface RtVehiclePosition {
  trip: RtTripDescriptor | null;
  vehicleId: string | null;
  lat: number | null;
  lng: number | null;
  bearing: number | null;
  timestamp: number | null;
}

export interface RtAlert {
  header: string | null;
  description: string | null;
  url: string | null;
  routeIds: string[];
  stopIds: string[];
}

export interface RtEntity {
  id: string;
  tripUpdate: RtTripUpdate | null;
  vehicle: RtVehiclePosition | null;
  alert: RtAlert | null;
}

export interface RtFeed {
  version: string | null;
  /** Feed timestamp in seconds since epoch. */
  timestamp: number | null;
  entities: RtEntity[];
}

function readTrip(fields: Fields): RtTripDescriptor {
  return {
    tripId: getString(fields, 1),
    routeId: getString(fields, 5),
    startTime: getString(fields, 2),
    startDate: getString(fields, 3),
  };
}

function readStopTimeEvent(fields: Fields | null): { delay: number | null; time: number | null } {
  if (!fields) return { delay: null, time: null };
  return { delay: getInt(fields, 1), time: getInt(fields, 2) };
}

function readTripUpdate(fields: Fields): RtTripUpdate {
  const tripFields = getMessage(fields, 1);
  return {
    trip: tripFields ? readTrip(tripFields) : { tripId: null, routeId: null, startDate: null, startTime: null },
    timestamp: getUint(fields, 4),
    delaySec: getInt(fields, 5),
    stopTimeUpdates: getMessages(fields, 2).map((stu) => {
      const arrival = readStopTimeEvent(getMessage(stu, 2));
      const departure = readStopTimeEvent(getMessage(stu, 3));
      return {
        stopId: getString(stu, 4),
        stopSequence: getUint(stu, 1),
        arrivalDelaySec: arrival.delay,
        arrivalTime: arrival.time,
        departureDelaySec: departure.delay,
        departureTime: departure.time,
      };
    }),
  };
}

function readVehicle(fields: Fields): RtVehiclePosition {
  const tripFields = getMessage(fields, 1);
  const position = getMessage(fields, 2);
  const descriptor = getMessage(fields, 8);
  return {
    trip: tripFields ? readTrip(tripFields) : null,
    vehicleId: descriptor ? getString(descriptor, 1) : null,
    lat: position ? getFloat(position, 1) : null,
    lng: position ? getFloat(position, 2) : null,
    bearing: position ? getFloat(position, 3) : null,
    timestamp: getUint(fields, 5),
  };
}

/** TranslatedString -> the English translation, else the first one present. */
function readTranslated(fields: Fields | null): string | null {
  if (!fields) return null;
  const translations = getMessages(fields, 1);
  if (translations.length === 0) return null;
  const english = translations.find((t) => (getString(t, 2) ?? '').toLowerCase().startsWith('en'));
  return getString(english ?? translations[0], 1);
}

function readAlert(fields: Fields): RtAlert {
  const routeIds: string[] = [];
  const stopIds: string[] = [];
  for (const selector of getMessages(fields, 5)) {
    const routeId = getString(selector, 2);
    const stopId = getString(selector, 5);
    if (routeId) routeIds.push(routeId);
    if (stopId) stopIds.push(stopId);
  }
  return {
    header: readTranslated(getMessage(fields, 10)),
    description: readTranslated(getMessage(fields, 11)),
    url: readTranslated(getMessage(fields, 8)),
    routeIds,
    stopIds,
  };
}

export function decodeFeed(buffer: Uint8Array): RtFeed {
  const root = decodeMessage(buffer);
  const header = getMessage(root, 1);

  const entities: RtEntity[] = [];
  for (const entityFields of getMessages(root, 2)) {
    const tripUpdateFields = getMessage(entityFields, 3);
    const vehicleFields = getMessage(entityFields, 4);
    const alertFields = getMessage(entityFields, 5);
    entities.push({
      id: getString(entityFields, 1) ?? '',
      tripUpdate: tripUpdateFields ? readTripUpdate(tripUpdateFields) : null,
      vehicle: vehicleFields ? readVehicle(vehicleFields) : null,
      alert: alertFields ? readAlert(alertFields) : null,
    });
  }

  return {
    version: header ? getString(header, 1) : null,
    timestamp: header ? getUint(header, 3) : null,
    entities,
  };
}
