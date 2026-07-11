import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export function LedgerTrailIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 4v16" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeDasharray="2 3" />
      <Circle cx={8} cy={5} r={2.2} stroke={color} strokeWidth={1.8} />
      <Circle cx={8} cy={12} r={2.2} stroke={color} strokeWidth={1.8} />
      <Circle cx={8} cy={19} r={2.2} stroke={color} strokeWidth={1.8} />
      <Path d="M13 7h6M13 12h5M13 17h4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function UpiHandoffIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={1.8} />
      <Path d="M8 12h7M12 9l3 3-3 3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SplitWeightIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={12} width={3} height={7} rx={1.5} stroke={color} strokeWidth={1.8} />
      <Rect x={10.5} y={7} width={3} height={12} rx={1.5} stroke={color} strokeWidth={1.8} />
      <Rect x={17} y={4} width={3} height={15} rx={1.5} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}
