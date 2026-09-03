import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../constants';

let width = DESIGN_WIDTH;
let height = DESIGN_HEIGHT;
let scale = 1;
let offsetX = 0;
let offsetY = 0;

export function setViewport(nextWidth: number, nextHeight: number): void {
  width = nextWidth;
  height = nextHeight;
  scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
  offsetX = (width - DESIGN_WIDTH * scale) / 2;
  offsetY = (height - DESIGN_HEIGHT * scale) / 2;
}

export const sx = (x: number): number => offsetX + x * scale;
export const sy = (y: number): number => offsetY + y * scale;
export const sd = (value: number): number => value * scale;
export const getViewport = (): { width: number; height: number } => ({ width, height });
