import { join } from "path";
import { homedir } from "os";

/**
 * XDG Base Directory Specification implementation
 * 
 * This class provides standardized paths for configuration, data, and cache files
 * following the XDG Base Directory Specification (https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html)
 * 
 * Key directories:
 * - XDG_CONFIG_HOME: User-specific configuration files (~/.config)
 * - XDG_DATA_HOME: User-specific data files (~/.local/share)
 * - XDG_CACHE_HOME: User-specific cache files (~/.cache)
 * - XDG_STATE_HOME: User-specific state files (~/.local/state)
 */
export class XDGPaths {
  private static readonly APP_NAME = "rc";

  /**
   * Get the configuration home directory
   * Default: ~/.config
   * Environment variable: XDG_CONFIG_HOME
   */
  static getConfigHome(): string {
    return process.env["XDG_CONFIG_HOME"] || join(homedir(), ".config");
  }

  /**
   * Get the data home directory
   * Default: ~/.local/share
   * Environment variable: XDG_DATA_HOME
   */
  static getDataHome(): string {
    return process.env["XDG_DATA_HOME"] || join(homedir(), ".local", "share");
  }

  /**
   * Get the cache home directory
   * Default: ~/.cache
   * Environment variable: XDG_CACHE_HOME
   */
  static getCacheHome(): string {
    return process.env["XDG_CACHE_HOME"] || join(homedir(), ".cache");
  }

  /**
   * Get the state home directory
   * Default: ~/.local/state
   * Environment variable: XDG_STATE_HOME
   */
  static getStateHome(): string {
    return process.env["XDG_STATE_HOME"] || join(homedir(), ".local", "state");
  }

  /**
   * Get the application-specific configuration directory
   * Returns: ~/.config/rc/
   */
  static getAppConfigDir(): string {
    return join(this.getConfigHome(), this.APP_NAME);
  }

  /**
   * Get the application-specific data directory
   * Returns: ~/.local/share/rc/
   */
  static getAppDataDir(): string {
    return join(this.getDataHome(), this.APP_NAME);
  }

  /**
   * Get the application-specific cache directory
   * Returns: ~/.cache/rc/
   */
  static getAppCacheDir(): string {
    return join(this.getCacheHome(), this.APP_NAME);
  }

  /**
   * Get the application-specific state directory
   * Returns: ~/.local/state/rc/
   */
  static getAppStateDir(): string {
    return join(this.getStateHome(), this.APP_NAME);
  }

  /**
   * Get the main configuration file path
   * Returns: ~/.config/rc/config.yaml
   */
  static getConfigFile(): string {
    return join(this.getAppConfigDir(), "config.yaml");
  }

  /**
   * Get the extensions directory path
   * Returns: ~/.local/share/rc/extensions/
   */
  static getExtensionsDir(): string {
    return join(this.getAppDataDir(), "extensions");
  }

  /**
   * Get the namespaces directory path
   * Returns: ~/.local/share/rc/namespaces/
   */
  static getNamespacesDir(): string {
    return join(this.getAppDataDir(), "namespaces");
  }

  /**
   * Get a specific namespace directory path
   * Returns: ~/.local/share/rc/namespaces/{namespace}/
   */
  static getNamespaceDir(namespace: string): string {
    return join(this.getNamespacesDir(), namespace);
  }

  /**
   * Get the cache file path for extension metadata
   * Returns: ~/.cache/rc/extensions.json
   */
  static getExtensionsCacheFile(): string {
    return join(this.getAppCacheDir(), "extensions.json");
  }

  /**
   * Get the state file path for runtime state
   * Returns: ~/.local/state/rc/state.json
   */
  static getStateFile(): string {
    return join(this.getAppStateDir(), "state.json");
  }

  /**
   * Get all XDG directories for the application
   * Useful for setup and debugging
   */
  static getAllAppDirs(): Record<string, string> {
    return {
      config: this.getAppConfigDir(),
      data: this.getAppDataDir(),
      cache: this.getAppCacheDir(),
      state: this.getAppStateDir(),
      extensions: this.getExtensionsDir(),
      namespaces: this.getNamespacesDir(),
      configFile: this.getConfigFile(),
      cacheFile: this.getExtensionsCacheFile(),
      stateFile: this.getStateFile(),
    };
  }

} 