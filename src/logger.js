'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOGS_DIR = path.join(__dirname, '..', 'logs');

const logger = createLogger({
  level: LOG_LEVEL,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, stack }) => {
      const base = `${timestamp} [${level.toUpperCase()}] ${message}`;
      return stack ? `${base}\n${stack}` : base;
    })
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(({ timestamp, level, message, stack }) => {
          const base = `${timestamp} [${level}] ${message}`;
          return stack ? `${base}\n${stack}` : base;
        })
      ),
    }),
    new transports.File({
      filename: path.join(LOGS_DIR, 'error.log'),
      level: 'error',
    }),
    new transports.File({
      filename: path.join(LOGS_DIR, 'combined.log'),
    }),
  ],
});

module.exports = logger;
