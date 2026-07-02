const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.laporanBarang.updateMany({
    where: { volume: "1" },
    data: { volume_kumulatif: 10, volume_program: 20, pendapatan_kumulatif: 10, pendapatan_program: 20 }
  });
  await prisma.laporanBarang.updateMany({
    where: { volume: "2" },
    data: { volume_kumulatif: 20, volume_program: 40, pendapatan_kumulatif: 20, pendapatan_program: 40 }
  });
  await prisma.laporanBarang.updateMany({
    where: { volume: "3" },
    data: { volume_kumulatif: 30, volume_program: 60, pendapatan_kumulatif: 30, pendapatan_program: 60 }
  });
  await prisma.laporanBarang.updateMany({
    where: { volume: "4" },
    data: { volume_kumulatif: 40, volume_program: 80, pendapatan_kumulatif: 40, pendapatan_program: 80 }
  });
  await prisma.laporanBarang.updateMany({
    where: { volume: "5" },
    data: { volume_kumulatif: 50, volume_program: 100, pendapatan_kumulatif: 50, pendapatan_program: 100 }
  });
  console.log("Updated dummy data for demo");
}
main();
