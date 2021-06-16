/* eslint-disable @typescript-eslint/prefer-nullish-coalescing -- Nullish coalescing would cause bug here */
export function getStage() {
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

export const SETTINGS_FILE = getSettingsFile(getStage());
export const REGION = process.env.AWS_REGION || 'eu-west-1';
