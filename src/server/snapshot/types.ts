/** One normalized delay reading, ready to persist. */
export interface DelayObservation {
  stopId: string;
  routeId: string | null;
  tripId: string;
  /** ISO-8601. Derived: predictedTime minus delaySec. */
  scheduledTime: string;
  /** ISO-8601. */
  predictedTime: string;
  delaySec: number;
  /** ISO-8601. When this poll observed the prediction, not when the trip runs. */
  observedAt: string;
}

export interface SnapshotSink {
  readonly name: string;
  write(rows: DelayObservation[]): Promise<void>;
}
