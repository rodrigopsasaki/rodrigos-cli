import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager } from './config-manager.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Mock fs module
vi.mock('fs');
vi.mock('os');

const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockExistsSync = vi.mocked(existsSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockHomedir = vi.mocked(homedir);

describe('ConfigManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHomedir.mockReturnValue('/home/test');
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create default config when no config file exists', () => {
    const configManager = new ConfigManager();
    
    expect(configManager.getExtensionsDir()).toBe(join(process.cwd(), 'examples', 'extensions'));
    expect(configManager.getDefaultRunner()).toBe('node');
    expect(configManager.isLoggingEnabled()).toBe(true);
  });

  it('should load existing config file', () => {
    const mockConfig = {
      extensionsDir: '/custom/extensions',
      defaultRunner: 'python3',
      enableLogging: false,
    };

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('extensionsDir: /custom/extensions\ndefaultRunner: python3\nenableLogging: false');

    const configManager = new ConfigManager();
    
    expect(configManager.getExtensionsDir()).toBe('/custom/extensions');
    expect(configManager.getDefaultRunner()).toBe('python3');
    expect(configManager.isLoggingEnabled()).toBe(false);
  });

  it('should update config and save to file', () => {
    const configManager = new ConfigManager();
    
    configManager.updateConfig({
      extensionsDir: '/new/extensions',
      enableLogging: false,
    });

    expect(mockWriteFileSync).toHaveBeenCalled();
    expect(configManager.getExtensionsDir()).toBe('/new/extensions');
    expect(configManager.isLoggingEnabled()).toBe(false);
  });

  it('should handle config file read errors gracefully', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => {
      throw new Error('File read error');
    });

    const configManager = new ConfigManager();
    
    // Should fall back to defaults
    expect(configManager.getExtensionsDir()).toBe(join(process.cwd(), 'examples', 'extensions'));
    expect(configManager.getDefaultRunner()).toBe('node');
    expect(configManager.isLoggingEnabled()).toBe(true);
  });
}); 