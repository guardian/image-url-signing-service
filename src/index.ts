import { config as dotEnvConfig } from "dotenv";
import { app } from "./app";
import serverlessExpress from '@vendia/serverless-express'

dotEnvConfig();

if (process.env.LOCAL === "true") {
  const PORT = 3232;
  app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
    console.log(`Access via http://localhost:${PORT}`);
  });
}

exports.handler = serverlessExpress( {app} )