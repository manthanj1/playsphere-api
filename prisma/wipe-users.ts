import prisma from '../api/prisma';

async function wipeUsers() {
  // Must delete in order due to FK constraints:
  // BookingSlot → Booking → User / Net / Turf
  const deletedSlots = await prisma.bookingSlot.deleteMany({});
  console.log(`Deleted ${deletedSlots.count} booking slot(s)`);

  const deletedBookings = await prisma.booking.deleteMany({});
  console.log(`Deleted ${deletedBookings.count} booking(s)`);

  const deletedEvents = await prisma.event.deleteMany({});
  console.log(`Deleted ${deletedEvents.count} event(s)`);

  const deletedUsers = await prisma.user.deleteMany({});
  console.log(`Deleted ${deletedUsers.count} user(s)`);

  console.log('\n✅ All user data wiped. You can now sign up fresh!');
  await prisma.$disconnect();
}

wipeUsers().catch((e) => {
  console.error(e);
  process.exit(1);
});
