import { config as dotEnvConfig } from "dotenv";
import { app } from "./app";
import awsServerlessExpress from "aws-serverless-express";

dotEnvConfig();

let server: any;

if (process.env.LOCAL === "true") {
  const PORT = 3232;
  app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
    console.log(`Access via http://localhost:${PORT}`);
  });
} else {
  server = awsServerlessExpress.createServer(app);
}

export const handler = (event: any, context: any) => {
  awsServerlessExpress.proxy(server, event, context);
};