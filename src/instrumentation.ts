// Next.js runs register() once when the server process boots.
// We start the ingestion scheduler here so `npm run dev` brings the
// whole data foundation up with no separate worker to babysit.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startIngestion } = await import("@/ingestion/scheduler");
    startIngestion();
  }
}
