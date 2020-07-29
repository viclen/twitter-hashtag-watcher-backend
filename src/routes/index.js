import express from "express";
import TweetController from '../controllers/TweetController';

// cria uma instancia para ser usada na aplicacao
let tweetController = new TweetController();

// cria a instacia do router
const router = express.Router();

// rotas para a hashtag
router.get("/watch/:hashtag", tweetController.watch.bind(tweetController));
router.get("/stop", tweetController.stop.bind(tweetController));

// rota para limpar os tweets
router.get("/clear", tweetController.clear.bind(tweetController));

// rotas de controle do tweet
router.get("/tweet/:id/approve", tweetController.approve.bind(tweetController));
router.get("/tweet/:id/reject", tweetController.reject.bind(tweetController));
router.delete("/tweet/:id", tweetController.delete.bind(tweetController));

// rotas de IA
router.get("/ai/enable", tweetController.enable_ai.bind(tweetController));
router.get("/ai/disable", tweetController.disable_ai.bind(tweetController));

module.exports = router;