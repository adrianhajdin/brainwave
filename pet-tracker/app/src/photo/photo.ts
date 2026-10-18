/**
 * Picking and cropping cat photos. The picker's own editor only crops
 * squares, so we pick the full photo and crop it ourselves in a circle that
 * matches the avatar (see PhotoCropper).
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { CropRect } from './geometry';

export type { CropRect } from './geometry';

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

/** Longest side kept for cropping: enough detail, light enough to pan smoothly. */
const WORK_PX = 2000;
/** Stored avatar size. */
const AVATAR_PX = 512;

export async function pickPhoto(source: 'library' | 'camera'): Promise<PickedImage | null> {
  const perm =
    source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error(`Permission to use the ${source === 'camera' ? 'camera' : 'photo library'} was not granted.`);
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: 1 };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = res.canceled ? undefined : res.assets[0];
  if (!asset) return null;

  // Re-encode once: applies the camera's rotation (EXIF) so width and height
  // are what we see, and shrinks very large photos.
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > WORK_PX) {
    ctx.resize(asset.width >= asset.height ? { width: WORK_PX } : { height: WORK_PX });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Cuts the chosen square out and resizes it for upload. Shown in a circle everywhere. */
export async function cropAvatar(image: PickedImage, rect: CropRect): Promise<string> {
  const ctx = ImageManipulator.manipulate(image.uri);
  ctx.crop(rect);
  ctx.resize({ width: AVATAR_PX });
  const out = await ctx.renderAsync();
  const saved = await out.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
  return saved.uri;
}
