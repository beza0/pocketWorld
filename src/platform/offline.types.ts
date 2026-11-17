export type OfflineState =
  | 'bundled' // native: base pack ships inside the app
  | 'unsupported' // browser without service worker / cache storage, or a dev server
  | 'not-ready'
  | 'downloading'
  | 'verifying'
  | 'ready'
  | 'update-available' // an older complete pack is active; a newer one can be downloaded
  | 'failed';

export interface OfflineStatus {
  state: OfflineState;
  /** 0..1 while downloading. */
  progress: number;
  /** Measured size of the base pack in bytes (content only). */
  packBytes: number;
  /** Measured size of the on-demand large photo cache in bytes; null when it cannot be measured. */
  photoCacheBytes: number | null;
  version: string | null;
}

export interface OfflineAdapter {
  getStatus(): Promise<OfflineStatus>;
  /** Downloads and verifies the whole pack. Resolves with the final status. */
  prepare(onProgress: (status: OfflineStatus) => void): Promise<OfflineStatus>;
  /** Removes on-demand large photos only. Base content and progress are untouched. */
  clearPhotoCache(): Promise<void>;
  /** Registers background machinery (service worker). Safe to call repeatedly. */
  init(): void;
}
