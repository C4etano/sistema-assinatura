import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { iniciarBanco, caminhosStorage } from './database.js';

const { pastaDocumentos, pastaStorage } = caminhosStorage;

async function criarPastaSeNecessario(pasta) {
  try {
    await fs.mkdir(pasta, { recursive: true });
  } catch (erro) {
    if (erro.code !== 'EEXIST') throw erro;
  }
}

export async function importarDocumentos(caminhos, usuarioId) {
  await criarPastaSeNecessario(pastaDocumentos);
  const db = await iniciarBanco();
  let importados = 0;
  const erros = [];

  for (const caminhoOriginal of caminhos) {
    const nomeArquivo = path.basename(caminhoOriginal);
    const buffer = await fs.readFile(caminhoOriginal);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    const existente = await db.get('SELECT id FROM documentos WHERE hash = ?', [hash]);
    if (existente) {
      erros.push(`"${nomeArquivo}"`);
      continue;
    }

    const nomeDestino = `${Date.now()}-${nomeArquivo}`;
    const caminhoDestino = path.join(pastaDocumentos, nomeDestino);

    await fs.writeFile(caminhoDestino, buffer);

    const dataImportacao = new Date().toISOString();

    await db.run(
      'INSERT INTO documentos (nome, caminho, data_importacao, status, hash, usuario_id) VALUES (?, ?, ?, ?, ?, ?)',
      [nomeArquivo, caminhoDestino, dataImportacao, 'Não assinado', hash, usuarioId]
    );
    importados++;
  }

  const documentos = await listarDocumentos();
  let mensagem = `${importados} documento(s) importado(s) com sucesso.`;
  if (erros.length > 0) {
    mensagem += ` Bloqueados por duplicidade: ${erros.join(', ')}.`;
  }

  return { documentos, mensagem };
}

export async function lerDocumento(id) {
  const db = await iniciarBanco();
  const doc = await db.get('SELECT * FROM documentos WHERE id = ?', [id]);
  if (!doc) return { sucesso: false, mensagem: 'Documento não encontrado.' };
  
  const buffer = await fs.readFile(doc.caminho);
  const base64 = buffer.toString('base64');
  
  let verificacao = null;
  if (doc.assinatura) {
    verificacao = await verificarDocumento(id);
    const usuario = await db.get('SELECT nome FROM usuarios WHERE id = ?', [doc.usuario_id]);
    verificacao.assinante = usuario ? usuario.nome : 'Desconhecido';
  }
  
  return { sucesso: true, base64, verificacao, doc };
}

export async function listarDocumentos() {
  const db = await iniciarBanco();
  return db.all('SELECT * FROM documentos ORDER BY data_importacao DESC');
}

export async function assinarDocumentos(ids, privateKeyPem) {
  const db = await iniciarBanco();
  const placeholders = ids.map(() => '?').join(',');
  const documentos = await db.all(`SELECT * FROM documentos WHERE id IN (${placeholders})`, ids);

  if (documentos.length === 0) {
    return [];
  }

  const atualizados = [];

  for (const doc of documentos) {
    const buffer = await fs.readFile(doc.caminho);
    const signature = crypto.sign('sha256', buffer, {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    });
    const assinaturaBase64 = signature.toString('base64');

    await db.run('UPDATE documentos SET status = ?, assinatura = ? WHERE id = ?', ['Assinado', assinaturaBase64, doc.id]);

    const assinaturaJson = {
      documento: doc.nome,
      hash: doc.hash,
      assinatura: assinaturaBase64,
      data_assinatura: new Date().toISOString(),
      usuario_id: doc.usuario_id,
    };

    await fs.writeFile(`${doc.caminho}.signature.json`, JSON.stringify(assinaturaJson, null, 2), 'utf8');

    atualizados.push({ ...doc, status: 'Assinado', assinatura: assinaturaBase64 });
  }

  return listarDocumentos();
}

export async function verificarDocumento(id) {
  const db = await iniciarBanco();
  const doc = await db.get('SELECT * FROM documentos WHERE id = ?', [id]);
  if (!doc) {
    return { valido: false, mensagem: 'Documento não encontrado.' };
  }

  if (!doc.assinatura) {
    return { valido: false, mensagem: 'Documento não está assinado.' };
  }

  const usuario = await db.get('SELECT * FROM usuarios WHERE id = ?', [doc.usuario_id]);
  if (!usuario || !usuario.chave_publica) {
    return { valido: false, mensagem: 'Chave pública do usuário não encontrada.' };
  }

  const buffer = await fs.readFile(doc.caminho);
  const signature = Buffer.from(doc.assinatura, 'base64');
  const valido = crypto.verify('sha256', buffer, {
    key: usuario.chave_publica,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
  }, signature);

  return {
    valido,
    mensagem: valido ? 'Assinatura válida.' : 'Assinatura inválida ou arquivo corrompido.',
  };
}

export async function removerDocumentos(ids) {
  const db = await iniciarBanco();
  const placeholders = ids.map(() => '?').join(',');
  const documentos = await db.all(`SELECT * FROM documentos WHERE id IN (${placeholders})`, ids);

  for (const doc of documentos) {
    try {
      await fs.unlink(doc.caminho);
      await fs.unlink(`${doc.caminho}.signature.json`);
    } catch (erro) {
      // Ignora se não existir
    }
  }

  await db.run(`DELETE FROM documentos WHERE id IN (${placeholders})`, ids);
  return listarDocumentos();
}

export async function exportarDocumentos(ids) {
  const db = await iniciarBanco();
  const pastaExportados = path.join(pastaStorage, 'exportados');
  await criarPastaSeNecessario(pastaExportados);

  const placeholders = ids.map(() => '?').join(',');
  const documentos = await db.all(`SELECT * FROM documentos WHERE id IN (${placeholders})`, ids);
  const exportados = [];

  for (const doc of documentos) {
    const nomeBase = path.basename(doc.caminho);
    const destinoPdf = path.join(pastaExportados, nomeBase);
    await fs.copyFile(doc.caminho, destinoPdf);

    const assinaturaJson = {
      documento: doc.nome,
      hash: doc.hash,
      assinatura: doc.assinatura,
      data_assinatura: new Date().toISOString(),
      usuario_id: doc.usuario_id,
    };
    await fs.writeFile(`${destinoPdf}.signature.json`, JSON.stringify(assinaturaJson, null, 2), 'utf8');

    await db.run('UPDATE documentos SET exportado = 1 WHERE id = ?', [doc.id]);
    exportados.push(destinoPdf);
  }

  return {
    caminho: pastaExportados,
    arquivos: exportados,
  };
}
