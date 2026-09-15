const prisma = require("../db");
const { NotFoundError } = require("../errors");

async function getWallets(merchantId) {
  return prisma.wallet.findMany({ where: { merchantId }, include: { currency: true } });
}

async function listTransactions(merchantId, { page, pageSize, status }) {
  const where = status ? { merchantId, status } : { merchantId };
  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { currency: true },
    }),
    prisma.transaction.count({ where }),
  ]);
  return { items, total, page, page_size: pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

async function getTransactionDetail(merchantId, invoiceId) {
  const transaction = await prisma.transaction.findUnique({
    where: { invoiceId },
    include: { currency: true, refunds: { orderBy: { createdAt: "desc" } } },
  });
  if (!transaction || transaction.merchantId !== merchantId) {
    // Same response as "doesn't exist" - never confirm another merchant's
    // invoice_id exists, same rule as the API's verify endpoint.
    throw new NotFoundError("Transaction not found");
  }
  return transaction;
}

module.exports = { getWallets, listTransactions, getTransactionDetail };
