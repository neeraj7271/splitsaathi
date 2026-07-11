import { chartPalette } from "../theme/chartPalette";

export function participantColor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }

  return chartPalette[hash % chartPalette.length];
}
