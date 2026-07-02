const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDuplicates() {
  const allBarang = await prisma.laporanBarang.findMany({
    orderBy: { id_laporan_barang: 'desc' } // Newer first
  });

  const seen = new Set();
  let deletedCount = 0;

  for (const item of allBarang) {
    const key = `${item.id_laporan}-${item.id_komoditi}`;
    if (seen.has(key)) {
      // It's a duplicate (and older, since we ordered by desc)
      await prisma.laporanBarang.delete({
        where: { id_laporan_barang: item.id_laporan_barang }
      });
      deletedCount++;
      console.log(`Deleted duplicate ID: ${item.id_laporan_barang} for Laporan: ${item.id_laporan}, Komoditi: ${item.id_komoditi}`);
    } else {
      seen.add(key);
    }
  }

  console.log(`Cleanup complete. Deleted ${deletedCount} duplicate rows.`);
}

cleanDuplicates().catch(console.error).finally(() => prisma.$disconnect());
