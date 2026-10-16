import app from "./app";
import { logger } from "./lib/logger";
import { purgeExpiredEnquiries } from "./lib/privacy";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const host = process.env.API_HOST ?? "127.0.0.1";

const server = app.listen(port, host, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port, host }, "Server listening");

  const sweepRetention = () => {
    void purgeExpiredEnquiries()
      .then((removedCount) => {
        if (removedCount > 0) {
          logger.info({ removedCount }, "Purged expired customer enquiries");
        }
      })
      .catch((error: unknown) => {
        logger.error({ err: error }, "Enquiry retention sweep failed");
      });
  };
  sweepRetention();
  const retentionTimer = setInterval(sweepRetention, 24 * 60 * 60 * 1000);
  retentionTimer.unref();
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down API");
  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await pool.end();
  } catch (error) {
    logger.error({ err: error }, "Error while shutting down API");
    process.exitCode = 1;
  }
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
