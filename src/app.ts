import { fromIni, fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { format } from '@guardian/image';
import {
	guardianValidation,
	PanDomainAuthentication,
} from '@guardian/pan-domain-node';
import type { AuthenticationResult } from '@guardian/pan-domain-node';
import { json as jsonBodyParser } from 'body-parser';
import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import { getSalt, getStage, REGION, SETTINGS_FILE } from './environment';
import { getLoginResponse, getUI } from './uiHtml';

const DEFAULT_WIDTH = 800;

interface SignedImageUrlConfig {
	url?: string;
	profile?: { width?: number; height?: number; quality?: number };
}

function getPanDomainAuth() {
	const SETTINGS_BUCKET = 'pan-domain-auth-settings';
	const stage = getStage();
	return PanDomainAuthentication.builder({
		cookieName: 'gutoolsAuth-assym',
		region: REGION,
		bucket: SETTINGS_BUCKET,
		keyFile: SETTINGS_FILE,
		validateUser: guardianValidation,
		credentialsProvider:
			stage === 'CODE' || stage === 'PROD'
				? fromNodeProviderChain()
				: fromIni(),
	});
}

function getCookieString(req: express.Request) {
	const maybeList = req.headers.cookie ?? req.headers.Cookie ?? '';
	return Array.isArray(maybeList) ? maybeList.join('') : maybeList;
}

async function handleImageSigning(
	config: SignedImageUrlConfig | undefined,
	res: express.Response,
) {
	const url = config?.url;
	if (!url || typeof url != 'string' || url.length <= 0) {
		res.status(400);
		res.send({ error: 'No URL provided' });
		return;
	}

	let salt: string;
	try {
		salt = await getSalt();
	} catch (error) {
		res.status(500).send({
			error: error instanceof Error ? error.message : String(error),
		});
		return;
	}

	const profile = config.profile ?? { width: DEFAULT_WIDTH };

	try {
		const signedUrl = format(url, salt, profile);
		res.send({ signedUrl });
	} catch (ex: unknown) {
		res.status(500).send({
			error: 'Error signing url',
			ex: ex,
		});
	}
}

async function withPandaAuth(
	getPanda: () => Promise<PanDomainAuthentication>,
	req: express.Request,
	res: express.Response,
	onSuccess: (result: AuthenticationResult) => unknown,
	onFailure: () => unknown,
) {
	let panda: PanDomainAuthentication | undefined;
	let result: AuthenticationResult;
	try {
		panda = await getPanda();
		result = await panda.verify(getCookieString(req));
	} catch (ex: unknown) {
		res.status(500).send({
			error: 'Pan domain auth error',
			ex: ex,
		});
		return;
	} finally {
		panda?.stop();
	}
	if (result.success) {
		await onSuccess(result);
	} else {
		await onFailure();
	}
}

export function buildApp(
	getPanda: () => Promise<PanDomainAuthentication> = getPanDomainAuth,
): Express {
	const app = express();

	app.use(
		cors({
			origin: /\.(dev-)?gutools.co.uk$/,
			credentials: true,
		}),
	);

	app.use(jsonBodyParser());

	const uiHandler = (req: express.Request, res: express.Response) => {
		return withPandaAuth(
			getPanda,
			req,
			res,
			(panAuthResult) => {
				res.contentType('html').send(getUI(panAuthResult));
			},
			() => {
				res.status(403).contentType('html').send(getLoginResponse(req));
			},
		);
	};

	app.get('/', uiHandler);

	app.post(
		'/signed-image-url',
		(req: express.Request, res: express.Response) =>
			withPandaAuth(
				getPanda,
				req,
				res,
				async () => {
					await handleImageSigning(
						req.body as SignedImageUrlConfig | undefined,
						res,
					);
				},
				() => {
					res.status(403).send({
						error: 'Not authorised by pan-domain login',
					});
				},
			),
	);

	app.get(
		'/signed-image-url',
		(req: express.Request, res: express.Response) =>
			withPandaAuth(
				getPanda,
				req,
				res,
				async () => {
					const config: SignedImageUrlConfig = {
						url: req.query.url as string,
						profile: {
							width: DEFAULT_WIDTH,
						},
					};
					// The typeof checks below are because of the way express
					// handles multiple query parameters of the same name. I
					// don't think we need to handle this, so if it's not a
					// string, ignore it.
					if (
						config.profile &&
						req.query.width &&
						typeof req.query.width === 'string'
					) {
						config.profile.width = Number.parseInt(req.query.width);
					}
					if (
						config.profile &&
						req.query.height &&
						req.query.height === 'string'
					) {
						config.profile.height = Number.parseInt(
							req.query.height,
						);
					}
					if (
						config.profile &&
						req.query.quality &&
						req.query.quality === 'string'
					) {
						config.profile.quality = Number.parseInt(
							req.query.quality,
						);
					}
					await handleImageSigning(config, res);
				},
				() => {
					res.status(403).send({
						error: 'Not authorised by pan-domain login',
					});
				},
			),
	);

	app.get('/userdetails', (req: express.Request, res: express.Response) =>
		withPandaAuth(
			getPanda,
			req,
			res,
			(authResult) => {
				res.send(authResult);
			},
			() => {
				res.status(403).send({
					error: 'Not authorised by pan-domain login',
				});
			},
		),
	);

	app.get('/healthcheck', (req: express.Request, res: express.Response) => {
		res.status(200).json({ status: 'OK', stage: getStage() });
	});

	return app;
}
