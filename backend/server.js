const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Banco de Dados
const db = new sqlite3.Database('./backend/database.db');

// Criação das tabelas
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    email TEXT,
    telefone TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    descricao TEXT,
    preco REAL
  )`);
});

// Rotas Clientes
app.post('/clientes', (req, res) => {
  const { nome, email, telefone } = req.body;
  db.run(`INSERT INTO clientes (nome, email, telefone) VALUES (?, ?, ?)`,
    [nome, email, telefone],
    function (err) {
      if (err) return res.status(500).send(err.message);
      res.send({ id: this.lastID });
    });
});

app.get('/clientes', (req, res) => {
  db.all(`SELECT * FROM clientes`, (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.json(rows);
  });
});

// Rotas Produtos
app.post('/produtos', (req, res) => {
  const { nome, descricao, preco } = req.body;
  db.run(`INSERT INTO produtos (nome, descricao, preco) VALUES (?, ?, ?)`,
    [nome, descricao, preco],
    function (err) {
      if (err) return res.status(500).send(err.message);
      res.send({ id: this.lastID });
    });
});

app.get('/produtos', (req, res) => {
  db.all(`SELECT * FROM produtos`, (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.json(rows);
  });
});

// Serve os arquivos da pasta frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Agora a rota "/" vai servir o arquivo index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Geração de orçamento PDF
app.post('/orcamento', (req, res) => {
  const { clienteId, produtosIds } = req.body;

  db.get(`SELECT * FROM clientes WHERE id = ?`, [clienteId], (err, cliente) => {
    if (err || !cliente) return res.status(400).send('Cliente não encontrado.');

    const placeholders = produtosIds.map(() => '?').join(',');
    db.all(`SELECT * FROM produtos WHERE id IN (${placeholders})`, produtosIds, (err, produtos) => {
      if (err) return res.status(500).send(err.message);

      const doc = new PDFDocument();
      const filePath = path.join(__dirname, `orcamento_${Date.now()}.pdf`);
      doc.pipe(fs.createWriteStream(filePath));

      doc.fontSize(20).text('Orçamento - Minha Loja', { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).text(`Cliente: ${cliente.nome}`);
      doc.text(`Email: ${cliente.email}`);
      doc.text(`Telefone: ${cliente.telefone}`);
      doc.moveDown();

      let total = 0;
      produtos.forEach(produto => {
        doc.text(`${produto.nome} - ${produto.descricao} - R$${produto.preco.toFixed(2)}`);
        total += produto.preco;
      });

      doc.moveDown();
      doc.fontSize(16).text(`Total: R$${total.toFixed(2)}`, { align: 'right' });

      doc.end();

      doc.on('finish', () => {
        res.download(filePath, () => {
          fs.unlinkSync(filePath); // Apaga depois de enviar
        });
      });
    });
  });
});

// Start
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
