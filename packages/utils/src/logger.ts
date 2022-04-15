import winston, { loggers, Logger, transports, config } from 'winston';

const LOG_DIR = process.env.LOG_DIR || require('electron')?.app?.getPath('logs') || './';

const consoleTransport = (name: string) =>
	new transports.Console({
		level: 'debug',
		format: winston.format.combine(
			winston.format.splat(),
			winston.format.colorize({
				all: true,
			}),
			winston.format.label({
				label: `[${name}]`,
			}),
			winston.format.timestamp({
				format: 'YY-MM-DD HH:mm:ss',
			}),
			winston.format.printf(
				info => `[${info.timestamp}]${info.label}[${info.level}] ${info.message}`,
			),
		),
	});

const fileTransport = (name: string, module: string) =>
	new transports.File({
		level: 'debug',
		format: winston.format.combine(
			winston.format.splat(),
			winston.format.label({
				label: `[${name}]`,
			}),
			winston.format.timestamp({
				format: 'YY-MM-DD HH:mm:ss',
			}),
			winston.format.printf(
				info => `[${info.timestamp}]${info.label}[${info.level}] ${info.message}`,
			),
		),
		dirname: LOG_DIR,
		filename: `${module}.log`,
	});

/**
 * Get logger by name
 * @param name logger name
 * @returns logger instance
 */
export function getLogger(name: string, module: string = 'main'): Logger {
	return loggers.get(name, {
		levels: config.syslog.levels,
		transports: [consoleTransport(name), fileTransport(name, module)],
	});
}

export { Logger };
