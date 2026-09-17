const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.currency.createMany({
    data: [
      { name: 'Taka', symbol: '৳', code: 'BDT' },
      { name: 'Us Doller', symbol: '$', code: 'USD' },
    ],
  });

  await prisma.bank.createMany({
    data: [
      { name: 'National Bank', issuer_name: 'NB', api_url: 'https://api.nbank.com', user_name: 'nb_user', user_password: 'nb_pass', code: 'NB001', branch: 'Dhaka Branch' },
      { name: 'City Bank', issuer_name: 'CB', api_url: 'https://api.citybank.com', user_name: 'cb_user', user_password: 'cb_pass', code: 'CB002', branch: 'Chittagong Branch' },
      { name: 'Dutch-Bangla Bank', issuer_name: 'DBBL', api_url: 'https://api.dbbl.com', user_name: 'dbbl_user', user_password: 'dbbl_pass', code: 'DB003', branch: 'Sylhet Branch' },
    ],
  });

  await prisma.user.createMany({
    data: [
      { name: 'Rashfi', user_type: 1, status: 1, email: 'rashfi@example.com', password: 'password' },
      { name: 'Nazifa', user_type: 1, status: 1, email: 'nazifa@example.com', password: 'password' },
      { name: 'Tazin', user_type: 1, status: 1, email: 'tazin@example.com', password: 'password' },
      { name: 'MerchantUser1', user_type: 2, status: 1, email: 'merchantuser1@example.com', password: 'password' },
      { name: 'MerchantUser2', user_type: 2, status: 1, email: 'merchantuser2@example.com', password: 'password' },
      { name: 'MerchantUser3', user_type: 2, status: 0, email: 'merchantuser3@example.com', password: 'password' },
      { name: 'Riyadh Ahmed', user_type: 1, status: 1, email: 'riyadhahmed777@gmail.com', password: 'password' },
    ],
  });

  const merchantUsers = await prisma.user.findMany({ where: { user_type: 2 }, orderBy: { id: 'asc' } });

  await prisma.merchant.createMany({
    data: [
      { user_id: merchantUsers[0].id, store_id: 'STORE1001', name: 'Merchant One', email: 'merchant1@example.com', address: '123 Main Street, Dhaka', status: 1 },
      { user_id: merchantUsers[1].id, store_id: 'STORE1002', name: 'Merchant Two', email: 'merchant2@example.com', address: '456 Lake Road, Chittagong', status: 1 },
      { user_id: merchantUsers[2].id, store_id: 'STORE1003', name: 'Merchant Three', email: 'merchant3@example.com', address: '789 Hill View, Sylhet', status: 0 },
    ],
  });

  console.log('Seed data inserted.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
