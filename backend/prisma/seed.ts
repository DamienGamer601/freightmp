import "dotenv/config";
import { PrismaClient, type Game } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedServer {
  name: string;
  slug: string;
  game: Game;
  port: number;
  region: string;
}

interface SeedDelivery {
  serverSlug: string;
  cargoName: string;
  fromCity: string;
  toCity: string;
  distanceKm: number;
  income: number;
  daysAgo: number;
  durationMinutes: number;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

const sampleDeliveries: SeedDelivery[] = [
  { serverSlug: "fmp-eu-1", cargoName: "Frozen Food", fromCity: "Duisburg", toCity: "Berlin", distanceKm: 484, income: 2450, daysAgo: 2, durationMinutes: 340 },
  { serverSlug: "fmp-eu-1", cargoName: "Electronics", fromCity: "Amsterdam", toCity: "Paris", distanceKm: 429, income: 2210, daysAgo: 4, durationMinutes: 315 },
  { serverSlug: "fmp-na-1", cargoName: "Machinery", fromCity: "Los Angeles", toCity: "Phoenix", distanceKm: 595, income: 3120, daysAgo: 6, durationMinutes: 420 },
  { serverSlug: "fmp-eu-2", cargoName: "Steel Coils", fromCity: "Stuttgart", toCity: "Milan", distanceKm: 486, income: 2380, daysAgo: 8, durationMinutes: 355 },
  { serverSlug: "fmp-eu-1", cargoName: "Furniture", fromCity: "Calais", toCity: "Madrid", distanceKm: 1287, income: 5420, daysAgo: 10, durationMinutes: 860 },
  { serverSlug: "fmp-na-1", cargoName: "Fresh Fruit", fromCity: "Las Vegas", toCity: "Seattle", distanceKm: 1208, income: 5680, daysAgo: 13, durationMinutes: 780 },
  { serverSlug: "fmp-eu-2", cargoName: "Wooden Boards", fromCity: "Lyon", toCity: "Prague", distanceKm: 1005, income: 4280, daysAgo: 16, durationMinutes: 690 },
  { serverSlug: "fmp-eu-1", cargoName: "Cement", fromCity: "Hamburg", toCity: "Munich", distanceKm: 771, income: 3260, daysAgo: 19, durationMinutes: 520 },
  { serverSlug: "fmp-na-1", cargoName: "Diesel", fromCity: "Dallas", toCity: "Denver", distanceKm: 1069, income: 4920, daysAgo: 22, durationMinutes: 740 },
  { serverSlug: "fmp-eu-2", cargoName: "Yacht", fromCity: "Milan", toCity: "Amsterdam", distanceKm: 1089, income: 4850, daysAgo: 25, durationMinutes: 720 },
  { serverSlug: "fmp-eu-1", cargoName: "Frozen Food", fromCity: "Prague", toCity: "Duisburg", distanceKm: 762, income: 3240, daysAgo: 29, durationMinutes: 510 },
  { serverSlug: "fmp-na-1", cargoName: "Machinery", fromCity: "Phoenix", toCity: "Salt Lake City", distanceKm: 1065, income: 4990, daysAgo: 33, durationMinutes: 730 },
  { serverSlug: "fmp-eu-2", cargoName: "Electronics", fromCity: "Berlin", toCity: "Lyon", distanceKm: 1138, income: 4760, daysAgo: 37, durationMinutes: 780 },
  { serverSlug: "fmp-eu-1", cargoName: "Steel Coils", fromCity: "Madrid", toCity: "Lyon", distanceKm: 1082, income: 4610, daysAgo: 41, durationMinutes: 760 },
];

async function main(): Promise<void> {
  const discordId = process.env.SEED_ADMIN_DISCORD_ID?.trim() || null;

  const admin = await prisma.user.upsert({
    where: { username: "FIC-Admin" },
    update: {
      role: "ADMIN",
      ...(discordId ? { discordId } : {}),
      bio: "Fondateur de FR | Industries Corporation et administrateur de FreightMP. Toujours sur la route 🚚",
      title: "Fondateur FMP",
      accentColor: "rouge",
      bannerUrl: null,
    },
    create: {
      username: "FIC-Admin",
      role: "ADMIN",
      discordId,
      bio: "Fondateur de FR | Industries Corporation et administrateur de FreightMP. Toujours sur la route 🚚",
      title: "Fondateur FMP",
      accentColor: "rouge",
      bannerUrl: null,
    },
  });

  const servers: SeedServer[] = [
    { name: "FMP EU #1", slug: "fmp-eu-1", game: "ETS2", port: 27015, region: "Europe" },
    { name: "FMP EU #2", slug: "fmp-eu-2", game: "ETS2", port: 27016, region: "Europe" },
    { name: "FMP NA #1", slug: "fmp-na-1", game: "ATS", port: 27017, region: "North America" },
  ];

  for (const server of servers) {
    await prisma.server.upsert({
      where: { slug: server.slug },
      update: {
        name: server.name,
        game: server.game,
        host: "127.0.0.1",
        port: server.port,
        region: server.region,
      },
      create: {
        name: server.name,
        slug: server.slug,
        game: server.game,
        status: "OFFLINE",
        host: "127.0.0.1",
        port: server.port,
        region: server.region,
      },
    });
  }

  const allServers = await prisma.server.findMany();
  const serverBySlug = new Map(allServers.map((s) => [s.slug, s]));

  // Livraisons d'exemple (idempotent : on repart de zéro pour l'admin).
  await prisma.delivery.deleteMany({ where: { userId: admin.id } });

  for (const delivery of sampleDeliveries) {
    const startedAt = daysAgo(delivery.daysAgo);
    const completedAt = new Date(
      startedAt.getTime() + delivery.durationMinutes * 60 * 1000,
    );
    const server = serverBySlug.get(delivery.serverSlug);

    await prisma.delivery.create({
      data: {
        userId: admin.id,
        serverId: server?.id ?? null,
        cargoName: delivery.cargoName,
        fromCity: delivery.fromCity,
        toCity: delivery.toCity,
        distanceKm: delivery.distanceKm,
        income: delivery.income,
        startedAt,
        completedAt,
      },
    });
  }

  const deliveries = await prisma.delivery.findMany({
    where: { userId: admin.id },
  });
  const totalKm = deliveries.reduce((sum, d) => sum + d.distanceKm, 0);
  const totalPlaySeconds = deliveries.reduce(
    (sum, d) => sum + (d.completedAt && d.startedAt ? (d.completedAt.getTime() - d.startedAt.getTime()) / 1000 : 0),
    0,
  );

  await prisma.user.update({
    where: { id: admin.id },
    data: {
      kilometersDriven: totalKm,
      deliveriesCompleted: deliveries.length,
      totalPlayTimeSeconds: Math.round(totalPlaySeconds),
    },
  });

  console.log(
    `Seed complete: admin profil + ${deliveries.length} livraisons (${Math.round(totalKm)} km) + ${servers.length} serveurs.`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
