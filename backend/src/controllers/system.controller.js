const os = require('os');
const { sendSuccess } = require('../utils/response');

let previousCpuInfo = null;

// Helper to calculate CPU usage
const getCpuUsage = () => {
  const cpus = os.cpus();
  if (!cpus) return 0;

  let idle = 0;
  let total = 0;

  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  });

  if (previousCpuInfo) {
    const idleDifference = idle - previousCpuInfo.idle;
    const totalDifference = total - previousCpuInfo.total;
    const usage = 100 - Math.floor((100 * idleDifference) / totalDifference);
    previousCpuInfo = { idle, total };
    return usage;
  } else {
    previousCpuInfo = { idle, total };
    // Fallback on first run, it will return an average across all uptime
    const usage = 100 - Math.floor((100 * idle) / total);
    return usage;
  }
};

const getSystemStats = (req, res) => {
  // RAM
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const ramUsagePercent = Math.round((usedMem / totalMem) * 100);

  // CPU
  const cpuUsagePercent = getCpuUsage();

  return sendSuccess(res, {
    ram: ramUsagePercent,
    cpu: cpuUsagePercent,
    timestamp: new Date().toISOString()
  });
};

module.exports = { getSystemStats };
