import serverlessExpress from '@codegenie/serverless-express';
import type { APIGatewayProxyResult, Context } from 'aws-lambda';
import { config as dotEnvConfig } from 'dotenv';
import { buildApp } from './app';

dotEnvConfig();

const app = buildApp();

if (process.env.LOCAL === 'true') {
	const PORT = 3232;
	app.listen(PORT, () => {
		console.log(`Listening on port ${PORT}`);
		console.log(`Access via http://localhost:${PORT}`);
	});
}

const serverlessExpressInstance = serverlessExpress<
	unknown,
	APIGatewayProxyResult
>({ app });

export const handler = async (event: unknown, context: Context) =>
	serverlessExpressInstance(event, context, () => undefined);
