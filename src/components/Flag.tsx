import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { flagAssets } from '../data';
import { colors } from '../theme';

/** Bundled flag image (4:3). `label` is omitted in quizzes so screen readers do not reveal the answer. */
export function Flag({ id, width = 64, label, style }: { id: string; width?: number | `${number}%`; label?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.frame, { width }, style]}>
      <Image source={flagAssets[id]} style={styles.image} contentFit="cover" accessible={!!label} accessibilityLabel={label} accessibilityRole="image" transition={0} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 4 / 3, borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paperDeep },
  image: { width: '100%', height: '100%' },
});
