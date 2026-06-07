import { onBeforeUnmount, ref } from "vue";

/**
 * Barcode scanning via the native `BarcodeDetector` API — zero dependency, fully
 * offline, no external service (true to Listo's constraints). It is only present
 * on Chromium-based browsers (Chrome/Edge/Android); elsewhere `supported` is
 * false and the UI falls back to manual entry. We never ship a heavy WASM decoder.
 */

interface DetectedBarcode {
  rawValue: string;
  format: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

const FORMATS = ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code", "itf"];

function detectorCtor(): BarcodeDetectorCtor | null {
  const g = globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  return typeof g.BarcodeDetector === "function" ? g.BarcodeDetector : null;
}

export function isScanSupported(): boolean {
  return (
    detectorCtor() !== null &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export function useBarcodeScanner() {
  const scanning = ref(false);
  const error = ref<string | null>(null);
  let stream: MediaStream | null = null;
  let raf = 0;
  let stopped = false;

  /** Start the rear camera and resolve with the first decoded value (or reject/cancel). */
  async function start(video: HTMLVideoElement, onResult: (value: string) => void): Promise<void> {
    const Ctor = detectorCtor();
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      error.value = "unsupported";
      return;
    }
    stopped = false;
    error.value = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      scanning.value = true;
      const detector = new Ctor({ formats: FORMATS });

      const tick = async (): Promise<void> => {
        if (stopped) return;
        try {
          const codes = await detector.detect(video);
          const hit = codes.find((c) => c.rawValue);
          if (hit) {
            onResult(hit.rawValue);
            stop();
            return;
          }
        } catch {
          /* transient decode frame error — keep going */
        }
        raf = requestAnimationFrame(() => void tick());
      };
      raf = requestAnimationFrame(() => void tick());
    } catch {
      error.value = "camera";
      stop();
    }
  }

  function stop(): void {
    stopped = true;
    scanning.value = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  onBeforeUnmount(stop);

  return { scanning, error, start, stop, supported: isScanSupported() };
}
