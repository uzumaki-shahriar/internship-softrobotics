const prisma = require("../db");
const { generateAccountNumber } = require("../utils/generators");
const { NotFoundError } = require("../errors");

async function listAccounts() {
  return prisma.account.findMany({ orderBy: { createdAt: "desc" }, include: { cards: true } });
}

async function getAccount(id) {
  const account = await prisma.account.findUnique({
    where: { id: Number(id) },
    include: {
      cards: true,
      transactions: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!account) throw new NotFoundError("Account not found");
  return account;
}

async function createAccount({ holder_name, type, balance, daily_limit }) {
  return prisma.account.create({
    data: {
      accountNumber: generateAccountNumber(),
      holderName: holder_name,
      type,
      balance,
      dailyLimit: daily_limit,
    },
  });
}

async function setAccountStatus(id, status) {
  const account = await prisma.account.findUnique({ where: { id: Number(id) } });
  if (!account) throw new NotFoundError("Account not found");
  return prisma.account.update({ where: { id: Number(id) }, data: { status } });
}

module.exports = { listAccounts, getAccount, createAccount, setAccountStatus };
