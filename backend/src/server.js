const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors()); // Permite pedidos do React
app.use(express.json()); // Permite ler o JSON que envias no body

app.post('/receber-dados', (req) => {
  console.log("Dados recebidos do React:", req.body);
  // Aqui poderias usar o módulo 'fs' para gravar num ficheiro .txt ou .json
});

app.listen(5000, () => console.log("Backend a ouvir na porta 5000!"));