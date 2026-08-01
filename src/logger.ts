/*****************************************************************************
 * @file        : src/logger.ts
 * @description : Lightweight logger utility for Joplin plugins. Provides
 *                prefixed and level-based console output for easier debugging
 *                and log filtering.
 * @usage
 *   import { createLogger } from 'logger';
 *   const logger = createLogger('[PluginName]', 'INFO');
 *   logger.info('Message');
 *
 *   Log filtering is controlled via DevTools console settings.
 *****************************************************************************/

/**
 * Log level type. Controls verbosity of output.
 * @type {'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE'}
 */
export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "NONE";

/**
 * Logger class with configurable log levels.
 * @class
 */
export class Logger {
  private prefix: string;
  private level: LogLevel;

  private readonly order: LogLevel[] = [
    "DEBUG",
    "INFO",
    "WARN",
    "ERROR",
    "NONE",
  ];

  constructor(prefix: string, level: LogLevel) {
    this.prefix = prefix;
    this.level = level;
  }

  private shouldLog(target: LogLevel): boolean {
    return this.order.indexOf(this.level) <= this.order.indexOf(target);
  }

  debug(...args: any[]): void {
    if (this.shouldLog("DEBUG")) console.debug(this.prefix, "DEBUG :", ...args);
  }

  info(...args: any[]): void {
    if (this.shouldLog("INFO")) console.info(this.prefix, "INFO  :", ...args);
  }

  warn(...args: any[]): void {
    if (this.shouldLog("WARN")) console.warn(this.prefix, "WARN  :", ...args);
  }

  error(...args: any[]): void {
    if (this.shouldLog("ERROR")) console.error(this.prefix, "ERROR :", ...args);
  }
}

/**
 * Creates a logger instance with the specified prefix and log level.
 *
 * @param {string} prefix - Plugin identifier (e.g., '[MyPlugin]')
 * @param {LogLevel} [level='INFO'] - Initial log level
 * @returns {Logger} Logger instance
 */
export function createLogger(prefix: string, level: LogLevel = "INFO"): Logger {
  return new Logger(prefix, level);
}
