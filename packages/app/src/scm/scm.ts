import { app } from 'electron';

import { resolve } from 'path';

import { fork } from 'child_process';

import { Params, ServiceBuilder, ServiceConfig } from './types';

import { Service } from './service';

import { getLogger } from '../logger';

import { Storage } from '../storage';

import { SCMEntity } from './entity';

export interface SCM_ENV {
	[name: string]: any | undefined;
}

/**
 * Service controll manager
 */
export class SCM extends Storage {
	/**
	 * embed scm logger
	 */
	private _logger = getLogger('scm');

	/**
	 * Started services
	 */
	private _services = new Map<string, Service>();

	/**
	 * register service builders
	 */
	private _serviceBuilders = new Map<string, ServiceBuilder>();

	private _env: SCM_ENV;

	constructor(env: SCM_ENV) {
		super(app.getPath('userData'), 'scm', [SCMEntity]);

		this._env = env;
	}

	async start() {
		await super.connect();
	}

	stop() {
		this._services.forEach(value => {
			value.stop();
		});
	}

	private async getServices(): Promise<SCMEntity[]> {
		return this.repository(SCMEntity).find();
	}

	/**
	 * Start service with entity
	 * @param entity service description entity
	 */
	private async startService(entity: SCMEntity): Promise<Service | undefined> {
		if (entity.disabled) {
			this._logger.info(`skip start disabled service: ${entity.name}`);
			return undefined;
		}

		let args: Params | undefined;

		if (entity.params) {
			args = JSON.parse(entity.params);
		} else if (entity.defaultParams) {
			args = JSON.parse(entity.defaultParams);
		}

		let scriptPath = entity.scriptPath;

		if (scriptPath.includes('${root_dir}')) {
			const rootDir = this._env['root_dir'];

			if (!rootDir) {
				throw new Error('expect env root_dir');
			}

			scriptPath = scriptPath.replace('${root_dir}', rootDir);
		}

		const service = this.forkService(entity.name, scriptPath, args);

		const builder = this._serviceBuilders.get(entity.name)!;

		await builder.onCreate(service);
	}

	/**
	 * fork service
	 * @param name
	 * @param scriptPath
	 * @param args
	 * @returns
	 */
	private forkService(name: string, scriptPath: string, params?: Params): Service {
		const args: string[] = [];

		if (params) {
			Object.keys(params).forEach(it => {
				args.push(`--${it}`);
				args.push(`${params[it]}`);
			});
		}

		this._logger.info('start service ' + name + ' ' + scriptPath + ' ' + args);

		const childProcess = fork(scriptPath, args, {
			env: {
				LOG_DIR: app.getPath('logs'),
			},
		});

		childProcess.on('exit', code => {
			const service = this._services.get(name);

			if (service && service.process.pid == childProcess.pid) {
				this._services.delete(name);
			}

			// this.emit('exit', name, code);
		});

		childProcess.on('error', err => {
			const service = this._services.get(name);

			if (service && service.process.pid == childProcess.pid) {
				this._services.delete(name);
			}

			// this.emit('error', name, err);

			this._logger.error(`service ${name} error :${err}`);
		});

		const service = new Service(name, childProcess);

		this._services.set(name, service);

		return service;
	}

	public async serviceByName(name: string): Promise<SCMEntity | undefined> {
		return await this.repository(SCMEntity).findOne({ name: name });
	}

	public serviceInstance(name: string): Service | undefined {
		return this._services.get(name);
	}

	/**
	 * Restart service by name
	 * @param name service symbol | name
	 */
	public async restartService(name: string) {
		const entity = await this.serviceByName(name);

		if (!entity) {
			throw new Error(`service not found: ${name}`);
		}

		if (entity.disabled) {
			return;
		}

		const instance = this.serviceInstance(name);

		if (instance) {
			this._logger.debug('stop service :' + instance);
			instance.stop();

			const builder = this._serviceBuilders.get(entity.name)!;

			await builder.onStop();
		}

		await this.startService(entity);
	}

	/**
	 * Get services
	 * @returns service descriptions
	 */
	public async services(): Promise<ServiceConfig[]> {
		const services = await this.getServices();

		this._logger.debug(`get services: ${JSON.stringify(services)}`);

		return services
			.filter(it => it.configable)
			.map(it => {
				return {
					name: it.name,
					paramsDescription: it.paramsDescription
						? JSON.parse(it.paramsDescription)
						: undefined,
					defaultParams: it.defaultParams ? JSON.parse(it.defaultParams) : undefined,
					params: it.params ? JSON.parse(it.params) : undefined,
					disabled: it.disabled,
					status: this._services.has(it.name) ? 'running' : 'stopped',
					systemService: it.systemService,
					configable: it.configable,
					scriptPath: it.scriptPath,
					version: it.version,
				};
			});
	}

	public async setParams(name: string, params: any[]) {
		await this.repository(SCMEntity).update(
			{ name: name },
			{
				params: JSON.stringify(params),
			},
		);

		await this.restartService(name);
	}

	public async disable(name: string, flag: boolean) {
		await this.repository(SCMEntity).update(
			{ name: name },
			{
				disabled: flag,
			},
		);

		if (this._services.has(name) && flag) {
			this._services.get(name)?.stop();
			this._services.delete(name);

			await this._serviceBuilders.get(name)?.onStop();
		}

		if (!this._services.has(name) && !flag) {
			this.restartService(name);
		}
	}

	public async register(builder: ServiceBuilder) {
		const {
			name,
			scriptPath,
			configable,
			systemService,
			version,
			paramsDescription,
			defaultParams,
		} = builder.config();

		this._logger.info(`register service ${name}`);

		if (paramsDescription) {
			if (
				!defaultParams ||
				Object.keys(paramsDescription).length != Object.keys(defaultParams).length
			) {
				throw new Error('default params length != params description array length');
			}
		}

		const exists = await this.serviceByName(name);

		if (!exists) {
			await this.repository(SCMEntity).save({
				name,
				scriptPath,
				paramsDescription: JSON.stringify(paramsDescription),
				defaultParams: JSON.stringify(defaultParams),
				disabled: false,
				systemService: systemService,
				configable: configable,
				version: version,
			});
		} else if (exists.version < version) {
			this._logger.info(`update service ${name}`);
			await this.repository(SCMEntity).save({
				name,
				scriptPath,
				paramsDescription: JSON.stringify(paramsDescription),
				defaultParams: JSON.stringify(defaultParams),
				systemService: systemService,
				configable: configable,
				version: version,
			});
		}

		this._serviceBuilders.set(name, builder);

		await this.restartService(name);
	}
}
