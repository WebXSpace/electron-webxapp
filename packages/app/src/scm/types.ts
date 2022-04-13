import { Service } from './service';

import { ServiceConfig } from '../syscall';

export * from '../syscall';

export interface ServiceBuilder {
	config(): ServiceConfig;
	onCreate(service: Service): Promise<void>;
	onStop(): Promise<void>;
}
