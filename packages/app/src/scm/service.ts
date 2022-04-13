import { ChildProcess } from 'child_process';
import EventEmitter from 'events';
import { ServiceChannel } from './channel';
import { getLogger, Logger } from '../logger';

export class Service extends EventEmitter {
	public readonly channel: ServiceChannel;
	private _logger: Logger;
	private _childProcess: ChildProcess;

	public get process(): ChildProcess {
		return this._childProcess;
	}

	/**
	 * create service with script absolute full path
	 * @param scriptPath
	 * @param args
	 */
	constructor(name: string, childProcess: ChildProcess) {
		super();

		this._logger = getLogger(name);

		this._childProcess = childProcess;

		this.channel = new ServiceChannel(childProcess, this._logger);

		this.channel.on('notification', (method, args) => {
			this.onMessage(method, args);
		});
	}

	private onMessage(method: string, params: any[]) {
		if (method.startsWith('log-')) {
			const levels = method.split('-');
			this._logger.log({
				level: levels[1],
				message: params
					.map(it => {
						if (it instanceof Object) {
							return JSON.stringify(it);
						}

						return it;
					})
					.join(' '),
			});
		} else {
			this.emit(method, ...params);
		}
	}

	public handle(method: string, callback: (...params: any[]) => Promise<any>) {
		this.channel.handle(method, callback);
	}

	public async request(method: string, ...params: any[]): Promise<any> {
		return await this.channel.request(method, ...params);
	}

	/**
	 * send with non-return
	 * @param params
	 */
	send(method: string, ...params: any[]) {
		this.channel.send(method, ...params);
	}

	public stop(): boolean {
		return this._childProcess.kill();
	}
}
