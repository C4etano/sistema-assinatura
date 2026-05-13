// electron/auth.js
import bcrypt from 'bcryptjs';
import crypto from 'crypto'; // NOVO: Importamos o gerador de chaves nativo do Node.js
import { iniciarBanco } from './database.js';

export async function registrarUsuario(nomeUsuario, senhaPlana) {
  try {
    const db = await iniciarBanco();

    const usuarioExistente = await db.get('SELECT * FROM usuarios WHERE nome_usuario = ?', [nomeUsuario]);
    
    if (usuarioExistente) {
      return { sucesso: false, mensagem: 'Este nome de usuário já está em uso.' };
    }

    // 1. Gera o Hash da senha para o login (como já fazíamos)
    const salt = bcrypt.genSaltSync(10);
    const senhaHash = bcrypt.hashSync(senhaPlana, salt);

    // 2. GERAÇÃO DAS CHAVES CRIPTOGRÁFICAS (A Mágica da Assinatura)
    // Criamos um par de chaves RSA de 2048 bits (padrão de segurança de mercado)
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      
      // Formata a Chave Pública para podermos ler como texto
      publicKeyEncoding: { 
        type: 'spki', 
        format: 'pem' 
      },
      
      // Formata e TRANCA a Chave Privada usando a senha do gestor!
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
        cipher: 'aes-256-cbc', // Algoritmo do "cadeado"
        passphrase: senhaPlana // A "chave do cadeado" é a própria senha do usuário
      }
    });

    // 3. Salva tudo no banco de dados
    // Agora preenchemos também as colunas chave_publica e chave_privada_criptografada
    await db.run(
      `INSERT INTO usuarios 
      (nome_usuario, senha_hash, chave_publica, chave_privada_criptografada) 
      VALUES (?, ?, ?, ?)`,
      [nomeUsuario, senhaHash, publicKey, privateKey]
    );

    return { sucesso: true, mensagem: 'Usuário e Chaves Criptográficas criados com sucesso!' };

  } catch (erro) {
    console.error('Erro ao registrar usuário:', erro);
    return { sucesso: false, mensagem: 'Erro interno ao cadastrar usuário e gerar chaves.' };
  }
}

// A função de login continua exatamente igual
export async function fazerLogin(nomeUsuario, senhaPlana) {
  try {
    const db = await iniciarBanco();

    const usuario = await db.get('SELECT * FROM usuarios WHERE nome_usuario = ?', [nomeUsuario]);
    
    if (!usuario) {
      return { sucesso: false, mensagem: 'Usuário não encontrado.' };
    }

    const senhaCorreta = bcrypt.compareSync(senhaPlana, usuario.senha_hash);

    if (!senhaCorreta) {
      return { sucesso: false, mensagem: 'Senha incorreta.' };
    }

    return { 
      sucesso: true, 
      mensagem: 'Login realizado com sucesso!',
      usuarioId: usuario.id 
    };

  } catch (erro) {
    console.error('Erro ao fazer login:', erro);
    return { sucesso: false, mensagem: 'Erro interno ao tentar fazer o login.' };
  }
}