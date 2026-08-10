const os = require("os");

const port = process.env.PORT || 3000;

console.log("╔════════════════════════════════════════════╗");
console.log("║     NATURA CONVERTER — SERVER STARTING     ║");
console.log("╚════════════════════════════════════════════╝");

const interfaces = os.networkInterfaces();
let found = false;

for (const [name, addrs] of Object.entries(interfaces)) {
  for (const addr of addrs) {
    if (addr.family === "IPv4" && !addr.internal) {
      console.log(`🌐  http://${addr.address}:${port}`);
      found = true;
    }
  }
}

if (!found) {
  console.log(`🌐  http://localhost:${port}`);
}

console.log("");
