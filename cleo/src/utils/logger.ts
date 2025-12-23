import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      const logMessage = `${timestamp} [${level.toUpperCase()}] ${message}`;
      return stack ? `${logMessage}\n${stack}` : logMessage;
    })
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
