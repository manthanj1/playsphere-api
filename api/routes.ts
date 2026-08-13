import { Router, Request, Response } from 'express';
import prisma from './prisma';
import { requireAuth } from './middleware/auth';
import { fetchWeather } from './services/weather';
import multer from 'multer';
import path from 'path';
import {
  createTurfBookingWithLock,
  SlotUnavailableError,
} from './services/booking';
import { sendCancellationEmail } from './services/emailService';

const router = Router();

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });


import { register, login, forgotPassword, resetPassword } from './controllers/authController';

// ── Auth ────────────────────────────────────────────────────────────────────

router.post('/auth/register', register);
router.post('/auth/login', login);
router.post('/auth/forgot-password', forgotPassword);
router.post('/auth/reset-password', resetPassword);

// Get current user (sync/verify)
router.get('/auth/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const dbUser = await prisma.user.findUnique({ where: { id: user.uid } });
    if (!dbUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const { password, resetToken, resetTokenExpiry, ...safeUser } = dbUser;
    res.status(200).json({ user: safeUser });
  } catch (error) {
    console.error('Fetch me failed:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Sync Firebase user with database
router.post('/auth/sync', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { name, email, phone, location, city, imageUrl } = req.body;

    const dbUser = await prisma.user.upsert({
      where: { id: user.uid },
      update: {
        // Only update these if they are not already set, or you can allow overwriting
        // For sync, we might not want to overwrite existing data if it's already there
        // Actually, we'll just update it so the frontend defaults don't get lost
        name: name || undefined,
        email: email || user.email,
        phone: phone || undefined,
      },
      create: {
        id: user.uid,
        email: email || user.email || '',
        name: name || 'Guest',
        phone: phone || null,
        imageUrl: imageUrl || null,
      }
    });

    const { password, resetToken, resetTokenExpiry, ...safeUser } = dbUser;
    res.status(200).json({ user: safeUser });
  } catch (error) {
    console.error('Sync user failed:', error);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

// Upload profile photo
router.post('/auth/profile-photo', requireAuth, upload.single('photo'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!req.file) {
      res.status(400).json({ error: 'No photo uploaded' });
      return;
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    const dbUser = await prisma.user.update({
      where: { id: user.uid },
      data: { imageUrl }
    });

    res.status(200).json({ imageUrl: dbUser.imageUrl });
  } catch (error) {
    console.error('Upload profile photo failed:', error);
    res.status(500).json({ error: 'Failed to upload profile photo' });
  }
});


// ── Events ───────────────────────────────────────────────────────────────────

const generateEventTiers = (event: any) => {
  const basePrice = event.price || 499;
  if (event.category === "Music" || event.category === "Cultural") {
    return [
      { id: "early-bird", name: "Early Bird", price: basePrice, features: ["Event entry", "Standing area"] },
      { id: "general", name: "General Admission", price: Math.round(basePrice * 1.5), features: ["Event entry", "Standard seating"] },
      { id: "vip", name: "Backstage Pass", price: Math.round(basePrice * 3), features: ["Priority entry", "Backstage access", "VIP seating"] }
    ];
  } else if (event.category === "Sports" || event.category === "Wellness") {
    return [
      { id: "spectator", name: "Spectator Pass", price: basePrice, features: ["Entry to venue", "Spectator seating"] },
      { id: "participant", name: "Participant Entry", price: Math.round(basePrice * 2), features: ["Full participation", "Kit provided"] }
    ];
  } else {
    return [
      { id: "standard", name: "Standard Entry", price: basePrice, features: ["Event entry", "Standard access"] },
      { id: "premium", name: "Premium Access", price: Math.round(basePrice * 2.5), features: ["Fast-track entry", "Premium lounge access"] },
      { id: "ultra", name: "Ultra VIP", price: Math.round(basePrice * 4), features: ["All access", "Meet & Greet", "Free food & beverages"] }
    ];
  }
};

// Public event listing
router.get('/events', async (_req: Request, res: Response) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { date: 'asc' },
      include: { host: true },
    });
    const eventsWithTiers = events.map(event => ({
      ...event,
      tiers: generateEventTiers(event)
    }));
    res.status(200).json({ events: eventsWithTiers });
  } catch (error) {
    console.error('Fetch events failed:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Single event by ID
router.get('/events/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: { host: true },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.status(200).json({ event: { ...event, tiers: generateEventTiers(event) } });
  } catch (error) {
    console.error('Fetch event failed:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Create event
router.post('/events', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { title, description, city, date } = req.body;

    if (!title || !city || !date) {
      res.status(400).json({ error: 'Missing required fields: title, city, date' });
      return;
    }

    const createdEvent = await prisma.event.create({
      data: {
        title,
        description: description ?? null,
        city,
        date: new Date(date),
        hostId: user.uid,
      },
      include: { host: true },
    });

    res.status(201).json({ event: createdEvent });
  } catch (error) {
    console.error('Create event failed:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update event
router.put('/events/:id', requireAuth, async (req: Request<{ id: string }>, res: Response) => {
  try {
    const user = (req as any).user;
    const { title, description, city, date } = req.body;
    const eventId = req.params.id;

    const existingEvent = await prisma.event.findUnique({ where: { id: eventId } });
    if (!existingEvent) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    if (existingEvent.hostId !== user.uid) {
      res.status(403).json({ error: 'Forbidden: Only the event host can update this event' });
      return;
    }

    const updatedEvent = await prisma.event.update({
      where: { id: eventId },
      data: {
        title: title ?? existingEvent.title,
        description: description ?? existingEvent.description,
        city: city ?? existingEvent.city,
        date: date ? new Date(date) : existingEvent.date,
      },
      include: { host: true },
    });

    res.status(200).json({ event: updatedEvent });
  } catch (error) {
    console.error('Update event failed:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete event
router.delete('/events/:id', requireAuth, async (req: Request<{ id: string }>, res: Response) => {
  try {
    const user = (req as any).user;
    const eventId = req.params.id;

    const existingEvent = await prisma.event.findUnique({ where: { id: eventId } });
    if (!existingEvent) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    if (existingEvent.hostId !== user.uid) {
      res.status(403).json({ error: 'Forbidden: Only the event host can delete this event' });
      return;
    }

    await prisma.event.delete({ where: { id: eventId } });
    res.status(200).json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event failed:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ── Turfs ────────────────────────────────────────────────────────────────────

// List all turfs from DB
router.get('/turfs', async (_req: Request, res: Response) => {
  try {
    const turfs = await prisma.turf.findMany({ orderBy: { id: 'asc' } });
    res.status(200).json({ turfs });
  } catch (error) {
    console.error('Fetch turfs failed:', error);
    res.status(500).json({ error: 'Failed to fetch turfs' });
  }
});

// Single turf with live weather
router.get('/turfs/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid turf ID' });
      return;
    }

    const turf = await prisma.turf.findUnique({
      where: { id },
      include: { nets: { orderBy: { name: 'asc' } } },
    });

    if (!turf) {
      res.status(404).json({ error: 'Turf not found' });
      return;
    }

    // Fetch live weather — graceful fallback on failure
    const weather = await fetchWeather(turf.latitude, turf.longitude).catch(() => ({
      isRainy: false,
      weatherCode: null as number | null,
      temperature: null as number | null,
    }));

    res.status(200).json({ turf, ...weather });
  } catch (error) {
    console.error('Fetch turf failed:', error);
    res.status(500).json({ error: 'Failed to fetch turf' });
  }
});

// Nets for a turf — with per-net booked-slot data for a given date
// GET /api/turfs/:id/nets?date=YYYY-MM-DD
router.get('/turfs/:id/nets', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const turfId = parseInt(req.params.id, 10);
    if (isNaN(turfId)) {
      res.status(400).json({ error: 'Invalid turf ID' });
      return;
    }

    const turf = await prisma.turf.findUnique({ where: { id: turfId } });
    if (!turf) {
      res.status(404).json({ error: 'Turf not found' });
      return;
    }

    // Parse date query param — default to today (UTC)
    const dateStr = (req.query.date as string | undefined) ?? new Date().toISOString().split('T')[0];
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
      return;
    }
    // Normalise to UTC midnight so it matches the DB @db.Date values
    const bookingDate = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));

    // Fetch nets with their booked slots for the requested date
    const nets = await prisma.net.findMany({
      where: { turfId },
      include: {
        bookingSlots: {
          where: { bookingDate },
          select: { timeslot: true },
        },
      },
      orderBy: [{ areaType: 'asc' }, { name: 'asc' }],
    });

    // Fetch live weather — graceful fallback
    const weather = await fetchWeather(turf.latitude, turf.longitude).catch(() => ({
      isRainy: false,
      weatherCode: null as number | null,
      temperature: null as number | null,
    }));

    const formattedNets = nets.map((net) => ({
      id: net.id,
      name: net.name,
      areaType: net.areaType,
      bookedSlots: net.bookingSlots.map((s) => s.timeslot),
    }));

    res.status(200).json({ nets: formattedNets, ...weather });
  } catch (error) {
    console.error('Fetch nets failed:', error);
    res.status(500).json({ error: 'Failed to fetch nets' });
  }
});

// ── Bookings ─────────────────────────────────────────────────────────────────

// Create a turf booking — protected, with transactional double-booking lock
router.post('/bookings', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const {
      type = 'turf',
      eventId,
      turfId,
      netId,
      areaType,
      bookingDate: bookingDateRaw,
      timeslots,
      amount,
      platformFee,
      total,
      razorpayPaymentId,
      razorpayOrderId
    } = req.body as any;

    if (amount == null || platformFee == null || total == null) {
      res.status(400).json({ error: 'Missing numeric fields.' });
      return;
    }

    const parsedAmount = parseInt(amount, 10);
    const parsedFee = parseInt(platformFee, 10);
    const parsedTotal = parseInt(total, 10);

    if (isNaN(parsedAmount) || isNaN(parsedFee) || isNaN(parsedTotal)) {
      res.status(400).json({ error: 'Numeric fields are not valid.' });
      return;
    }

    // Pull latest user details from DB
    const dbUser = await prisma.user.findUnique({ where: { id: user.uid } });
    const userName = dbUser?.name ?? (user.name as string | undefined) ?? 'Guest';
    const userEmail = dbUser?.email ?? (user.email as string | undefined) ?? '';
    const userPhone = dbUser?.phone ?? '';

    let booking;

    if (type === 'event') {
      if (!eventId || !bookingDateRaw) {
        res.status(400).json({ error: 'Missing eventId or bookingDate for event booking.' });
        return;
      }
      const bookingDate = new Date(bookingDateRaw);
      
      booking = await prisma.booking.create({
        data: {
          userId: user.uid,
          userName,
          userEmail,
          userPhone,
          type: 'event',
          eventId: eventId,
          bookingDate,
          amount: parsedAmount,
          platformFee: parsedFee,
          total: parsedTotal,
          status: 'CONFIRMED',
          razorpayPaymentId,
          razorpayOrderId
        }
      });
    } else {
      // Turf booking
      if (!turfId || !netId || !areaType || !bookingDateRaw || !Array.isArray(timeslots) || timeslots.length === 0) {
        res.status(400).json({ error: 'Missing required turf booking fields.' });
        return;
      }

      const parsedTurfId = parseInt(turfId, 10);
      if (isNaN(parsedTurfId)) {
        res.status(400).json({ error: 'Invalid turfId.' });
        return;
      }

      const bookingDate = new Date(bookingDateRaw);
      if (isNaN(bookingDate.getTime())) {
        res.status(400).json({ error: 'Invalid bookingDate format. Use ISO 8601.' });
        return;
      }

      booking = await createTurfBookingWithLock(prisma, {
        userId: user.uid,
        userName,
        userEmail,
        userPhone,
        turfId: parsedTurfId,
        netId: netId,
        areaType: areaType as 'INDOOR' | 'OUTDOOR',
        bookingDate,
        timeslots: timeslots,
        amount: parsedAmount,
        platformFee: parsedFee,
        total: parsedTotal,
        razorpayPaymentId,
        razorpayOrderId
      });
    }

    res.status(201).json({ booking });
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      res.status(409).json({ error: error.message });
      return;
    }
    console.error('Create booking failed:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// List bookings for the authenticated user
router.get('/bookings', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const bookings = await prisma.booking.findMany({
      where: { userId: user.uid },
      include: { turf: true, net: true, slots: true, event: true },
      orderBy: { createdAt: 'desc' },
    });

    const formattedBookings = bookings.map((b: any) => {
      if (b.type === 'turf') {
        return {
          bookingId: b.id,
          type: "turf",
          itemId: String(b.turfId),
          itemName: b.turf?.name || "Unknown Turf",
          sportOrCategory: b.turf?.sport || "Sport",
          city: b.turf?.city || "",
          date: b.bookingDate,
          slots: b.slots ? b.slots.map((s: any) => s.timeslot) : [],
          amount: b.amount,
          platformFee: b.platformFee,
          total: b.total,
          location: b.turf?.location || "",
          netId: b.netId,
          netName: b.net?.name || "Net",
          createdAt: b.createdAt,
          imageUrl: b.turf?.image || "",
          status: b.status,
        };
      } else {
        return {
          bookingId: b.id,
          type: "event",
          itemId: String(b.eventId),
          itemName: b.event?.title || "Unknown Event",
          sportOrCategory: b.event?.category || "Event",
          city: b.event?.city || "",
          date: b.bookingDate,
          slots: [],
          amount: b.amount,
          platformFee: b.platformFee,
          total: b.total,
          location: b.event?.location || b.event?.city || "",
          createdAt: b.createdAt,
          imageUrl: b.event?.imageUrl || `/images/placeholders/image-${8 + parseInt(String(b.eventId).split('-')[1] || "1", 10)}.jpg?v=3`,
          status: b.status,
        };
      }
    });

    res.status(200).json({ bookings: formattedBookings });
  } catch (error) {
    console.error('Fetch bookings failed:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Cancel a booking
router.post('/bookings/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const bookingId = req.params.id as string;
    const userId = (req as any).user.uid;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { slots: true, turf: true, event: true },
    });

    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    if (booking.userId !== userId) {
      res.status(403).json({ error: 'Unauthorized to cancel this booking' });
      return;
    }

    if (booking.status === 'CANCELLED') {
      res.status(400).json({ error: 'Booking is already cancelled' });
      return;
    }

    let startTime = booking.bookingDate.getTime();
    const slots = (booking as any).slots;

    if (booking.type === 'turf' && slots && slots.length > 0) {
      // Find the earliest timeslot
      const earliestSlot = slots.reduce((earliest: any, current: any) => {
        const earliestStartTime = earliest.timeslot.split(' - ')[0];
        const currentStartTime = current.timeslot.split(' - ')[0];
        return currentStartTime < earliestStartTime ? current : earliest;
      });

      const slotStartTimeStr = earliestSlot.timeslot.split(' - ')[0];
      const slotDate = new Date(`${booking.bookingDate.toISOString().split('T')[0]}T${slotStartTimeStr}:00`);
      startTime = slotDate.getTime();
    } else {
      // For events, default to 10:00 AM if no time specified, or just use bookingDate
      const dateStr = booking.bookingDate.toISOString().split('T')[0];
      startTime = new Date(`${dateStr}T10:00:00`).getTime();
    }

    const now = Date.now();
    const msIn24Hours = 24 * 60 * 60 * 1000;
    
    if (startTime - now < msIn24Hours) {
      res.status(400).json({ error: 'Cancellations are only permitted at least 24 hours prior to the booking time.' });
      return;
    }

    // Process Razorpay refund if possible
    if (booking.razorpayPaymentId) {
      try {
        await razorpay.payments.refund(booking.razorpayPaymentId, { speed: "normal" });
      } catch (refundError) {
        console.error('Razorpay refund failed (might be dummy key):', refundError);
        // In dummy mode, we don't throw an error, we still cancel the booking locally.
      }
    }

    // Perform DB updates in transaction
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' },
      });

      if (booking.type === 'turf') {
        await tx.bookingSlot.deleteMany({
          where: { bookingId: bookingId },
        });
      }
    });

    // Send cancellation email
    try {
      const itemName = booking.type === 'turf' ? (booking as any).turf?.name || 'Turf' : (booking as any).event?.title || 'Event';
      await sendCancellationEmail(booking.userEmail, booking.userName, itemName, booking.total);
    } catch (emailError) {
      console.error('Failed to send cancellation email:', emailError);
    }

    res.status(200).json({ success: true, message: 'Booking cancelled and refund initiated' });
  } catch (error) {
    console.error('Cancellation failed:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// ── Payments (Razorpay) ────────────────────────────────────────────────────────

import Razorpay from 'razorpay';
import crypto from 'crypto';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummykey123',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummysecret123',
});

router.post('/payment/create-order', requireAuth, async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    if (!amount) {
      res.status(400).json({ error: 'Amount is required' });
      return;
    }

    const options = {
      amount: parseInt(amount, 10) * 100, // amount in smallest currency unit (paise)
      currency: "INR",
      receipt: `receipt_order_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json({ order });
  } catch (error) {
    console.error('Create Razorpay order failed:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

router.post('/payment/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ error: 'Missing Razorpay parameters' });
      return;
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || 'dummysecret123';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    if (generated_signature === razorpay_signature) {
      res.status(200).json({ success: true, message: 'Payment verified successfully' });
    } else {
      res.status(400).json({ success: false, error: 'Invalid signature' });
    }
  } catch (error) {
    console.error('Verify Razorpay payment failed:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

export default router;
