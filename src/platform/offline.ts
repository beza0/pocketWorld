import { Image } from 'expo-image';
import { contentMeta } from '../data';
import type { OfflineAdapter, OfflineStatus } from './offline.types';

/** iOS / Android: the base pack is bundled with the binary, so it is always available. */
const status = (): OfflineStatus => ({
  state: 'bundled',
  progress: 1,
  packBytes: contentMeta.totalBytes,
  photoCacheBytes: null, // expo-image does not expose its disk cache size
  version: contentMeta.contentVersion,
});

export const offline: OfflineAdapter = {
  getStatus: async () => status(),
  prepare: async () => status(),
  async clearPhotoCache() {
    await Image.clearDiskCache();
    await Image.clearMemoryCache();
  },
  init() {},
};
