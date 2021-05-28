import { config as dotEnvConfig } from "dotenv";
import { app } from "./app";

dotEnvConfig();

const PORT = 3232;
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
  console.log(`Access via http://localhost:${PORT}`);
});
