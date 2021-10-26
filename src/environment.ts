/* eslint-disable @typescript-eslint/prefer-nullish-coalescing -- Nullish coalescing would cause bug here */
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

export const SETTINGS_FILE = getSettingsFile(getStage());
export const REGION = process.env.AWS_REGION || 'eu-west-1';
