import EventEmitter from 'events';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import {
	createConnection,
	getConnection,
	Repository,
	EntitySchema,
	EntityTarget,
	getConnectionManager,
} from 'typeorm';

export class Storage extends EventEmitter {
	private _dbPath: string;

	private _entities: (Function | string | EntitySchema<any>)[];

	private _name: string;

	constructor(
		rootDir: string,
		name: string,
		entities: (Function | string | EntitySchema<any>)[],
	) {
		super();

		let path = `${rootDir}/service`;

		if (!existsSync(path)) {
			mkdirSync(path, { recursive: true });
		}

		this._dbPath = resolve(`${path}/${name}.db`);

		this._entities = entities;

		this._name = name;
	}

	/**
	 * Connect to database
	 */
	protected async connect() {
		if (!getConnectionManager().has(this._name)) {
			await createConnection({
				name: this._name,
				type: 'sqlite',
				database: this._dbPath,
				entities: this._entities,
				synchronize: true,
			});
		}
	}

	protected get dbPath(): string {
		return this._dbPath;
	}

	/**
	 * Get entity repository
	 * @param target entity
	 * @returns repository
	 */
	protected repository<Entity>(target: EntityTarget<Entity>): Repository<Entity> {
		return getConnection(this._name).getRepository(target);
	}
}
