/* eslint-disable @typescript-eslint/prefer-nullish-coalescing -- Nullish coalescing would cause bug here */
import { getSecretValue } from './secrets';

export function getStage(): string | undefined {
	return (process.env.AWS_LAMBDA_FUNCTION_NAME || '')
		.split('-')
		.filter((token) => /(CODE?|PROD?)/.test(token))
		.pop();
}

function getSettingsFile(stage: string | undefined) {
	switch (stage) {
		case 'PROD':
			return 'gutools.co.uk.settings.public';
		case 'CODE':
			return 'code.dev-gutools.co.uk.settings.public';
		default:
			return 'local.dev-gutools.co.uk.settings.public';
	}
}

export function getLoginUrl(stage: string | undefined): string {
	switch (stage) {
		case 'CODE':
			return 'https://login.code.dev-gutools.co.uk';
		case 'PROD':
			return 'https://login.gutools.co.uk';
		default:
			return 'https://login.local.dev-gutools.co.uk';
	}
}

export function getUserTelemetryClient(stage: string | undefined): string {
	switch (stage) {
		case 'CODE':
			return 'https://user-telemetry.code.dev-gutools.co.uk';
		case 'PROD':
			return 'https://user-telemetry.gutools.co.uk';
		default:
			return 'https://user-telemetry.local.dev-gutools.co.uk';
	}
}

export const SETTINGS_FILE = getSettingsFile(getStage());
export const REGION = process.env.AWS_REGION || 'eu-west-1';

export async function getSalt(): Promise<string> {
	const stage = getStage();
	const secretName = `image-url-signing-service-${stage}/salt`;

	try {
		const secret = await getSecretValue<{ salt: string }>(
			secretName,
			REGION,
		);
		return secret.salt;
	} catch (error) {
		console.warn(
			`Failed to fetch salt from Secrets Manager, falling back to environment variable: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		const salt = process.env.SALT;
		if (!salt) {
			throw new Error(
				'Service incorrectly configured. No salt provided in Secrets Manager or environment variable',
			);
		}
		return salt;
	}
}
