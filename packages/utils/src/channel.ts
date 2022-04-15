import { ChildProcess, fork } from 'child_process';
import EventEmitter from 'events';
import { Logger } from 'winston';

export interface ServiceRequest {
	id?: number;
	method: string;
	params: any[];
}

export interface ServiceResponse {
	id?: number;
	method: string;
	result?: any[];
	error?: any;
}

export class ServiceChannel extends EventEmitter {
	private _child?: ChildProcess;

	private _callbacks = new Map<number, { resolve: any; reject: any }>();

	private _seq = 1;

	private _handles = new Map<string, (...params: any[]) => Promise<any>>();

	private _logger?: Logger;

	constructor(child?: ChildProcess, logger?: Logger) {
		super();

		this._logger = logger;

		this._child = child;

		if (this._child) {
			this._child.on('error', (err: Error) => {
				this._logger?.error(`${err}`);
			});

			this._child.on('message', (message: any) => {
				this._process(message);
			});
		} else {
			process.on('message', message => {
				this._process(message);
			});
		}
	}

	handle(method: string, callback: (...params: any[]) => Promise<any>) {
		this._handles.set(method, callback);
	}

	private _sendResponse(error: Error | undefined, id: number, value: any) {
		if (this._child) {
			if (error) {
				this._child.send({
					id: id,
					error: error.message,
				});
			} else {
				this._child.send({
					id: id,
					result: value,
				});
			}
		} else {
			if (error) {
				process.send!({
					id: id,
					error: error.message,
				});
			} else {
				process.send!({
					id: id,
					result: value,
				});
			}
		}
	}

	private _process(message: any) {
		if (message.params) {
			const req = message as ServiceRequest;

			if (req.id) {
				const callback = this._handles.get(req.method);

				if (!callback) {
					this._sendResponse(
						new Error(`call not register handle(${req.method})`),
						req.id!,
						null,
					);

					return;
				}

				// do call async handle
				callback(...req.params)
					.then(result => {
						this._sendResponse(undefined, req.id!, result);
					})
					.catch(error => {
						this._sendResponse(error, req.id!, null);
					});
			} else {
				this.emit('notification', req.method, req.params);
				this.emit(req.method, ...req.params);
			}
		} else {
			const resp = message as ServiceResponse;

			if (!resp.id) {
				return;
			}

			const callback = this._callbacks.get(resp.id);

			if (callback) {
				this._callbacks.delete(resp.id);

				if (resp.error) {
					callback.reject(new Error(resp.error));
				} else {
					callback.resolve(resp.result);
				}
			}
		}
	}

	/**
	 * async request call
	 * @param request
	 * @returns
	 */
	request(method: string, ...params: any[]): Promise<any> {
		return new Promise((resolve, reject) => {
			this._send({
				id: this._seq,
				method: method,
				params: params,
			});

			this._callbacks.set(this._seq, { resolve, reject });

			this._seq++;
		});
	}

	/**
	 * send with non-return
	 * @param params
	 */
	send(method: string, ...params: any[]) {
		if (this._child) {
			this._send({
				method: method,
				params: params,
			});
		} else {
			this._send({
				method: method,
				params: params,
			});
		}
	}

	private _send(message: ServiceRequest) {
		if (this._child) {
			this._child.send(message);
		} else {
			process.send!(message);
		}
	}

	log(level: string, ...args: any[]) {
		this.send(`log-${level}`, ...args);
	}
}
