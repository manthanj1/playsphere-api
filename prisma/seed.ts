import 'dotenv/config';
import prisma from '../api/prisma';

async function main() {
  // ── Seed host user ──────────────────────────────────────────────────────────
  const host = await prisma.user.upsert({
    where: { id: 'seed-host' },
    update: {
      email: 'seed@playsphere.test',
      name: 'PlaySphere Admin',
      imageUrl: null,
    },
    create: {
      id: 'seed-host',
      email: 'seed@playsphere.test',
      name: 'PlaySphere Admin',
      imageUrl: null,
    },
  });

  // ── Seed events ─────────────────────────────────────────────────────────────
  const eventData = [
    {
      id: "event-1",
      title: "Ahmedabad Summer Sports Fest",
      description: "A weekend celebration of cricket, soccer, and fitness workouts at the Ahmedabad Exhibition Grounds.",
      category: "Sports",
      city: "Ahmedabad",
      location: "Ahmedabad Exhibition Grounds",
      date: new Date("2026-09-10T17:00:00.000Z"),
      price: 799,
      hostId: host.id,
    },
    {
      id: "event-2",
      title: "Surat Power Yoga Championship",
      description: "A full-day yoga and wellness event with expert instructors and mindful sound baths.",
      category: "Wellness",
      city: "Surat",
      location: "Surat Yoga Complex",
      date: new Date("2026-09-18T08:30:00.000Z"),
      price: 599,
      hostId: host.id,
    },
    {
      id: "event-3",
      title: "Gandhinagar Night Marathon",
      description: "A scenic night run through Gandhinagar with live music, hydration packs, and finish-line celebrations.",
      category: "Sports",
      city: "Gandhinagar",
      location: "Gandhinagar Riverfront",
      date: new Date("2026-10-05T19:00:00.000Z"),
      price: 999,
      hostId: host.id,
    },
    {
      id: "event-4",
      title: "Vadodara Garba Nights",
      description: "An electrifying Navratri celebration with live music, professional garba performers, and vibrant decor.",
      category: "Cultural",
      city: "Vadodara",
      location: "Vadodara Exhibition Centre",
      date: new Date("2026-10-16T20:00:00.000Z"),
      price: 499,
      hostId: host.id,
    },
    {
      id: "event-5",
      title: "Ahmedabad Jazz & Food Carnival",
      description: "A musical evening with jazz artists, gourmet food stalls, and artisanal market pop-ups.",
      category: "Music",
      city: "Ahmedabad",
      location: "The Amphitheatre",
      date: new Date("2026-11-02T18:00:00.000Z"),
      price: 1299,
      hostId: host.id,
    },
    {
      id: "event-6",
      title: "Surat Wellness Retreat",
      description: "A weekend retreat focused on yoga, breathing sessions, and wellness workshops in a serene resort setting.",
      category: "Wellness",
      city: "Surat",
      location: "Tapi Valley Resort",
      date: new Date("2026-11-12T09:00:00.000Z"),
      price: 1499,
      hostId: host.id,
    },
    {
      id: "event-7",
      title: "Gandhinagar Tech Sports Meetup",
      description: "A niche event connecting tech enthusiasts with friendly sports competitions and networking opportunities.",
      category: "Sports",
      city: "Gandhinagar",
      location: "Capital Sports Complex",
      date: new Date("2026-12-05T16:00:00.000Z"),
      price: 299,
      hostId: host.id,
    },
    {
      id: "event-8",
      title: "Ahmedabad Rock & Rhythm Night",
      description: "A high-energy music concert featuring top Indian rock acts and gourmet street food stalls.",
      category: "Music",
      city: "Ahmedabad",
      location: "The Arena",
      date: new Date("2026-11-15T19:30:00.000Z"),
      price: 1599,
      hostId: host.id,
    },
    {
      id: "event-9",
      title: "Surat Family Fun Run",
      description: "A family-friendly 5km fun run with music, food stalls, and kid-friendly competitions.",
      category: "Sports",
      city: "Surat",
      location: "Tapi Riverfront",
      date: new Date("2026-10-25T07:00:00.000Z"),
      price: 699,
      hostId: host.id,
    },
    {
      id: "event-10",
      title: "Vadodara Street Food Festival",
      description: "A delicious cultural festival with 50+ food stalls, live performances, and local artisans.",
      category: "Cultural",
      city: "Vadodara",
      location: "Alkapuri Chakla",
      date: new Date("2026-11-01T17:00:00.000Z"),
      price: 399,
      hostId: host.id,
    }
  ];

  for (const event of eventData) {
    await prisma.event.upsert({
      where: { id: event.id },
      update: {
        title: event.title,
        description: event.description,
        city: event.city,
        date: event.date,
        hostId: event.hostId,
      },
      create: event,
    });
  }

  // ── Seed turfs (IDs must match frontend static data in lib/backend.ts) ──────
  const turfData = [
    {
      id: 1,
      name: 'Spartan Box Cricket',
      city: 'Ahmedabad',
      location: 'Sindhu Bhavan Road',
      sport: 'Cricket',
      price: 1200,
      rating: 4.8,
      reviews: 124,
      latitude: 23.0395,
      longitude: 72.5490,
      image: '/images/placeholders/image-1.jpg',
      description:
        'Top-tier indoor box cricket arena with premium turf and LED floodlights. Ideal for competitive teams and weekend matches.',
      amenities: ['Free Parking', 'RO Water', 'LED Floodlights', 'Cafeteria'],
    },
    {
      id: 2,
      name: 'KickOff Football Arena',
      city: 'Ahmedabad',
      location: 'SG Highway',
      sport: 'Football',
      price: 1500,
      rating: 4.9,
      reviews: 89,
      latitude: 23.0452,
      longitude: 72.5071,
      image: '/images/placeholders/image-2.jpg',
      description:
        'Expansive outdoor football arena with FIFA-grade turf and premium coaching staff. Great for leagues and practice sessions.',
      amenities: ['Locker Rooms', 'RO Water', 'Spectator Seating', 'Night Lighting'],
    },
    {
      id: 3,
      name: 'Titan Padel Hub',
      city: 'Ahmedabad',
      location: 'Thaltej',
      sport: 'Padel',
      price: 1800,
      rating: 4.9,
      reviews: 32,
      latitude: 23.0619,
      longitude: 72.5078,
      image: '/images/placeholders/image-3.jpg',
      description:
        'Modern padel courts with comfortable seating and a coaching team on standby. Perfect for doubles play and social matches.',
      amenities: ['Equipment Rental', 'Refreshments', 'LED Lighting', 'Match Referees'],
    },
    {
      id: 4,
      name: 'Diamond City Sports Hub',
      city: 'Surat',
      location: 'Vesu',
      sport: 'Cricket',
      price: 1000,
      rating: 4.7,
      reviews: 210,
      latitude: 21.1453,
      longitude: 72.7836,
      image: '/images/placeholders/image-4.jpg',
      description:
        'Spacious cricket ground with turf wickets and an energetic local crowd. Ideal for tournament play and friendly matches.',
      amenities: ['Changing Rooms', 'Food Court', 'First Aid', 'Coach on Call'],
    },
    {
      id: 5,
      name: 'Tapi Green Football',
      city: 'Surat',
      location: 'Adajan',
      sport: 'Football',
      price: 1400,
      rating: 4.6,
      reviews: 167,
      latitude: 21.1922,
      longitude: 72.8016,
      image: '/images/placeholders/image-5.jpg',
      description:
        'Professional football field with natural turf and advanced goalkeeping facilities. A favorite for amateur leagues.',
      amenities: ['Ball Rental', 'Spectator Stands', 'Cafeteria', 'First Aid'],
    },
    {
      id: 6,
      name: 'Surat Tennis Academy',
      city: 'Surat',
      location: 'Piplod',
      sport: 'Tennis',
      price: 900,
      rating: 4.8,
      reviews: 88,
      latitude: 21.1587,
      longitude: 72.7974,
      image: '/images/placeholders/image-6.jpg',
      description:
        'High-performance tennis courts with practice walls, coaching spaces, and tournament-grade surfacing.',
      amenities: ['Coach Training', 'Refreshments', 'Indoor Courts', 'Secure Lockers'],
    },
    {
      id: 7,
      name: 'Banyan City Box',
      city: 'Vadodara',
      location: 'Alkapuri',
      sport: 'Cricket',
      price: 1100,
      rating: 4.5,
      reviews: 56,
      latitude: 22.3072,
      longitude: 73.1812,
      image: '/images/placeholders/image-7.jpg',
      description:
        'Premium box cricket experience with fast-paced nets and strategic lighting. Comfortable seating for teams and guests.',
      amenities: ['Washrooms', 'Hydration Station', 'LED Lights', 'Scoreboard'],
    },
    {
      id: 8,
      name: 'Vadodara Multi-Sport Arena',
      city: 'Vadodara',
      location: 'Sama-Savli Road',
      sport: 'Multi-sport',
      price: 1300,
      rating: 4.7,
      reviews: 142,
      latitude: 22.3342,
      longitude: 73.2136,
      image: '/images/placeholders/image-8.jpg',
      description:
        'Versatile multi-sport arena hosting basketball, volleyball, and futsal. Designed for team training and corporate tournaments.',
      amenities: ['Multipurpose Courts', 'Sound System', 'Air Cooling', 'Refreshments'],
    },
  ];

  for (const turf of turfData) {
    const { id, amenities, ...rest } = turf;
    await prisma.turf.upsert({
      where: { id },
      update: { ...rest, amenities },
      create: { id, ...rest, amenities },
    });

    // Seed 6 nets per turf (3 indoor, 3 outdoor) — only if none exist yet
    const existingNetCount = await prisma.net.count({ where: { turfId: id } });
    if (existingNetCount === 0) {
      await prisma.net.createMany({
        data: [
          { turfId: id, name: 'Net A', areaType: 'INDOOR' },
          { turfId: id, name: 'Net B', areaType: 'INDOOR' },
          { turfId: id, name: 'Net C', areaType: 'INDOOR' },
          { turfId: id, name: 'Net D', areaType: 'OUTDOOR' },
          { turfId: id, name: 'Net E', areaType: 'OUTDOOR' },
          { turfId: id, name: 'Net F', areaType: 'OUTDOOR' },
        ],
      });
    }
  }

  // Reset the Turf id sequence so future inserts don't collide with seeded IDs
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Turf"', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM "Turf"), 8))`;

  const turfCount = await prisma.turf.count();
  const netCount = await prisma.net.count();
  const eventCount = await prisma.event.count();
  console.log(`Seed complete. ${turfCount} turf(s), ${netCount} net(s), ${eventCount} event(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
