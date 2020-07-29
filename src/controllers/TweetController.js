import Twit from 'twit';
import dotenv from 'dotenv';
import regeneratorRuntime from "regenerator-runtime";
import { SentimentIntensityAnalyzer } from "vader-sentiment";

dotenv.config();

const SUPPORTED_LANGUAGES = {
    ar: 'Arabic',
    nl: 'Dutch',
    en: 'English',
    fa: 'Farsi',
    fr: 'French',
    de: 'German',
    id: 'Indonesian',
    it: 'Italian',
    ja: 'Japanese',
    pt: 'Portuguese',
    es: 'Spanish',
}

const clear_tweet = (text = '') => {
    let out = '';

    text.split(' ').forEach(word => {
        if (!word.startsWith('@') && !(word.startsWith('http://') || word.startsWith('https://'))) {
            out += word.toLowerCase().replace(/#/g, '').replace(/@/g, 'a') + " ";
        }
    })

    return out.trim();
}

class TweetController {
    // instancia estatica com o objeto criado no construtor
    static instance;

    // cria uma instancia da classe
    constructor() {
        // cria o Twit que será usado na stream
        this.T = new Twit({
            consumer_key: process.env.TWITTER_API_KEY,
            consumer_secret: process.env.TWITTER_API_SECRET,
            access_token: process.env.TWITTER_ACCESS_TOKEN,
            access_token_secret: process.env.TWITTER_ACCESS_SECRET,
            timeout_ms: 60 * 1000, // timeout de 1 segundo
            strictSSL: true, // conectar com SSL
        });

        // propriedade que vai armazenar a stream
        this.stream = null;

        // dados para reinforcement learning
        this.rl_data = {};
        this.learning_rate = 0.1;

        // dados dos tweets
        this.state = {
            hashtag: '',
            list: [],
            approved: [],
            rejected: [],
            watching: false,
            language: '',
            ai_enabled: false
        };

        // referencia pra criar os IDs unicos
        this.lastId = 0;

        // salva a instancia na propriedade estatica
        TweetController.instance = this;
    }

    // probabilidade por RL
    rl_probability(text) {
        let total_score = 0;

        const words = clear_tweet(text).split(' ');

        if (!words.length) {
            return 'neu';
        }

        words.forEach(word => {
            if (!!this.rl_data[word]) {
                total_score += parseFloat(this.rl_data[word]);
            }
        });

        const mean_square = total_score / words.length;

        if (mean_square > 0.5) {
            return 'pos';
        } else if (mean_square < 0.5) {
            return 'neg';
        } else {
            return 'neu';
        }
    }

    // set the score of the word
    rl_set_score(text = '', multiplier = 1) {
        clear_tweet(text).split(' ').forEach(word => {
            this.rl_data[word] = this.rl_data[word]
                ?
                parseFloat(this.rl_data[word]) + this.learning_rate * multiplier
                :
                this.learning_rate * multiplier;
        })
    }

    // inicia o monitoramento de uma hashtag
    watch(req, res) {
        // se já não estiver monitorando
        if (!this.state.watching) {
            // pega a hashtag do request
            let { hashtag } = req.params;

            // adiciona o # se nao houver
            hashtag = hashtag.startsWith("#") ? hashtag : "#" + hashtag;

            // cria o filtro pra stream
            let query = {
                track: hashtag
            }
            // pega o idioma
            let language = req.query.lang;
            // se tiver selecao de idioma e for um dos idiomas disponiveis
            if (language && SUPPORTED_LANGUAGES[language]) {
                // adiciona ao filtro
                query.language = language;
                // adiciona aos dados
                this.state.language = language;
            }
            // cria a stream
            this.stream = this.T.stream('statuses/filter', query);

            // salva a hashtag nos dados
            this.state.hashtag = hashtag;
            // salva se esta monitorando nos dados
            this.state.watching = true;

            // adiciona o evento para cada tweet novo
            this.stream.on('tweet', tweet => {
                // se for um retweet ou não houver a hashtag no texto
                if (tweet.text.startsWith("RT") || !tweet.text.toUpperCase().includes(hashtag.toUpperCase())) {
                    return;
                }

                // se o tweet passa dos 140 caracteres
                const text = tweet.extended_tweet ? tweet.extended_tweet.full_text || tweet.text : tweet.text;

                // coloca um id pra ser usado nos requests
                tweet.id = ++this.lastId;

                // adiciona à lista geral
                const {
                    user: {
                        profile_image_url_https,
                        name,
                        screen_name,
                        id: user_id,
                        profile_image_url
                    }, id
                } = tweet;

                if (this.state.ai_enabled) {
                    const { compound } = SentimentIntensityAnalyzer.polarity_scores(clear_tweet(text))

                    if (compound >= 0.05) { // negativo
                        this.state.approved = [...this.state.approved, {
                            text, user: {
                                profile_image_url_https,
                                name,
                                screen_name,
                                id: user_id,
                                profile_image_url
                            }, id
                        }];
                    } else if (compound <= -0.05) {
                        this.state.rejected = [...this.state.rejected, {
                            text, user: {
                                profile_image_url_https,
                                name,
                                screen_name,
                                id: user_id,
                                profile_image_url
                            }, id
                        }];
                    } else {
                        const probability = this.rl_probability(text);

                        if (probability == 'pos') {
                            this.state.approved = [...this.state.approved, {
                                text, user: {
                                    profile_image_url_https,
                                    name,
                                    screen_name,
                                    id: user_id,
                                    profile_image_url
                                }, id
                            }];
                        } else if (probability == 'neg') {
                            this.state.rejected = [...this.state.rejected, {
                                text, user: {
                                    profile_image_url_https,
                                    name,
                                    screen_name,
                                    id: user_id,
                                    profile_image_url
                                }, id
                            }];
                        } else {
                            this.state.list = [...this.state.list, {
                                text, user: {
                                    profile_image_url_https,
                                    name,
                                    screen_name,
                                    id: user_id,
                                    profile_image_url
                                }, id
                            }];
                        }
                    }
                } else {
                    this.state.list = [...this.state.list, {
                        text, user: {
                            profile_image_url_https,
                            name,
                            screen_name,
                            id: user_id,
                            profile_image_url
                        }, id
                    }];
                }

                // emite o socket com os dados para o front end
                req.io.emit("change", this.state);
            });

            // emite o socket com os dados para o front end
            req.io.emit("change", this.state);
        }

        // retorna dizendo que funcionou
        return res.json({
            status: 1,
            data: this.state
        });
    };

    // para o monitoramento
    stop(req, res) {
        // se uma stream estiver sendo monitorada
        if (this.stream) {
            this.stream.stop();
            this.state.watching = false;

            req.io.emit("change", this.state);
        }

        // retorna dizendo que funcionou
        return res.json({
            status: 1,
        });
    };

    // limpa os tweets
    clear(req, res) {
        // se uma stream estiver sendo monitorada
        if (this.stream) {
            this.stream.stop();

            this.state = {
                hashtag: this.state.hashtag,
                list: [],
                approved: [],
                rejected: [],
                watching: false,
                language: this.state.language,
                ai_enabled: false
            };
            this.lastId = 0;

            req.io.emit("change", this.state);
        }

        // retorna dizendo que funcionou
        return res.json({
            status: 1,
        });
    };

    /**
     * Aprovar o tweet com o id selecionado. Escrita da forma mais otimizada para usar o mínimo de recursos.
     * @param {Request} req a requisicao
     * @param {Response} res a resposta
     */
    approve(req, res) {
        // pega o id do request
        const { id } = req.params;

        // loop pelos itens da lista geral
        for (const index in this.state.list) {
            const tweet = this.state.list[index];

            // se é o id selecionado
            if (tweet.id == id) {
                // adiciona aos aprovados
                this.state.approved = [tweet, ...this.state.approved];

                // remove da lista geral
                this.state.list.splice(index, 1);

                // emite o socket com a mudanca
                req.io.emit('change', this.state);

                // reinforcement learning words score
                this.rl_set_score(tweet.text, 1);

                // termina o request aqui dizendo que funcionou
                return res.json({
                    status: 1
                });
            }
        }

        // loop pelos itens da lista de aprovados
        for (const index in this.state.rejected) {
            const tweet = this.state.rejected[index];

            // se é o id selecionado
            if (tweet.id == id) {
                // adiciona aos aprovados
                this.state.approved = [tweet, ...this.state.approved];

                // remove da lista de aprovados
                this.state.rejected.splice(index, 1);

                // emite o socket com a mudanca
                req.io.emit('change', this.state);

                // reinforcement learning words score
                this.rl_set_score(tweet.text, 1);

                // termina o request aqui dizendo que funcionou
                return res.json({
                    status: 1
                });
            }
        }

        // nao encontrou o tweet
        return res.status(404).json({
            status: 0
        });
    }

    /**
     * Rejeitar o tweet com o id selecionado. Escrita da forma mais otimizada para usar o mínimo de recursos.
     * @param {Request} req a requisicao
     * @param {Response} res a resposta
     */
    reject(req, res) {
        // pega o id do request
        const { id } = req.params;

        // loop pelos itens da lista geral
        for (const index in this.state.list) {
            const tweet = this.state.list[index];

            // se é o id selecionado
            if (tweet.id == id) {
                // adiciona aos rejeitados
                this.state.rejected = [tweet, ...this.state.rejected];

                // remove da lista geral
                this.state.list.splice(index, 1);

                // emite o socket com a mudanca
                req.io.emit('change', this.state);

                // reinforcement learning words score
                this.rl_set_score(tweet.text, -1);

                // termina o request aqui dizendo que funcionou
                return res.json({
                    status: 1
                });
            }
        }

        // loop pelos itens da lista de aprovados
        for (const index in this.state.approved) {
            const tweet = this.state.approved[index];

            // se é o id selecionado
            if (tweet.id == id) {
                // adiciona aos rejeitados
                this.state.rejected = [tweet, ...this.state.rejected];

                // remove da lista de aprovados
                this.state.approved.splice(index, 1);

                // emite o socket com a mudanca
                req.io.emit('change', this.state);

                // reinforcement learning words score
                this.rl_set_score(tweet.text, -1);

                // termina o request aqui dizendo que funcionou
                return res.json({
                    status: 1
                });
            }
        }

        // nao encontrou o tweet
        return res.status(404).json({
            status: 0
        });
    }

    /**
     * Apaga o tweet com o id selecionado. Escrita da forma mais otimizada para usar o mínimo de recursos.
     * @param {Request} req a requisicao
     * @param {Response} res a resposta
     */
    delete(req, res) {
        // pega o id do request
        const { id } = req.params;

        // loop pelos itens da lista geral
        for (const index in this.state.list) {
            const tweet = this.state.list[index];

            // se é o id selecionado
            if (tweet.id == id) {
                // remove da lista geral
                this.state.list.splice(index, 1);

                // emite o socket com a mudanca
                req.io.emit('change', this.state);

                // termina o request aqui dizendo que funcionou
                return res.json({
                    status: 1
                });
            }
        }

        // loop pelos itens da lista de aprovados
        for (const index in this.state.approved) {
            const tweet = this.state.approved[index];

            // se é o id selecionado
            if (tweet.id == id) {
                // remove da lista de aprovados
                this.state.approved.splice(index, 1);

                // emite o socket com a mudanca
                req.io.emit('change', this.state);

                // termina o request aqui dizendo que funcionou
                return res.json({
                    status: 1
                });
            }
        }

        // loop pelos itens da lista de rejeitados
        for (const index in this.state.rejected) {
            const tweet = this.state.rejected[index];

            // se é o id selecionado
            if (tweet.id == id) {
                // remove da lista de rejeitados
                this.state.rejected.splice(index, 1);

                // emite o socket com a mudanca
                req.io.emit('change', this.state);

                // termina o request aqui dizendo que funcionou
                return res.json({
                    status: 1
                });
            }
        }

        // nao encontrou o tweet
        return res.status(404).json({
            status: 0
        });
    }

    /**
     * Habilita a auto-aprovação de tweets por IA
     * @param {Request} req a requisicao
     * @param {Response} res a resposta
     */
    enable_ai(req, res) {
        this.state.ai_enabled = true;
        // req.io.emit('change', this.data);

        return res.status(200).json({
            status: 1
        });
    }

    /**
     * Habilita a auto-aprovação de tweets por IA
     * @param {Request} req a requisicao
     * @param {Response} res a resposta
     */
    disable_ai(req, res) {
        this.state.ai_enabled = false;
        // req.io.emit('change', this.data);

        return res.status(200).json({
            status: 1
        });
    }
}

export default TweetController;