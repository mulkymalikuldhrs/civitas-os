import { ping } from "bedrock-protocol";
import dns from "node:dns/promises";

const addrs = await dns.resolve4("mulkymalikuldhr.aternos.me");
console.log("ADDRESSES:", addrs.join(", "));
for (const ip of addrs.slice(0, 3)) {
  const st = await ping({ host: ip, port: 19132, timeout: 6000 }).catch((e) => ({ error: String(e?.message || e) }));
  console.log(ip, "→", JSON.stringify(st).slice(0, 160));
}
