import app from './App';

app.server.listen(process.env.PORT, () => console.log(`Listening on port ${process.env.PORT}`));