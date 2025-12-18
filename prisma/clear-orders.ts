import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Starting clean up of Order data...');

  // 1. Delete OrderItems (Child of Order)
  // These must go first because they point TO the Order
  const deletedItems = await prisma.orderItem.deleteMany({});
  console.log(`✅ Deleted ${deletedItems.count} Order Items.`);

  // 2. Delete Refunds (Child of Order)
  // These also point TO the Order
  const deletedRefunds = await prisma.refund.deleteMany({});
  console.log(`✅ Deleted ${deletedRefunds.count} Refunds.`);

  // 3. Delete Orders (The Parent)
  // Now that the children are gone, we can safely delete the parent
  const deletedOrders = await prisma.order.deleteMany({});
  console.log(`✅ Deleted ${deletedOrders.count} Orders.`);

  console.log('✨ All order data wiped successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });