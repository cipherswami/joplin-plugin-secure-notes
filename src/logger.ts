/*****************************************************************************
 * @file        : logger.ts
 * @description : Lightweight logger utility for Joplin plugins. Provides 
 *                prefixed and level-based console output for easier debugging 
 *                and log filtering.
 * @usage
 *   import { createLogger, LogLevel } from './logger';
 *   const logger = createLogger('[PluginName]', LogLevel.INFO);
 *   logger.info('Message');
 *
 *   Log filtering is controlled via DevTools console settings.
 *****************************************************************************/

/**
 * Log level enumeration. Lower values = more verbose.
 * @enum {number}
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * Logger class with configurable log levels.
 * @class
 */
export class Logger {
  private level: LogLevel;
  private prefix: string;

  constructor(level: LogLevel, prefix: string) {
    this.level = level;
    this.prefix = prefix;
  }

  debug(...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(this.prefix, 'DEBUG :', ...args);
    }
  }

  info(...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(this.prefix, 'INFO  :', ...args);
    }
  }

  warn(...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.prefix, 'WARN  :', ...args);
    }
  }

  error(...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(this.prefix, 'ERROR :', ...args);
    }
  }
}

/**
 * Creates a logger instance with the specified prefix and log level.
 * 
 * @param {string} prefix - Plugin identifier (e.g., '[MyPlugin]')
 * @param {LogLevel} [level=LogLevel.INFO] - Initial log level
 * @returns {Logger} Logger instance
 */
export function createLogger(prefix: string, level: LogLevel = LogLevel.INFO): Logger {
  return new Logger(level, prefix);
}