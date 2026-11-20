import { setDefaultResultOrder } from "node:dns";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import { attachDatabasePool } from "@vercel/functions";

setDefaultResultOrder("ipv4first");
neonConfig.webSocketConstructor = WebSocket;

class LifecycleNeonAdapter extends PrismaNeon {
  override async connect() {
    const adapter = await super.connect();
    if (process.env.VERCEL) attachDatabasePool(adapter.underlyingDriver());
    return adapter;
  }
}

export function createNeonAdapter(connectionString: string): PrismaNeon {
  const url = new URL(connectionString);
  if (!url.hostname.endsWith(".neon.tech")) {
    throw new Error("A Neon PostgreSQL connection URL is required.");
  }
  url.searchParams.set("sslmode", "verify-full");
  url.searchParams.delete("sslnegotiation");
  return new LifecycleNeonAdapter(
    { connectionString: url.toString(), max: 5, idleTimeoutMillis: 5000, connectionTimeoutMillis: 15000 },
    { schema: url.searchParams.get("schema") ?? "public" },
  );
}
