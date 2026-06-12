import { ConfigError, type Config } from "../config.js";
import type { Db } from "../db/index.js";
import type { Logger } from "../logger.js";
import { UserError, countUsers, createUser } from "./users.js";

/**
 * Ensure the instance has at least one account. On a fresh DB (no users yet),
 * mint the admin from ADMIN_USERNAME/ADMIN_PASSWORD. With users already present,
 * the env vars are ignored — credentials are managed in-app from then on. A
 * fresh DB with no admin env is fatal: an instance with zero accounts can never
 * be logged into or mint invitations.
 */
export function bootstrapAdmin(db: Db, config: Config, logger: Logger): void {
  if (countUsers(db) > 0) return;

  if (!config.adminUsername || !config.adminPassword) {
    throw new ConfigError(
      "No accounts exist yet — set ADMIN_USERNAME and ADMIN_PASSWORD (or ADMIN_PASSWORD_FILE) " +
        "to create the first admin account on this fresh instance.",
    );
  }

  try {
    const admin = createUser(db, {
      username: config.adminUsername,
      password: config.adminPassword,
      isAdmin: true,
    });
    logger.info("bootstrapped admin account", { username: admin.username });
  } catch (err) {
    if (err instanceof UserError) {
      throw new ConfigError(`Cannot bootstrap admin account: ${err.message}`);
    }
    throw err;
  }
}
