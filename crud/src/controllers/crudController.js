const prisma = require('../lib/prisma');

function buildInclude(config) {
  const include = {};
  config.fields.forEach((f) => {
    if (f.type === 'relation') include[f.relation] = true;
  });
  return include;
}

async function getRelationOptions(config) {
  const options = {};
  for (const f of config.fields) {
    if (f.type === 'relation') {
      const rows = await prisma[f.relation].findMany({ orderBy: { id: 'asc' } });
      options[f.name] = rows.map((r) => ({ value: r.id, label: f.display(r) }));
    }
  }
  return options;
}

function parseBody(config, body, isEdit) {
  const data = {};
  for (const f of config.fields) {
    const raw = body[f.name];
    if (raw === undefined) continue;

    if (f.type === 'password') {
      if (raw === '') continue; // keep existing password when left blank on edit
      data[f.name] = raw;
    } else if (f.type === 'relation') {
      data[f.name] = raw === '' ? null : parseInt(raw, 10);
    } else if (f.type === 'number') {
      data[f.name] = raw === '' ? null : parseFloat(raw);
    } else if (f.type === 'select' && typeof f.options[0]?.value === 'number') {
      data[f.name] = parseInt(raw, 10);
    } else if (f.type === 'date') {
      data[f.name] = raw ? new Date(raw) : null;
    } else {
      data[f.name] = raw;
    }
  }
  return data;
}

exports.list = (config) => async (req, res) => {
  const rows = await prisma[config.key].findMany({ include: buildInclude(config), orderBy: { id: 'asc' } });
  res.render('crud/list', { config, rows, error: req.query.error });
};

exports.newForm = (config) => async (req, res) => {
  const options = await getRelationOptions(config);
  res.render('crud/form', {
    config,
    options,
    item: {},
    action: `/${config.route}`,
    method: 'POST',
    error: req.query.error,
  });
};

exports.create = (config) => async (req, res) => {
  try {
    const data = parseBody(config, req.body, false);
    await prisma[config.key].create({ data });
    res.redirect(`/${config.route}`);
  } catch (err) {
    console.error(err);
    res.redirect(`/${config.route}/new?error=${encodeURIComponent(err.message)}`);
  }
};

exports.editForm = (config) => async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = await prisma[config.key].findUnique({ where: { id } });
  if (!item) return res.redirect(`/${config.route}`);
  const options = await getRelationOptions(config);
  res.render('crud/form', {
    config,
    options,
    item,
    action: `/${config.route}/${id}?_method=PUT`,
    method: 'POST',
    error: req.query.error,
  });
};

exports.update = (config) => async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = parseBody(config, req.body, true);
    await prisma[config.key].update({ where: { id }, data });
    res.redirect(`/${config.route}`);
  } catch (err) {
    console.error(err);
    res.redirect(`/${config.route}/${req.params.id}/edit?error=${encodeURIComponent(err.message)}`);
  }
};

exports.destroy = (config) => async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await prisma[config.key].delete({ where: { id } });
    res.redirect(`/${config.route}`);
  } catch (err) {
    console.error(err);
    res.redirect(`/${config.route}?error=${encodeURIComponent('Cannot delete: this record is referenced by other records.')}`);
  }
};
