import "server-only";
import { headers } from "next/headers";

/** Alamat aplikasi yang sedang dibuka (mis. https://kawanku-app.vercel.app), dari header permintaan. */
export async function alamatSitus(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
