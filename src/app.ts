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
import { getStage, REGION, SETTINGS_FILE } from './environment';

interface SignedImageUrlConfig {
	url?: string;
	profile?: { width?: number; height?: number };
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

	const profile = config?.profile ?? { width: 800 };

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
) {
	const panda = getPanda();
	panda
		.verify(getCookieString(req))
		.then((panAuthResult) => {
			if (panAuthResult.status === 'Authorised') {
				onSuccess(panAuthResult);
			} else {
				res.status(403).send({
					error: 'Not authorised by pan-domain login',
				});
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

	app.post(
		'/signed-image-url',
		(req: express.Request, res: express.Response) =>
			withPandaAuth(getPanda, req, res, () => {
				handleImageSigning(
					req.body as SignedImageUrlConfig | undefined,
					getPanda,
					req,
					res,
				);
			}),
	);

	app.get(
		'/signed-image-url',
		(req: express.Request, res: express.Response) =>
			withPandaAuth(getPanda, req, res, () => {
				const config = { url: req.query.url };
				handleImageSigning(
					config as SignedImageUrlConfig,
					getPanda,
					req,
					res,
				);
			}),
	);

	app.get('/userdetails', (req: express.Request, res: express.Response) =>
		withPandaAuth(getPanda, req, res, (authResult) => {
			res.send(authResult);
		}),
	);

	app.get('/healthcheck', (req: express.Request, res: express.Response) => {
		res.status(200).json({ status: 'OK', stage: getStage() });
	});

	return app;
}
