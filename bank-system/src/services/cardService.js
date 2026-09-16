const prisma = require("../db");
const { generateCardNumber, generateCvv } = require("../utils/generators");
const { NotFoundError } = require("../errors");

async function listCards() {
  return prisma.card.findMany({ orderBy: { createdAt: "desc" }, include: { account: true } });
}

async function createCard({ account_id, card_holder_name, expiry_month, expiry_year }) {
  const account = await prisma.account.findUnique({ where: { id: account_id } });
  if (!account) throw new NotFoundError("Account not found");

  return prisma.card.create({
    data: {
      accountId: account_id,
      cardNumber: generateCardNumber(),
      cardHolderName: card_holder_name,
      expiryMonth: expiry_month,
      expiryYear: expiry_year,
      cvv: generateCvv(),
    },
  });
}

async function setCardStatus(id, status) {
  const card = await prisma.card.findUnique({ where: { id: Number(id) } });
  if (!card) throw new NotFoundError("Card not found");
  return prisma.card.update({ where: { id: Number(id) }, data: { status } });
}

module.exports = { listCards, createCard, setCardStatus };
