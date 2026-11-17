import { Image } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { attributions, photoAssets } from '../data';
import { colors, fonts, radius, space } from '../theme';

/**
 * Country photo. The compressed base-pack image is always shown first (works offline). When
 * `hiRes` is set, the large rendition is loaded on top; if it cannot be loaded the small one stays.
 * `caption` is drawn over a dark scrim for legibility; games pass no caption so nothing leaks.
 */
export function CountryPhoto({ id, hiRes, caption, sub, aspectRatio = 3 / 2, style, missingLabel }: {
  id: string; hiRes?: boolean; caption?: string; sub?: string; aspectRatio?: number; style?: StyleProp<ViewStyle>; missingLabel?: string;
}) {
  const [bigFailed, setBigFailed] = useState(false);
  const base = photoAssets[id];
  const remote = attributions[id]?.hiRes;
  return (
    <View style={[styles.frame, { aspectRatio }, style]}>
      {base ? (
        <Image source={base} style={StyleSheet.absoluteFill} contentFit="cover" accessible={!!caption} accessibilityLabel={caption} accessibilityRole="image" transition={0} />
      ) : (
        <View style={styles.missing}><Text style={styles.missingText}>{missingLabel ?? ''}</Text></View>
      )}
      {hiRes && remote && !bigFailed ? (
        <Image source={{ uri: remote }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" transition={250} onError={() => setBigFailed(true)} accessible={false} />
      ) : null}
      {caption ? (
        <View style={styles.scrim}>
          <Text style={styles.caption} numberOfLines={2}>{caption}</Text>
          {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.paperDeep },
  missing: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  missingText: { color: colors.inkSoft, fontFamily: fonts.body },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md, backgroundColor: 'rgba(10,18,36,0.62)' },
  caption: { color: colors.white, fontFamily: fonts.display, fontSize: 22, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  sub: { color: '#E8EEF7', fontFamily: fonts.body, fontSize: 13, marginTop: 2, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
});
