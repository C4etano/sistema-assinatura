// electron/database.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pastaStorage = path.join(__dirname, '..', 'storage');
const caminhoBanco = path.join(pastaStorage, 'db.sqlite');
const pastaDocumentos = path.join(pastaStorage, 'documentos');
const pastaChaves = path.join(pastaStorage, 'keys');

// Esta memória guarda o banco aberto para não termos que abri-lo várias vezes.
let dbInstancia = null;

export async function iniciarBanco() {
  if (dbInstancia) {
    return dbInstancia;
  }

  if (!fs.existsSync(pastaStorage)) {
    fs.mkdirSync(pastaStorage, { recursive: true });
  }

  if (!fs.existsSync(pastaDocumentos)) {
    fs.mkdirSync(pastaDocumentos, { recursive: true });
  }

  if (!fs.existsSync(pastaChaves)) {
    fs.mkdirSync(pastaChaves, { recursive: true });
  }

  dbInstancia = await open({
    filename: caminhoBanco,
    driver: sqlite3.Database,
  });

  await dbInstancia.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_usuario TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      chave_publica TEXT,
      chave_privada_criptografada TEXT
    );
  `);

  await dbInstancia.exec(`
    CREATE TABLE IF NOT EXISTS documentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      caminho TEXT NOT NULL,
      data_importacao TEXT NOT NULL,
      status TEXT NOT NULL,
      hash TEXT NOT NULL,
      assinatura TEXT,
      usuario_id INTEGER NOT NULL,
      exportado INTEGER DEFAULT 0,
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    );
  `);

  console.log('Banco de dados conectado com sucesso!');
  return dbInstancia;
}

export const caminhosStorage = {
  pastaStorage,
  pastaDocumentos,
  pastaChaves,
};