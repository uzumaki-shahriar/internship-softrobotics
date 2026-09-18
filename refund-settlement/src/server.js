require("dotenv").config();

const cron = require("node-cron");
const app = require("./app");
const { runAll } = require("./jobs");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

cron.schedule("* * * * *", async () => {
  try {
    const result = await runAll();
    console.log("Cron run:", result);
  } catch (e) {
    console.error("Cron run failed:", e);
  }
});
