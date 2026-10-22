// Preparing Library files on the device before upload.

export const MAX_FILE = 8 * 1024 * 1024;

const readAs = (f: Blob, how: 'dataURL' | 'arrayBuffer') => new Promise<string | ArrayBuffer>((ok, no) => {
  const r = new FileReader();
  r.onload = () => ok(r.result!);
  r.onerror = () => no(r.error);
  if (how === 'dataURL') r.readAsDataURL(f); else r.readAsArrayBuffer(f);
});

const toBase64 = async (f: Blob) => (await readAs(f, 'dataURL') as string).split(',')[1];

async function loadImage(f: Blob) {
  const url = URL.createObjectURL(f);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function draw(img: HTMLImageElement, max: number, quality: number) {
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

/** Photos are resized to 2000px and saved as JPEG, with a small preview; PDFs go up as they are. */
export async function prepareFile(f: File): Promise<{ mime: string; body: string; size: number; thumb?: string }> {
  if (f.type.startsWith('image/')) {
    const img = await loadImage(f);
    const full = draw(img, 2000, 0.85), thumb = draw(img, 200, 0.7);
    const body = full.split(',')[1];
    return { mime: 'image/jpeg', body, size: Math.round((body.length * 3) / 4), thumb };
  }
  if (f.size > MAX_FILE) throw new Error(`${f.name} is larger than 8 MB.`);
  return { mime: f.type || 'application/octet-stream', body: await toBase64(f), size: f.size };
}

export const b64ToBlob = (b64: string, mime: string) => {
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

export const kb = (n: number) => (n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
