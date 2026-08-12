import { Prisma, PrismaClient } from '@prisma/client';

export class SlotUnavailableError extends Error {
  constructor(message = 'Slot no longer available') {
    super(message);
    this.name = 'SlotUnavailableError';
  }
}

export interface CreateTurfBookingInput {
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  turfId: number;
  netId: string;
  areaType: 'INDOOR' | 'OUTDOOR';
  bookingDate: Date;
  timeslots: string[];
  amount: number;
  platformFee: number;
  total: number;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
}

function normalizeDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function createTurfBookingWithLock(
  prisma: PrismaClient,
  input: CreateTurfBookingInput,
) {
  const bookingDate = normalizeDate(input.bookingDate);

  return prisma.$transaction(async (tx) => {
    for (const timeslot of input.timeslots) {
      const existing = await tx.bookingSlot.findUnique({
        where: {
          turfId_netId_bookingDate_timeslot: {
            turfId: input.turfId,
            netId: input.netId,
            bookingDate,
            timeslot,
          },
        },
      });

      if (existing) {
        throw new SlotUnavailableError();
      }
    }

    try {
      return await tx.booking.create({
        data: {
          userId: input.userId,
          userName: input.userName,
          userEmail: input.userEmail,
          userPhone: input.userPhone,
          turfId: input.turfId,
          netId: input.netId,
          bookingDate,
          areaType: input.areaType,
          amount: input.amount,
          platformFee: input.platformFee,
          total: input.total,
          status: 'CONFIRMED',
          razorpayPaymentId: input.razorpayPaymentId,
          razorpayOrderId: input.razorpayOrderId,
          slots: {
            create: input.timeslots.map((timeslot) => ({
              netId: input.netId,
              turfId: input.turfId,
              bookingDate,
              timeslot,
            })),
          },
        },
        include: {
          net: true,
          turf: true,
          slots: true,
          user: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new SlotUnavailableError();
      }
      throw error;
    }
  });
}

export async function getBookedSlotsForNet(
  prisma: PrismaClient,
  turfId: number,
  netId: string,
  bookingDate: Date,
): Promise<string[]> {
  const normalized = normalizeDate(bookingDate);
  const slots = await prisma.bookingSlot.findMany({
    where: { turfId, netId, bookingDate: normalized },
    select: { timeslot: true },
  });
  return slots.map((s) => s.timeslot);
}
