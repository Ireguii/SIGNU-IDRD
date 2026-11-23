import type { Point } from './api';

export type ParkMapProps = { point: Point | null; onPick: (point: Point) => void };
