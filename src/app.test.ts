/* eslint-disable @typescript-eslint/no-unsafe-assignment -- For mocking and body access */
/* eslint-disable @typescript-eslint/unbound-method -- This rule is broken for method references */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- For body access which is always any */
import serverlessExpress from '@codegenie/serverless-express';
import type { PanDomainAuthentication } from '@guardian/pan-domain-node';
import type { APIGatewayProxyResult } from 'aws-lambda';
import type { Express } from 'express';
import request from 'supertest';
import { buildApp } from './app';
import * as environment from './environment';
import { handler as lambdaHandler } from './index';

jest.mock('./environment', () => ({
	...jest.requireActual('./environment'),
	getSalt: jest.fn(),
}));

describe('Image signing service', () => {
	let app: Express;
	let mockPanda: PanDomainAuthentication;
	const mockUser = {
		firstName: 'Michael',
		lastName: 'Clapham',
		email: 'michael.clapham@guardian.co.uk',
		avatarUrl:
			'https://lh3.googleusercontent.com/a/AATXAJxy145DPS7FoY5S8HW6d0lRgywxMeKl3RoDB2Nw=s96-c',
		authenticatingSystem: 'login',
		authenticatedIn: ['login'],
		expires: 1623698419000,
		multifactor: true,
	};
	const mockValidCookie = 'gutoolsAuth-assym=fakecookie';

	beforeEach(() => {
		mockPanda = {
			verify: jest.fn((cookie) => {
				if (cookie == mockValidCookie) {
					return Promise.resolve({
						success: true,
						user: mockUser,
					});
				} else {
					return Promise.resolve({
						success: false,
						reason: 'invalid-cookie',
					});
				}
			}),
			stop: jest.fn(),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- For mocking
		} as any;
		// Mock getSalt to return salt
		(environment.getSalt as jest.Mock).mockResolvedValue('fake');
		process.env.SALT = 'fallback-salt';
		app = buildApp(() => mockPanda);
	});

	describe('GET /userdetails', () => {
		it('returns user when valid cookie provided', async () => {
			const res = await request(app)
				.get('/userdetails')
				.set('Cookie', mockValidCookie);
			expect(res.status).toEqual(200);
			expect(res.body.user).toEqual(mockUser);
			expect(mockPanda.verify).toHaveBeenCalledWith(mockValidCookie);
		});
	});

	describe('GET /signed-image-url', () => {
		it('responds with an error if no url provided', () => {
			return request(app)
				.get('/signed-image-url')
				.set('Cookie', mockValidCookie)
				.expect('Content-Type', /json/)
				.expect(400);
		});

		it('responds with correct i.guim.co.uk url when url provided as a query string arg', async () => {
			const urlParam = encodeURI(
				'https://media.guim.co.uk/273bca7a4a3d0a38886ea9229f7a87a6d63d723c/608_1843_5584_5584/master/5584.jpg',
			);
			const res = await request(app)
				.get('/signed-image-url?url=' + urlParam)
				.set('Cookie', mockValidCookie);
			expect(res.status).toEqual(200);
			const actualUrl: string = res.body.signedUrl;
			const expectedUrl =
				'https://i.guim.co.uk/img/media/273bca7a4a3d0a38886ea9229f7a87a6d63d723c/608_1843_5584_5584/master/5584.jpg?width=800&s=55cbb2fa7c0608af6b0dcd2e6fcc1f58';
			expect(actualUrl).toBe(expectedUrl);
		});

		it('passes correct cookie to pan-domain auth library', async () => {
			const urlParam = encodeURI(
				'https://media.guim.co.uk/273bca7a4a3d0a38886ea9229f7a87a6d63d723c/608_1843_5584_5584/master/5584.jpg',
			);
			const res = await request(app)
				.get('/signed-image-url?url=' + urlParam)
				.set('Cookie', mockValidCookie);
			expect(res.status).toEqual(200);
			expect(mockPanda.verify).toHaveBeenCalledWith(mockValidCookie);
		});

		it('returns not authorised if no auth cookie provided', async () => {
			const urlParam = encodeURI(
				'https://media.guim.co.uk/273bca7a4a3d0a38886ea9229f7a87a6d63d723c/608_1843_5584_5584/master/5584.jpg',
			);
			const res = await request(app).get(
				'/signed-image-url?url=' + urlParam,
			);
			expect(res.status).toEqual(403);
			expect(mockPanda.verify).toHaveBeenCalled();
		});
	});

	describe('POST /signed-image-url', () => {
		it.each([false, true])(
			'signs JSON from API Gateway when base64 encoding is %s',
			async (isBase64Encoded) => {
				const url =
					'https://media.guim.co.uk/273bca7a4a3d0a38886ea9229f7a87a6d63d723c/608_1843_5584_5584/master/5584.jpg';
				const body = JSON.stringify({ url });
				const handler = serverlessExpress({ app });
				const response: APIGatewayProxyResult = await handler(
					{
						httpMethod: 'POST',
						path: '/signed-image-url',
						headers: {
							'content-type': 'application/json',
							cookie: mockValidCookie,
						},
						requestContext: { identity: { sourceIp: '127.0.0.1' } },
						body: isBase64Encoded
							? Buffer.from(body).toString('base64')
							: body,
						isBase64Encoded,
					},
					{} as Parameters<typeof handler>[1],
					jest.fn(),
				);

				expect(response.statusCode).toBe(200);
				expect(JSON.parse(response.body)).toEqual({
					signedUrl:
						'https://i.guim.co.uk/img/media/273bca7a4a3d0a38886ea9229f7a87a6d63d723c/608_1843_5584_5584/master/5584.jpg?width=800&s=55cbb2fa7c0608af6b0dcd2e6fcc1f58',
				});
			},
		);

		it('responds with an error if no url provided', () => {
			return request(app)
				.post('/signed-image-url')
				.set('Cookie', mockValidCookie)
				.expect('Content-Type', /json/)
				.expect(400);
		});

		it('responds with correct i.guim.co.uk url when url provided as a query string arg', async () => {
			const url =
				'https://media.guim.co.uk/273bca7a4a3d0a38886ea9229f7a87a6d63d723c/608_1843_5584_5584/master/5584.jpg';

			const res = await request(app)
				.post('/signed-image-url')
				.send({ url })
				.set('Cookie', mockValidCookie);

			expect(res.status).toEqual(200);
			const actualUrl: string = res.body.signedUrl;
			const expectedUrl =
				'https://i.guim.co.uk/img/media/273bca7a4a3d0a38886ea9229f7a87a6d63d723c/608_1843_5584_5584/master/5584.jpg?width=800&s=55cbb2fa7c0608af6b0dcd2e6fcc1f58';
			expect(actualUrl).toBe(expectedUrl);
		});

		it('passes correct cookie to pan-domain auth library', async () => {
			const url =
				'https://media.guim.co.uk/273bca7a4a3d0a38886ea9229f7a87a6d63d723c/608_1843_5584_5584/master/5584.jpg';

			const res = await request(app)
				.post('/signed-image-url')
				.send({ url })
				.set('Cookie', mockValidCookie);

			expect(res.status).toEqual(200);
			expect(mockPanda.verify).toHaveBeenCalledWith(mockValidCookie);
		});

		it('returns not authorised if no auth cookie provided', async () => {
			const url =
				'https://media.guim.co.uk/273bca7a4a3d0a38886ea9229f7a87a6d63d723c/608_1843_5584_5584/master/5584.jpg';

			const res = await request(app)
				.post('/signed-image-url')
				.send({ url });

			expect(res.status).toEqual(403);
			expect(mockPanda.verify).toHaveBeenCalled();
		});
	});

	describe('GET /healthcheck', () => {
		it('exports a promise-based Lambda handler without a callback parameter', async () => {
			process.env.AWS_LAMBDA_FUNCTION_NAME =
				'image-url-signing-service-CODE';
			expect(lambdaHandler.length).toBe(2);
			const response = lambdaHandler(
				{
					httpMethod: 'GET',
					path: '/healthcheck',
					headers: {},
					requestContext: { identity: { sourceIp: '127.0.0.1' } },
					body: null,
					isBase64Encoded: false,
				},
				{} as Parameters<typeof lambdaHandler>[1],
			);
			expect(response).toBeInstanceOf(Promise);
			await expect(response).resolves.toMatchObject({
				statusCode: 200,
				body: JSON.stringify({ status: 'OK', stage: 'CODE' }),
			});
		});

		it('returns stage CODE in CODE lambda', async () => {
			process.env.AWS_LAMBDA_FUNCTION_NAME =
				'image-url-signing-service-CODE';
			const res = await request(app).get('/healthcheck');
			expect(res.status).toEqual(200);
			expect(res.body.stage).toEqual('CODE');
		});

		it('returns stage PROD in PROD lambda', async () => {
			process.env.AWS_LAMBDA_FUNCTION_NAME =
				'image-url-signing-service-PROD';
			const res = await request(app).get('/healthcheck');
			expect(res.status).toEqual(200);
			expect(res.body.stage).toEqual('PROD');
		});
	});
});
