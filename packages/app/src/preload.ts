import { contextBridge, ipcRenderer } from 'electron';
import { IElectronProvider, ElectronPlatform } from '@electron-webxapp/syscall';

class ElectronProvider implements IElectronProvider {
	on(event: string, listener: (...args: any[]) => void): this {
		ipcRenderer.on(event, (event, ...args: any[]) => {
			listener(...args);
		});
		return this;
	}

	removeListener(event: string, listener: (...args: any[]) => void): this {
		ipcRenderer.removeListener(event, listener);
		return this;
	}

	async request(channel: string, ...args: any[]): Promise<any> {
		return await ipcRenderer.invoke(channel, ...args);
	}

	platform(): ElectronPlatform {
		return process.platform;
	}
}

const provider = new ElectronProvider();

const electron = {
	on: (event: string, listener: (...args: any[]) => void) => {
		provider.on(event, listener);
		return electron;
	},

	removeListener: (event: string, listener: (...args: any[]) => void) => {
		provider.removeListener(event, listener);
		return electron;
	},

	request: async (channel: string, ...args: any[]) => {
		return await provider.request(channel, ...args);
	},

	platform: () => {
		return provider.platform();
	},
};

contextBridge.exposeInMainWorld('electron', electron);
