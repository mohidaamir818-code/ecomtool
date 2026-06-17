import fs from "fs";
import path from "path";

/**
 * Loads .env.local then .env into process.env (without overwriting existing vars).
 * Use from local debug scripts only — never import from app source.
 */
export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const envPath = path.join(process.cwd(), file);
    if (!fs.existsSync(envPath)) continue;

    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;

      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

export function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith("your-")) {
    console.error(`Missing required environment variable: ${name}`);
    console.error("Set it in .env.local (see .env.example).");
    process.exit(1);
  }
  return value;
}
