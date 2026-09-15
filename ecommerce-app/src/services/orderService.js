const prisma = require("../db");
const { getProduct } = require("../products");
const gatewayClient = require("../clients/gatewayClient");
const { NotFoundError } = require("../errors");

async function createOrderAndCheckout({ productId, buyerName, baseUrl }) {
  const product = getProduct(productId);
  if (!product) throw new NotFoundError("Product not found");

  const order = await prisma.order.create({
    data: {
      productId: product.id,
      productName: product.name,
      buyerName,
      amount: product.price,
      currency: product.currency,
      status: "pending",
    },
  });

  const session = await gatewayClient.initCheckout({
    order_id: String(order.id),
    amount: product.price,
    currency: product.currency,
    success_url: `${baseUrl}/success`,
    fail_url: `${baseUrl}/fail`,
  });

  await prisma.order.update({ where: { id: order.id }, data: { invoiceId: session.invoice_id } });

  return session.checkout_url;
}

/**
 * The one call that actually matters after a redirect back from the
 * Gateway - confirms the real status server-side rather than trusting
 * query params a customer could type in manually.
 */
async function confirmOrder(invoiceId) {
  const order = await prisma.order.findUnique({ where: { invoiceId } });
  if (!order) throw new NotFoundError("Order not found");

  const verified = await gatewayClient.verifyTransaction(invoiceId);

  const status = verified.status === "completed" ? "paid" : verified.status === "pending" ? "pending" : "failed";
  return prisma.order.update({
    where: { id: order.id },
    data: { status, declineReason: verified.decline_reason || null },
  });
}

async function listOrders() {
  return prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
}

module.exports = { createOrderAndCheckout, confirmOrder, listOrders };
