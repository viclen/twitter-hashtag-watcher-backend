import express from "express";
import http from "http";
import routes from "./routes/index";
import Socket from "./middleware/Socket";
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';

// pega as variaveis de ambiente
dotenv.config();

class App {
    constructor() {
        // cria o express
        this.app = express();

        // criar o servidor http
        this.server = http.createServer(this.app);

        // middleware para conexao de origem diferente
        this.app.use(cors());
    
        // middleware para aumentar a seguranca da aplicao nos request/response
        this.app.use(helmet());

        // cria uma instancia socket para usar de middleware
        let socket = new Socket(this.server);
        // adicionar o socket como middleware
        this.app.use(socket.middleware.bind(socket));

        // adiciona as rotas
        this.app.use(routes);
    }
}

export default new App();