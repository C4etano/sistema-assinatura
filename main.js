import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

import { iniciarBanco } from './database.js';
import { registrarUsuario, fazerLogin } from './auth.js';
import {
  importarDocumentos,
  listarDocumentos,
  assinarDocumentos,
  verificarDocumento,
  removerDocumentos,
  exportarDocumentos,
  lerDocumento,
} from './documents.js';

app.commandLine.appendSwitch('disable-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disk-cache-dir', path.join(process.cwd(), 'electron-cache'));
app.setPath('userData', path.join(process.cwd(), 'user-data'));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL('http://localhost:5174');

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Página carregada com sucesso!');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Falha ao carregar página:', errorCode, errorDescription);
  });
}

app.whenReady().then(async () => {
  try {
    await iniciarBanco();

    ipcMain.handle('registrar-usuario', async (event, dados) => {
      return registrarUsuario(dados.nomeUsuario, dados.senha);
    });

    ipcMain.handle('fazer-login', async (event, dados) => {
      return fazerLogin(dados.nomeUsuario, dados.senha);
    });

    ipcMain.handle('listar-documentos', async (event, dados) => {
      return {
        sucesso: true,
        documentos: await listarDocumentos(dados.usuarioId),
      };
    });

    ipcMain.handle('importar-documentos', async (event, dados) => {
      const resultado = await importarDocumentos(dados.caminhos, dados.usuarioId);
      return { sucesso: true, documentos: resultado.documentos, mensagem: resultado.mensagem };
    });

    ipcMain.handle('assinar-documentos', async (event, dados) => {
      return { sucesso: true, documentos: await assinarDocumentos(dados.ids, dados.privateKey) };
    });

    ipcMain.handle('verificar-documento', async (event, dados) => {
      return await verificarDocumento(dados.id);
    });

    ipcMain.handle('remover-documentos', async (event, dados) => {
      return { sucesso: true, documentos: await removerDocumentos(dados.ids) };
    });

    ipcMain.handle('exportar-documentos', async (event, dados) => {
      return { sucesso: true, resultado: await exportarDocumentos(dados.ids) };
    });

    ipcMain.handle('ler-documento', async (event, dados) => {
      return await lerDocumento(dados.id);
    });

    createWindow();
  } catch (erro) {
    console.error('Erro fatal ao iniciar o banco de dados:', erro);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
