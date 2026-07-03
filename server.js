// Production entry for Hostinger Node.js (Passenger).
// Passenger loads this file and provides the port via process.env.PORT.
// next({dev:false}).prepare() boots the Next server AND runs
// instrumentation.ts (which starts the data-ingestion scheduler).
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const port = process.env.PORT || 3000;
const hostname = process.env.HOSTNAME || "0.0.0.0";
const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => handle(req, res, parse(req.url, true))).listen(
      port,
      () => {
        // eslint-disable-next-line no-console
        console.log(`> XAU Terminal (production) listening on ${port}`);
      },
    );
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to start server:", err);
    process.exit(1);
  });
