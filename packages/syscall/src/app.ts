export type PropertyType = 'Number' | 'String' | 'Path' | 'Port' | 'Boolean';

export interface PropertyDescriptions {
	[name: string]: PropertyType;
}

export interface Params {
	[name: string]: number | string | boolean;
}

export interface ServiceConfig {
	name: string;
	scriptPath: string;
	configable: boolean;
	systemService: boolean;
	version: number;
	paramsDescription?: PropertyDescriptions;
	defaultParams?: Params;
	status?: 'running' | 'stopped';
	params?: Params;
}

export type ElectronPlatform =
	| 'aix'
	| 'android'
	| 'darwin'
	| 'freebsd'
	| 'haiku'
	| 'linux'
	| 'openbsd'
	| 'sunos'
	| 'win32'
	| 'cygwin'
	| 'netbsd';

export interface IElectronProvider {
	on<Event extends string>(event: Event, listener: (...args: any[]) => void): this;
	removeListener<Event extends string>(event: Event, listener: (...args: any[]) => void): this;
	request<Channel extends string>(channel: Channel, ...args: any[]): Promise<any>;
	platform(): ElectronPlatform;
}

declare global {
	interface Window {
		electron: IElectronProvider;
	}
}

export type SysCallEvent = 'el_service_status' | 'el_window_hide' | 'el_window_show';

export type SysCallChannel =
	| 'el_window_close'
	| 'el_window_maximize_normalimize'
	| 'el_window_minimize'
	| 'el_window_maximized'
	| 'el_window_resizable'
	| 'el_service_list'
	| 'el_service_disable'
	| 'el_service_restart'
	| 'el_service_params_set'
	| 'wp_profile';

export interface SamplingData {
	pending: number;
	flow: number;
	timestamp: number;
}

export interface Profile {
	topics: number;
	clients: number;
	sampling: SamplingData[];
}

export class SysCall {
	on(event: string, listener: (...args: any[]) => void): this {
		window.electron.on(event, listener);
		return this;
	}

	removeListener(event: string, listener: (...args: any[]) => void): this {
		window.electron.removeListener(event, listener);
		return this;
	}

	async close(): Promise<void> {
		await window.electron.request<SysCallChannel>('el_window_close' as SysCallChannel);
	}

	async maximizeOrNormalmize(): Promise<void> {
		await window.electron.request<SysCallChannel>('el_window_maximize_normalimize');
	}

	async minimize(): Promise<void> {
		await window.electron.request<SysCallChannel>('el_window_minimize');
	}

	async maximized(): Promise<boolean> {
		return await window.electron.request<SysCallChannel>('el_window_maximized');
	}

	async resizeable(): Promise<boolean> {
		return await window.electron.request<SysCallChannel>('el_window_resizable');
	}

	platform(): ElectronPlatform {
		return window.electron.platform();
	}

	async services(): Promise<ServiceConfig[]> {
		return await window.electron.request<SysCallChannel>('el_service_list');
	}

	async disableService(name: string, flag: boolean): Promise<void> {
		return await window.electron.request<SysCallChannel>('el_service_disable', name, flag);
	}

	async restartService(name: string): Promise<void> {
		return await window.electron.request<SysCallChannel>('el_service_restart', name);
	}

	async setServiceParams(name: string, params: Params): Promise<void> {
		return await window.electron.request<SysCallChannel>('el_service_params_set', name, params);
	}
}
