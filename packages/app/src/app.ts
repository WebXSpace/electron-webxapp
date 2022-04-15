import { app, BrowserWindow, ipcMain, Menu, Tray } from 'electron';
import { SCM } from './scm';
import { getLogger } from '@electron-webxapp/utils';

export type ENV_KEYS = 'ROOT_DIR' | 'MAIN_DEV_URL' | 'MAIN_PROD_URL' | 'MOD' | 'OPEN_DEV_TOOLS';

export type ENV = {
	[name in ENV_KEYS]: any | undefined;
};

/**
 * Electron app base class
 */
export abstract class ElectronApp {
	private _scm: SCM;

	private _singleton: boolean;

	private _mainWindow?: BrowserWindow;

	private _tray?: Tray;

	private _logger = getLogger('electron-app');

	private _env: ENV;

	constructor(env: ENV, singleton: boolean = true) {
		this._env = env;
		this._scm = new SCM({ root_dir: env.ROOT_DIR });
		this._singleton = singleton;
	}

	/// Start app services
	protected abstract startServices(scm: SCM): Promise<void>;

	protected abstract installTray(): Tray | undefined;

	protected abstract installExt(): Promise<void>;

	protected abstract createMainWindow(): BrowserWindow | undefined;

	private async _startServices() {
		await this._scm.start();

		await this.startServices(this.scm);
	}

	private _startListen() {
		app.on('second-instance', () => {
			if (this._singleton && this._mainWindow) {
				if (this._mainWindow.isMinimized()) {
					this._mainWindow.restore();
				}

				this._mainWindow.focus();
			}
		});

		app.on('window-all-closed', () => {
			if (!this._tray) {
				app.quit();
			}
		});

		app.on('web-contents-created', (event, contents) => {
			if (contents.getType() === 'webview') {
				contents.on('new-window', e => {
					e.preventDefault();
				});
			}
		});

		ipcMain.handle('el_window_close', event => {
			const window = BrowserWindow.fromWebContents(event.sender);
			window?.close();
		});

		ipcMain.handle('el_window_minimize', event => {
			const window = BrowserWindow.fromWebContents(event.sender);
			window?.minimize();
		});

		ipcMain.handle('el_window_maximize_normalimize', event => {
			const window = BrowserWindow.fromWebContents(event.sender);
			if (window?.isMaximized()) {
				window?.unmaximize();
			} else {
				window?.maximize();
			}
		});

		ipcMain.handle('el_window_maximized', async event => {
			const window = BrowserWindow.fromWebContents(event.sender);
			if (window?.isMaximized()) {
				return true;
			} else {
				return false;
			}
		});

		ipcMain.handle('el_window_resizable', event => {
			const window = BrowserWindow.fromWebContents(event.sender);
			return window?.resizable;
		});

		ipcMain.handle('el_service_list', async () => {
			return await this._scm.services();
		});

		ipcMain.handle('el_service_disable', async (_, name, flag) => {
			return await this._scm.disable(name, flag);
		});

		ipcMain.handle('el_service_restart', async (_, name) => {
			return this._scm.restartService(name);
		});

		ipcMain.handle('el_service_params_set', async (_, name, params) => {
			return await this._scm.setParams(name, params);
		});
	}

	/**
	 * Start electron app
	 */
	async start() {
		if (this._singleton) {
			const gotTheLock = app.requestSingleInstanceLock();

			if (!gotTheLock) {
				app.quit();
				return;
			}
		}

		if (process.platform == 'darwin') {
			app.dock.hide();
		}

		await app.whenReady();

		this._tray = this.installTray();

		await this.installExt();

		await this._startServices();

		// start listen call from render process
		this._startListen();

		Menu.setApplicationMenu(null);

		await this.showMainWindow();
	}

	protected async showMainWindow() {
		if (!this._mainWindow) {
			this._mainWindow = this.createMainWindow();

			await this._showMainWindow();
		} else {
			this._mainWindow.show();
			this._mainWindow?.webContents.send('el_window_show');
		}
	}

	private async _showMainWindow() {
		this._mainWindow?.setMenuBarVisibility(false);
		this._mainWindow?.setAutoHideMenuBar(true);

		this._mainWindow?.on('close', e => {
			if (this._tray) {
				e.preventDefault();

				this._mainWindow?.webContents.send('el_window_hide');
				this._mainWindow?.hide();
			}
		});

		await this._mainWindow?.loadURL(this._renderURL());

		this._logger.debug('start main window');

		this._mainWindow?.show();

		this._logger.debug('start main window -- success');

		if (this._env.OPEN_DEV_TOOLS) {
			this._mainWindow?.webContents.openDevTools();
		}
	}

	private _renderURL(): string {
		if (this._env.MOD === 'development') {
			return this._env.MAIN_DEV_URL;
		}

		return this._env.MAIN_PROD_URL;
	}

	protected sendToWindows(event: string, ...args: any[]) {
		BrowserWindow.getAllWindows().forEach(w => {
			w.webContents.send(event, ...args);
		});
	}

	protected get mainWindow(): BrowserWindow | undefined {
		return this._mainWindow;
	}

	protected get scm(): SCM {
		return this._scm;
	}
}
