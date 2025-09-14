// utils/generate-pin.ts
import { randomInt } from 'crypto';

export function generatePin4(): string {
  return randomInt(0, 10_000).toString().padStart(4, '0');
}
