const STATUS_OPTIONS = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const USER_TYPE_OPTIONS = [
  { value: 1, label: 'Admin' },
  { value: 2, label: 'Merchant' },
];

const TRANSACTION_STATE_OPTIONS = [
  { value: 'Completed', label: 'Completed' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Refunded', label: 'Refunded' },
  { value: 'PartialRefunded', label: 'Partial Refunded' },
  { value: 'Failed', label: 'Failed' },
];

// Each entry drives one full CRUD module: routes, controller, and views are
// generated generically from this config (see controllers/crudController.js).
// key    = Prisma client delegate name (prisma[key])
// route  = URL path segment the module is mounted at
// fields = form/list field definitions
const CONFIGS = [
  {
    key: 'user',
    route: 'users',
    label: 'Users',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'user_type', label: 'User Type', type: 'select', required: true, options: USER_TYPE_OPTIONS },
      { name: 'status', label: 'Status', type: 'select', required: true, options: STATUS_OPTIONS },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true },
    ],
    listFields: ['id', 'name', 'email', 'user_type', 'status'],
  },
  {
    key: 'merchant',
    route: 'merchants',
    label: 'Merchants',
    fields: [
      { name: 'user_id', label: 'User', type: 'relation', relation: 'user', display: (u) => `${u.name} (${u.email})`, required: true },
      { name: 'store_id', label: 'Store ID', type: 'text', required: true },
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'address', label: 'Address', type: 'textarea' },
      { name: 'status', label: 'Status', type: 'select', required: true, options: STATUS_OPTIONS },
    ],
    listFields: ['id', 'store_id', 'name', 'email', 'status'],
  },
  {
    key: 'currency',
    route: 'currencies',
    label: 'Currencies',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'symbol', label: 'Symbol', type: 'text', required: true },
      { name: 'code', label: 'Code', type: 'text', required: true },
    ],
    listFields: ['id', 'name', 'symbol', 'code'],
  },
  {
    key: 'bank',
    route: 'banks',
    label: 'Banks',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'issuer_name', label: 'Issuer Name', type: 'text', required: true },
      { name: 'api_url', label: 'API URL', type: 'text' },
      { name: 'user_name', label: 'Username', type: 'text', required: true },
      { name: 'user_password', label: 'Password', type: 'password', required: true },
      { name: 'status', label: 'Status', type: 'select', required: true, options: STATUS_OPTIONS },
      { name: 'code', label: 'Code', type: 'text' },
      { name: 'branch', label: 'Branch', type: 'text' },
    ],
    listFields: ['id', 'name', 'issuer_name', 'code', 'status'],
  },
  {
    key: 'pos',
    route: 'pos',
    label: 'POS Terminals',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'bank_id', label: 'Bank', type: 'relation', relation: 'bank', display: (b) => b.name, required: true },
      { name: 'currency_id', label: 'Currency', type: 'relation', relation: 'currency', display: (c) => `${c.name} (${c.code})`, required: true },
      { name: 'status', label: 'Status', type: 'select', required: true, options: STATUS_OPTIONS },
      { name: 'commission_percentage', label: 'Commission %', type: 'number', step: '0.01' },
      { name: 'commission_fixed', label: 'Commission Fixed', type: 'number', step: '0.01' },
      { name: 'bank_fee', label: 'Bank Fee', type: 'number', step: '0.01' },
      { name: 'settlement_day', label: 'Settlement Day (days)', type: 'number' },
    ],
    listFields: ['id', 'name', 'status', 'commission_percentage', 'settlement_day'],
  },
  {
    key: 'transaction',
    route: 'transactions',
    label: 'Transactions',
    fields: [
      { name: 'invoice_id', label: 'Invoice ID', type: 'text', required: true },
      { name: 'order_id', label: 'Order ID', type: 'text', required: true },
      { name: 'transaction_state', label: 'State', type: 'select', required: true, options: TRANSACTION_STATE_OPTIONS },
      { name: 'gross', label: 'Gross', type: 'number', step: '0.01', required: true },
      { name: 'net', label: 'Net', type: 'number', step: '0.01', required: true },
      { name: 'fee', label: 'Fee', type: 'number', step: '0.01' },
      { name: 'refunded_amount', label: 'Refunded Amount', type: 'number', step: '0.01' },
      { name: 'pos_id', label: 'POS', type: 'relation', relation: 'pos', display: (p) => p.name, required: true },
      { name: 'currency_id', label: 'Currency', type: 'relation', relation: 'currency', display: (c) => `${c.name} (${c.code})`, required: true },
      { name: 'merchant_id', label: 'Merchant', type: 'relation', relation: 'merchant', display: (m) => m.name, required: true },
      { name: 'settlement_date', label: 'Settlement Date', type: 'date' },
    ],
    listFields: ['id', 'invoice_id', 'order_id', 'transaction_state', 'gross', 'net'],
  },
  {
    key: 'refund',
    route: 'refunds',
    label: 'Refunds',
    fields: [
      { name: 'transaction_id', label: 'Transaction', type: 'relation', relation: 'transaction', display: (t) => t.invoice_id, required: true },
      { name: 'invoice_id', label: 'Invoice ID', type: 'text', required: true },
      { name: 'transaction_state', label: 'State', type: 'select', required: true, options: TRANSACTION_STATE_OPTIONS },
      { name: 'amount', label: 'Amount', type: 'number', step: '0.01', required: true },
    ],
    listFields: ['id', 'invoice_id', 'transaction_state', 'amount'],
  },
  {
    key: 'wallet',
    route: 'wallets',
    label: 'Wallets',
    fields: [
      { name: 'user_id', label: 'User', type: 'relation', relation: 'user', display: (u) => u.name, required: true },
      { name: 'currency_id', label: 'Currency', type: 'relation', relation: 'currency', display: (c) => `${c.name} (${c.code})`, required: true },
      { name: 'amount', label: 'Amount', type: 'number', step: '0.01', required: true },
    ],
    listFields: ['id', 'user_id', 'currency_id', 'amount'],
  },
];

module.exports = CONFIGS;
