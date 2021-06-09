import { config as dotEnvConfig } from "dotenv";
import { app } from "./app";
import serverlessExpress from '@vendia/serverless-express'

dotEnvConfig();

// let server: any;

// if (process.env.LOCAL === "true") {
//   const PORT = 3232;
//   app.listen(PORT, () => {
//     console.log(`Listening on port ${PORT}`);
//     console.log(`Access via http://localhost:${PORT}`);
//   });
// } else {
//   server = serverlessExpress( {app} );
// }

// export const handler = (event: any, context: any) => {
//   console.log("Handler", event, context);
//   server;
// };

exports.handler = serverlessExpress( {app} )