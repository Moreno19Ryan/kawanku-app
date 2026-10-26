import type { Instrumentation } from "next";

/**
 * Pemantau galat: setiap galat server (render, route handler, Server
 * Action, proxy) dicatat ke tabel galat_aplikasi dan dirangkum di Panel
 * pengembang (docs/asisten.md).
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { catatGalatServer } = await import("@/lib/sistem/galat");
  const pesan = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : null;
  await catatGalatServer({
    sumber: "server",
    pesan,
    rute: context.routePath || request.path,
    jenis: context.routeType,
    digest,
  });
};
