require('dotenv').config();
const express = require('express');
const path = require('path');
const methodOverride = require('method-override');

const CONFIGS = require('./config/models');
const buildCrudRouter = require('./routes/crudRoutes');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  methodOverride((req) => {
    if (req.query && '_method' in req.query) {
      return req.query._method;
    }
  })
);
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, res, next) => {
  res.locals.navConfigs = CONFIGS;
  next();
});

app.get('/', (req, res) => res.render('index', { configs: CONFIGS }));

CONFIGS.forEach((config) => {
  app.use(`/${config.route}`, buildCrudRouter(config));
});

app.use((req, res) => res.status(404).send('Not Found'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(`<pre>${err.message}</pre>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
