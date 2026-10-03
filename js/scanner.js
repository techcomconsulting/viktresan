// Läser streckkoder med kameran.
// Använder mobilens inbyggda läsare om den finns, annars ZXing (fungerar på iPhone).

const ZXING = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.2.1/+esm';
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

export async function startScanner(video, onCode) {
  let stopped = false;
  let stream = null;
  let timer = null;
  let controls = null;
  const done = (code) => {
    if (stopped) return;
    const c = String(code).replace(/\D/g, '');
    if (c.length < 8) return;
    onCode(c);
  };

  const constraints = { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } };

  let native = null;
  if ('BarcodeDetector' in window) {
    try {
      const ok = await window.BarcodeDetector.getSupportedFormats();
      const fmts = FORMATS.filter((f) => ok.includes(f));
      if (fmts.length) native = new window.BarcodeDetector({ formats: fmts });
    } catch { native = null; }
  }

  if (native) {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    await video.play().catch(() => {});
    const tick = async () => {
      if (stopped) return;
      try {
        const found = await native.detect(video);
        if (found && found[0]) done(found[0].rawValue);
      } catch { /* försök igen */ }
      timer = setTimeout(tick, 200);
    };
    tick();
  } else {
    const { BrowserMultiFormatReader } = await import(ZXING);
    const reader = new BrowserMultiFormatReader();
    controls = await reader.decodeFromConstraints(constraints, video, (res) => { if (res) done(res.getText()); });
    stream = video.srcObject;
  }

  const track = stream && stream.getVideoTracks ? stream.getVideoTracks()[0] : null;
  const caps = track && track.getCapabilities ? track.getCapabilities() : {};
  let torchOn = false;

  return {
    hasTorch: !!caps.torch,
    async toggleTorch() {
      if (!track) return false;
      torchOn = !torchOn;
      try { await track.applyConstraints({ advanced: [{ torch: torchOn }] }); } catch { torchOn = false; }
      return torchOn;
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      try { controls && controls.stop(); } catch { /* ok */ }
      try { stream && stream.getTracks().forEach((t) => t.stop()); } catch { /* ok */ }
      video.srcObject = null;
    }
  };
}
