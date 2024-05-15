import express from 'express';
import routes from './routes';

const port = process.env.PORT || 5000;
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(routes);

app.listen(port, () => console.log(`Server running on ${port}`));

export default app;