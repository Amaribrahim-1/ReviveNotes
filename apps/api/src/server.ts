import { APP_NAME } from "@revivenotes/shared";
import { app } from "./app.js";
import { prisma } from "./db.js";

// Render sets PORT. Locally we keep 4000 so the web default still matches.
const port = Number(process.env.PORT) || 4000;

app.listen(port, () => {
  console.log(`${APP_NAME} API listening on ${port}`);
});

// Loading this file creates the one Prisma client for the API process.
// Later routes import { prisma } from "./db.js" and share that same module.
export { prisma };
