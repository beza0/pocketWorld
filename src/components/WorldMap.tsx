import React, { memo, useMemo } from 'react';
import { StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { geo } from '../data';
import { colors, radius } from '../theme';

const allLand = Object.values(geo.countries).map((c) => c.d).join('') ;

/** Static base layer: every landmass in one path. Rendered once and reused. */
const BaseLayer = memo(function BaseLayer({ stroke }: { stroke: number }) {
  return (
    <>
      <Path d={geo.other} fill={colors.land} opacity={0.7} />
      <Path d={allLand} fill={colors.land} stroke={colors.landLine} strokeWidth={stroke} strokeLinejoin="round" />
    </>
  );
});

export interface WorldMapProps {
  /** Country to emphasise (accent colour + marker ring for small countries). */
  highlight?: string | null;
  /** Countries painted as "discovered". */
  discovered?: readonly string[];
  /** Zoom to this country's region; null shows the whole world. */
  zoomTo?: string | null;
  aspectRatio?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * Label-free world map. Names are never drawn, so the map can be used as a quiz clue.
 * Small states and islands get a ring marker so they stay visible at any scale.
 */
export const WorldMap = memo(function WorldMap({ highlight, discovered, zoomTo, aspectRatio, style, accessibilityLabel }: WorldMapProps) {
  const box = zoomTo && geo.countries[zoomTo] ? geo.countries[zoomTo].z : geo.viewBox;
  const ratio = aspectRatio ?? (zoomTo ? 1.5 : geo.viewBox[2] / geo.viewBox[3]);
  // expand the view box to the container ratio so the ocean fills the whole frame
  const view = useMemo(() => {
    let [x, y, w, h] = box;
    if (w / h > ratio) { const nh = w / ratio; y -= (nh - h) / 2; h = nh; }
    else { const nw = h * ratio; x -= (nw - w) / 2; w = nw; }
    return [x, y, w, h] as const;
  }, [box, ratio]);
  const unit = view[2] / 360; // ≈ one CSS pixel on a phone
  const discoveredPath = useMemo(() => (discovered ?? []).filter((id) => id !== highlight && geo.countries[id]).map((id) => geo.countries[id].d).join(''), [discovered, highlight]);
  const smallDiscovered = useMemo(() => (discovered ?? []).filter((id) => id !== highlight && geo.countries[id]?.s), [discovered, highlight]);
  const hi = highlight ? geo.countries[highlight] : undefined;
  const ringR = Math.max(unit * 7, 1.2);

  return (
    <View style={[styles.frame, { aspectRatio: ratio }, style]} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Svg width="100%" height="100%" viewBox={view.join(' ')} preserveAspectRatio="xMidYMid slice">
        <Rect x={view[0]} y={view[1]} width={view[2]} height={view[3]} fill={colors.oceanWash} />
        <BaseLayer stroke={unit * 0.5} />
        {discoveredPath ? <Path d={discoveredPath} fill={colors.discovered} stroke={colors.card} strokeWidth={unit * 0.4} /> : null}
        {smallDiscovered.map((id) => (
          <Circle key={id} cx={geo.countries[id].c[0]} cy={geo.countries[id].c[1]} r={unit * 2.2} fill={colors.discovered} stroke={colors.card} strokeWidth={unit * 0.5} />
        ))}
        {hi ? <Path d={hi.d} fill={colors.accent} stroke={colors.ink} strokeWidth={unit * 0.6} strokeLinejoin="round" /> : null}
        {hi && (hi.s || !zoomTo) ? (
          <>
            {hi.s ? <Circle cx={hi.c[0]} cy={hi.c[1]} r={unit * 2} fill={colors.accent} /> : null}
            {hi.s || hi.z[2] < 200 ? <Circle cx={hi.c[0]} cy={hi.c[1]} r={ringR} fill="none" stroke={colors.accent} strokeWidth={unit * 1.6} /> : null}
            {hi.s || hi.z[2] < 200 ? <Circle cx={hi.c[0]} cy={hi.c[1]} r={ringR + unit * 1.4} fill="none" stroke={colors.ink} strokeWidth={unit * 0.5} opacity={0.6} /> : null}
          </>
        ) : null}
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.oceanWash, borderWidth: 1, borderColor: colors.line },
});
