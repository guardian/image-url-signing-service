import { format } from '@guardian/image';
import {
	guardianValidation,
	PanDomainAuthentication,
} from '@guardian/pan-domain-node';
import { json as jsonBodyParser } from 'body-parser';
import express from 'express';
import type { Express } from 'express';
import { getStage, REGION, SETTINGS_FILE } from './environment';

interface SignedImageUrlBody {
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

export function buildApp(
	getPanda: () => PanDomainAuthentication = getPanDomainAuth,
): Express {
	const app = express();
	app.use(jsonBodyParser());

	app.all(
		'/signed-image-url',
		(req: express.Request, res: express.Response) => {
			// Allow setting of image URL via body or query parameter
			const body = req.body as SignedImageUrlBody | undefined;
			const url = body?.url ?? req.query['url'];
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

			const profile = body?.profile ?? { width: 800 };

			const panda = getPanda();
			panda
				.verify(getCookieString(req))
				.then((panAuthResult) => {
					if (panAuthResult.status === 'Authorised') {
						try {
							const signedUrl = format(url, salt, profile);
							res.send({ signedUrl });
						} catch (ex: unknown) {
							res.status(500).send({
								error: 'Error signing url',
								ex: ex,
							});
						}
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
				});
		},
	);

	app.get('/userdetails', (req: express.Request, res: express.Response) => {
		const panda = getPanda();
		panda
			.verify(getCookieString(req))
			.then((result) => {
				res.send(result);
			})
			.catch((ex: unknown) => {
				console.error('pan-domain-node error ', ex);
				res.status(500).send({ error: 'pan-domain-node error', ex });
			})
			.finally(() => {
				panda.stop();
			});
	});

	app.get('/healthcheck', (req: express.Request, res: express.Response) => {
		res.status(200).json({ status: 'OK', stage: getStage() });
	});

	return app;
}
