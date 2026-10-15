import { Camera, CameraResultType, CameraSource, type PermissionStatus } from "@capacitor/camera";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";

export type MediaPermissionType = "camera" | "photos" | "notifications" | "microphone";

export interface MediaPermissionsState {
  camera: "granted" | "denied" | "prompt" | "prompt-with-rationale" | "limited";
  photos: "granted" | "denied" | "prompt" | "prompt-with-rationale" | "limited";
}

/**
 * Checks notification permission status.
 */
export async function checkNotificationPermission(): Promise<"granted" | "denied" | "prompt"> {
  if (!Capacitor.isNativePlatform()) return "granted";
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === "granted") return "granted";
    if (status.display === "denied") return "denied";
    return "prompt";
  } catch (err) {
    console.warn("[mediaPermissions] checkNotificationPermission failed:", err);
    return "prompt";
  }
}

/**
 * Requests notification permission.
 */
export async function requestAppNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const res = await LocalNotifications.requestPermissions();
    return res.display === "granted";
  } catch (err) {
    console.warn("[mediaPermissions] requestAppNotificationPermission failed:", err);
    return false;
  }
}

/**
 * Checks microphone permission status.
 */
export async function checkMicrophonePermission(): Promise<"granted" | "denied" | "prompt"> {
  if (!Capacitor.isNativePlatform()) return "granted";
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
      if (status.state === "granted") return "granted";
      if (status.state === "denied") return "denied";
      return "prompt";
    }
  } catch {
    // navigator.permissions.query for microphone may fail in some WebViews
  }
  return "prompt";
}

/**
 * Requests microphone permission via getUserMedia.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    }
    return false;
  } catch (err) {
    console.warn("[mediaPermissions] requestMicrophonePermission failed:", err);
    return false;
  }
}

/**
 * Opens the native iOS or Android system settings page for Accrual.
 */
export function openAppSettings(): void {
  try {
    if (Capacitor.isNativePlatform()) {
      window.location.href = "app-settings:";
    }
  } catch (err) {
    console.warn("[mediaPermissions] Failed to open app settings:", err);
  }
}

/**
 * Checks whether Trouvaille currently has access to the device camera and photo library.
 */
export async function checkMediaPermissions(): Promise<MediaPermissionsState> {
  if (!Capacitor.isNativePlatform()) {
    // In web browsers, photo input via <input type="file"> is accessible without pre-prompting
    return {
      camera: "granted",
      photos: "granted",
    };
  }

  try {
    const status: PermissionStatus = await Camera.checkPermissions();
    return {
      camera: status.camera,
      photos: status.photos,
    };
  } catch (err) {
    console.warn("[mediaPermissions] checkPermissions failed:", err);
    return {
      camera: "prompt",
      photos: "prompt",
    };
  }
}

/**
 * Explicitly requests permission to access the device photo library / gallery.
 */
export async function requestPhotosPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;

  try {
    const status = await Camera.requestPermissions({ permissions: ["photos"] });
    return status.photos === "granted" || status.photos === "limited";
  } catch (err) {
    console.warn("[mediaPermissions] requestPhotosPermission failed:", err);
    return false;
  }
}

/**
 * Explicitly requests permission to access the device camera.
 */
export async function requestCameraPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;

  try {
    const status = await Camera.requestPermissions({ permissions: ["camera"] });
    return status.camera === "granted";
  } catch (err) {
    console.warn("[mediaPermissions] requestCameraPermission failed:", err);
    return false;
  }
}

export interface CapturedMediaResult {
  blob: Blob;
  previewUrl: string;
}

/**
 * Captures a new photo directly from the native camera.
 * Returns null if the user cancelled the capture.
 * Throws an Error with name "CameraPermissionError" if permission is denied.
 */
export async function capturePhotoFromCamera(): Promise<CapturedMediaResult | null> {
  if (!Capacitor.isNativePlatform()) {
    // On web, signal caller to trigger HTML input fallback
    return null;
  }

  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      correctOrientation: true,
    });

    if (!photo.webPath) return null;

    const response = await fetch(photo.webPath);
    const blob = await response.blob();

    return {
      blob,
      previewUrl: photo.webPath,
    };
  } catch (err: any) {
    const message = (err?.message || "").toLowerCase();
    if (message.includes("cancelled") || message.includes("cancel")) {
      return null;
    }
    if (message.includes("denied") || message.includes("permission") || message.includes("access")) {
      const permErr = new Error("Camera permission was denied");
      permErr.name = "CameraPermissionError";
      throw permErr;
    }
    throw err;
  }
}

/**
 * Selects an existing photo directly from the native photo library / gallery.
 * Returns null if the user cancelled the picker.
 * Throws an Error with name "PhotosPermissionError" if permission is denied.
 */
export async function pickPhotoFromGallery(): Promise<CapturedMediaResult | null> {
  if (!Capacitor.isNativePlatform()) {
    // On web, signal caller to trigger HTML input fallback
    return null;
  }

  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos,
      correctOrientation: true,
    });

    if (!photo.webPath) return null;

    const response = await fetch(photo.webPath);
    const blob = await response.blob();

    return {
      blob,
      previewUrl: photo.webPath,
    };
  } catch (err: any) {
    const message = (err?.message || "").toLowerCase();
    if (message.includes("cancelled") || message.includes("cancel")) {
      return null;
    }
    if (message.includes("denied") || message.includes("permission") || message.includes("access")) {
      const permErr = new Error("Photo library permission was denied");
      permErr.name = "PhotosPermissionError";
      throw permErr;
    }
    throw err;
  }
}
