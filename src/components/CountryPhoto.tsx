import { Image } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { attributions, photoAssets } from '../data';
import { colors, fonts, radius } from '../theme';

/**
 * Country photo. The compressed base-pack image is always shown first (works offline). When
 * `hiRes` is set, the large rendition is loaded on top; if it cannot be loaded the small one stays.
 * `children` are drawn over a dark bottom gradient for legibility; games pass none, so nothing leaks.
 */
export function CountryPhoto({ id, hiRes, label, aspectRatio = 3 / 2, style, missingLabel, children }: {
  id: string; hiRes?: boolean; label?: string; aspectRatio?: number; style?: StyleProp<ViewStyle>; missingLabel?: string; children?: React.ReactNode;
}) {
  const [bigFailed, setBigFailed] = useState(false);
  const base = photoAssets[id];
  const remote = attributions[id]?.hiRes;
  return (
    <View style={[styles.frame, { aspectRatio }, style]}>
      {base ? (
        <Image source={base} style={StyleSheet.absoluteFill} contentFit="cover" accessible={!!label} accessibilityLabel={label} accessibilityRole="image" transition={0} />
      ) : (
        <View style={styles.missing}><Text style={styles.missingText}>{missingLabel ?? ''}</Text></View>
      )}
      {hiRes && remote && !bigFailed ? (
        <Image source={{ uri: remote }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" transition={250} onError={() => setBigFailed(true)} accessible={false} />
      ) : null}
      {children ? (
        <>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
            <Defs>
              <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.35" stopColor="#0A1224" stopOpacity="0" />
                <Stop offset="1" stopColor="#0A1224" stopOpacity="0.82" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#scrim)" />
          </Svg>
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">{children}</View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.paperDeep },
  missing: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  missingText: { color: colors.inkSoft, fontFamily: fonts.body },
});
