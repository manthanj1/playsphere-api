import cron from 'node-cron';
import prisma from '../prisma';
import { fetchWeather } from '../services/weather';
import Razorpay from 'razorpay';
import { sendCancellationEmail } from '../services/emailService';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummykey123',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummysecret123',
});

// Run every hour at minute 0
export function startWeatherJob() {
  console.log('[weatherJob] Initializing automated rain cancellation job...');

  const runCheck = async () => {
    console.log('[weatherJob] Running automated rain cancellation check...');
    try {
      // Find today's start and end times in UTC
      const now = new Date();
      const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
      const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));

      // Find all confirmed outdoor turf bookings for today
      const outdoorBookings = await prisma.booking.findMany({
        where: {
          type: 'turf',
          areaType: 'OUTDOOR',
          status: 'CONFIRMED',
          bookingDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        include: {
          turf: true,
        }
      });

      if (outdoorBookings.length === 0) {
        console.log('[weatherJob] No active outdoor bookings found for today.');
        return;
      }

      // Group bookings by Turf ID to avoid fetching weather multiple times for the same location
      const bookingsByTurf = outdoorBookings.reduce((acc, booking) => {
        if (!booking.turfId || !booking.turf) return acc;
        if (!acc[booking.turfId]) acc[booking.turfId] = [];
        acc[booking.turfId].push(booking);
        return acc;
      }, {} as Record<number, typeof outdoorBookings>);

      // Process each turf
      for (const turfId of Object.keys(bookingsByTurf)) {
        const bookingsForTurf = bookingsByTurf[Number(turfId)];
        const turf = bookingsForTurf[0].turf;

        if (!turf) continue;

        try {
          const weather = await fetchWeather(turf.latitude, turf.longitude);
          
          if (weather.isRainy) {
            console.log(`[weatherJob] It is raining at turf ${turf.name} (ID: ${turfId}). Cancelling ${bookingsForTurf.length} outdoor bookings...`);
            
            for (const booking of bookingsForTurf) {
              // 1. Trigger Razorpay Refund
              if (booking.razorpayPaymentId) {
                try {
                  await razorpay.payments.refund(booking.razorpayPaymentId, { speed: "normal" });
                  console.log(`[weatherJob] Refunded booking ${booking.id}`);
                } catch (refundError) {
                  console.error(`[weatherJob] Razorpay refund failed for booking ${booking.id}:`, refundError);
                  // Proceed with DB cancellation even if refund fails (could be dummy key)
                }
              }

              // 2. Update DB in transaction
              await prisma.$transaction(async (tx) => {
                await tx.booking.update({
                  where: { id: booking.id },
                  data: { status: 'CANCELLED' },
                });

                await tx.bookingSlot.deleteMany({
                  where: { bookingId: booking.id },
                });
              });

              // 3. Send Email
              try {
                await sendCancellationEmail(booking.userEmail, booking.userName, turf.name, booking.total);
              } catch (emailErr) {
                console.error(`[weatherJob] Failed to send email for booking ${booking.id}:`, emailErr);
              }

              console.log(`[weatherJob] Successfully cancelled booking ${booking.id}`);
            }
          } else {
            console.log(`[weatherJob] Weather is clear at turf ${turf.name} (ID: ${turfId}).`);
          }
        } catch (weatherErr) {
          console.error(`[weatherJob] Failed to fetch weather for turf ID ${turfId}:`, weatherErr);
        }
      }

    } catch (error) {
      console.error('[weatherJob] Failed to execute job:', error);
    }
  };

  // Run immediately on boot
  runCheck();

  // Then schedule for every hour
  cron.schedule('0 * * * *', runCheck);
}
