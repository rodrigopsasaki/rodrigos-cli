import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

function getVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packageJsonPath = join(__dirname, "..", "..", "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    return packageJson.version;
  } catch (error) {
    console.warn("Could not read version from package.json, falling back to unknown");
    return "unknown";
  }
}

export { getVersion };