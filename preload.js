// electron/preload.js

// Importamos as ferramentas necessárias de segurança e comunicação do Electron
const { contextBridge, ipcRenderer } = require('electron');

/**
 * A função exposeInMainWorld cria um objeto global chamado 'api' 
 * que ficará disponível dentro do React (window.api).
 * Apenas as funções listadas aqui podem cruzar a ponte entre a tela e o sistema operacional.
 */
contextBridge.exposeInMainWorld('api', {
  // --- INFORMAÇÕES DO SISTEMA ---
  // Útil para exibir no rodapé do aplicativo ou para logs de erro
  versaoNode: process.versions.node,
  versaoChrome: process.versions.chrome,
  versaoElectron: process.versions.electron,

  // --- AUTENTICAÇÃO E CADASTRO ---
  // Envia os dados (usuário e senha) para o banco de dados registrar e criar chaves RSA
  cadastrarUsuario: (dados) => ipcRenderer.invoke('registrar-usuario', dados),
  
  // Envia os dados para validar a senha com o hash guardado no SQLite
  fazerLogin: (dados) => ipcRenderer.invoke('fazer-login', dados),

  // --- GESTÃO DE DOCUMENTOS ---
  // Pede ao banco de dados a lista de documentos já importados/assinados
  listarDocumentos: (dados) => ipcRenderer.invoke('listar-documentos', dados),
  
  // Abre a janela do Windows para selecionar novos PDFs e guardá-los no banco
  importarDocumentos: (dados) => ipcRenderer.invoke('importar-documentos', dados),
  
  // Envia a ordem para calcular o Hash e carimbar a Chave Privada nos PDFs selecionados
  assinarDocumentos: (dados) => ipcRenderer.invoke('assinar-documentos', dados),
  
  // Usa a Chave Pública para atestar se um PDF específico não foi adulterado
  verificarDocumento: (dados) => ipcRenderer.invoke('verificar-documento', dados),
  
  // Apaga o registro do documento do banco e a cópia da pasta local
  removerDocumentos: (dados) => ipcRenderer.invoke('remover-documentos', dados),
  
  // Salva os documentos assinados em uma pasta escolhida pelo usuário (ex: Pen Drive)
  exportarDocumentos: (dados) => ipcRenderer.invoke('exportar-documentos', dados),
  
  // Carrega o arquivo PDF para ser visualizado na tela antes de assinar
  lerDocumento: (dados) => ipcRenderer.invoke('ler-documento', dados),
});