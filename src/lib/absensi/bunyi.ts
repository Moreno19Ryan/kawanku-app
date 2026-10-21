export type JenisBunyi = "berhasil" | "sudah" | "gagal";

/**
 * Bunyi hasil absen (nada tinggi): berhasil = 1 beep pendek, sudah absen =
 * 2 beep pendek, gagal = 1 beep panjang. Hanya di browser.
 */
export function bunyi(j: JenisBunyi) {
  try {
    const ctx = new AudioContext();
    const pola: [number, number][] =
      j === "berhasil" ? [[0, 0.12]] : j === "sudah" ? [[0, 0.1], [0.18, 0.1]] : [[0, 0.6]];
    for (const [mulai, lama] of pola) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + mulai);
      osc.stop(ctx.currentTime + mulai + lama);
    }
    setTimeout(() => void ctx.close(), 1000);
  } catch {
    // Browser tanpa Web Audio: abaikan.
  }
}
