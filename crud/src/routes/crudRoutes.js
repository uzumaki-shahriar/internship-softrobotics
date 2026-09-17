const express = require('express');
const controller = require('../controllers/crudController');

module.exports = function buildCrudRouter(config) {
  const router = express.Router();

  router.get('/', controller.list(config));
  router.get('/new', controller.newForm(config));
  router.post('/', controller.create(config));
  router.get('/:id/edit', controller.editForm(config));
  router.put('/:id', controller.update(config));
  router.delete('/:id', controller.destroy(config));

  return router;
};
