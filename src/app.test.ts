/* eslint-disable @typescript-eslint/no-unsafe-assignment -- For mocking and body access */
/* eslint-disable @typescript-eslint/unbound-method -- This rule is broken for method references */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- For body access which is always any */
import type { PanDomainAuthentication } from '@guardian/pan-domain-node';
import type { Express } from 'express';
import request from 'supertest';
import { buildApp } from './app';

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
						status: 'Authorised',
						user: mockUser,
					});
				} else {
					return Promise.resolve({
						status: 'Not Authorised',
						user: null,
					});
				}
			}),
			stop: jest.fn(),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- For mocking
		} as any;
		process.env.SALT = 'fake';
		app = buildApp(() => mockPanda);
	});

	describe('/userdetails', () => {
		it('returns user when valid cookie provided', async () => {
			const res = await request(app)
				.get('/userdetails')
				.set('Cookie', mockValidCookie);
			expect(res.status).toEqual(200);
			expect(res.body.user).toEqual(mockUser);
			expect(mockPanda.verify).toHaveBeenCalledWith(mockValidCookie);
		});
	});

	describe('/signed-image-url', () => {
		it('responds with an error if no url provided', () => {
			return request(app)
				.get('/signed-image-url')
				.set('Cookie', mockValidCookie)
				.expect('Content-Type', /json/)
				.expect(400);
		});

		it('responds with correct i.guim.co.uk url when url provided', async () => {
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

	describe('/healthcheck', () => {
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
