import { format } from '@guardian/image';
import {
	AuthenticationStatus,
	guardianValidation,
	PanDomainAuthentication,
} from '@guardian/pan-domain-node';
import type { AuthenticationResult } from '@guardian/pan-domain-node';
import { json as jsonBodyParser } from 'body-parser';
import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import { getStage, REGION, SETTINGS_FILE } from './environment';
import { getLoginResponse, getUI } from './uiHtml';

const DEFAULT_WIDTH = 800;

interface SignedImageUrlConfig {
	url?: string;
	profile?: { width?: number; height?: number; quality?: number };
}

function getPanDomainAuth() {
	const SETTINGS_BUCKET = 'pan-domain-auth-settings';
	const panda = new PanDomainAuthentication(
		'gutoolsAuth-assym',
		REGION,
		SETTINGS_BUCKET,
		SETTINGS_FILE,
		guardianValidation,
	);
	return panda;
}

function getCookieString(req: express.Request) {
	const maybeList = req.headers.cookie ?? req.headers.Cookie ?? '';
	return Array.isArray(maybeList) ? maybeList.join('') : maybeList;
}

function handleImageSigning(
	config: SignedImageUrlConfig | undefined,
	getPanda: () => PanDomainAuthentication,
	req: express.Request,
	res: express.Response,
) {
	const url = config?.url;
	if (!url || typeof url != 'string' || url.length <= 0) {
		res.status(400);
		res.send({ error: 'No URL provided' });
		return;
	}

	const salt = process.env.SALT;
	if (!salt) {
		res.status(500);
		res.send({
			error: 'Service incorrectly configured. No salt provided',
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

function withPandaAuth(
	getPanda: () => PanDomainAuthentication,
	req: express.Request,
	res: express.Response,
	onSuccess: (result: AuthenticationResult) => unknown,
	onFailure: () => unknown,
) {
	const panda = getPanda();
	panda
		.verify(getCookieString(req))
		.then((panAuthResult) => {
			if (panAuthResult.status === AuthenticationStatus.AUTHORISED) {
				onSuccess(panAuthResult);
			} else {
				onFailure();
			}
		})
		.catch((ex: unknown) => {
			res.status(500).send({
				error: 'Pan domain auth error',
				ex: ex,
			});
		})
		.finally(() => {
			panda.stop();
		});
}

export function buildApp(
	getPanda: () => PanDomainAuthentication = getPanDomainAuth,
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
		withPandaAuth(
			getPanda,
			req,
			res,
			async () => {
				const panAuthResult = await getPanda().verify(
					getCookieString(req),
				);
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
				() => {
					handleImageSigning(
						req.body as SignedImageUrlConfig | undefined,
						getPanda,
						req,
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
				() => {
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
					handleImageSigning(config, getPanda, req, res);
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
