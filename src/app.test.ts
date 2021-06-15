import { PanDomainAuthentication } from "@guardian/pan-domain-node";
import { Express } from "express-serve-static-core";
import request from "supertest";
import { buildApp } from "./app";

describe("Image signing service", () => {

  let app: Express;
  let mockPanda: PanDomainAuthentication;
  let mockUser = {
    "firstName": "Michael",
    "lastName": "Clapham",
    "email": "michael.clapham@guardian.co.uk",
    "avatarUrl": "https://lh3.googleusercontent.com/a/AATXAJxy145DPS7FoY5S8HW6d0lRgywxMeKl3RoDB2Nw=s96-c",
    "authenticatingSystem": "login",
    "authenticatedIn": [
      "login"
    ],
    "expires": 1623698419000,
    "multifactor": true
  };
  let mockValidCookie = "gutoolsAuth-assym=fakecookie";

  beforeEach(() => {
    mockPanda = {
        verify: jest.fn(async (cookie) => {
          if (cookie == mockValidCookie) {
            return { status: 'Authorised', user: mockUser };
          } else {
            return { status: 'Not Authorised' };
          }
        }),
        stop: jest.fn()
    } as any;
    app = buildApp(() => mockPanda);
    process.env.SALT = "fake";
  });

  describe("/userdetails", () => {
    it("returns user when valid cookie provided", async () => {
      const res = await request(app)
        .get("/userdetails")
        .set("Cookie", mockValidCookie);
      expect(res.status).toEqual(200);
      expect(res.body.user).toEqual(mockUser);
      expect(mockPanda.verify).toHaveBeenCalledWith(mockValidCookie);
    });
  });

  describe("/signed-image-url", () => {

    it("responds with an error if no url provided", () => {
      return request(app)
        .get("/signed-image-url")
        .set("Cookie", mockValidCookie)
        .expect("Content-Type", /json/)
        .expect(400);
    });

    it("responds with correct i.guim.co.uk url when url provided", async () => {
      const urlParam = encodeURI("https://media.guim.co.uk/273bca7a4a3d0a38886ea9229f7a87a6d63d723c/608_1843_5584_5584/master/5584.jpg");
      const res = await request(app)
        .get("/signed-image-url?url=" + urlParam)
        .set("Cookie", mockValidCookie);
      expect(res.status).toEqual(200);
      const actualUrl: string = res.body.signedUrl;
      const expectedUrl = "https://i.guim.co.uk/img/media/273bca7a4a3d0a38886ea9229f7a87a6d63d723c/608_1843_5584_5584/master/5584.jpg?width=800&s=55cbb2fa7c0608af6b0dcd2e6fcc1f58";
      expect(actualUrl).toBe(expectedUrl);
    });

    it("passes correct cookie to pan-domain auth library", async () => {
      const urlParam = encodeURI("https://media.guim.co.uk/273bca7a4a3d0a38886ea9229f7a87a6d63d723c/608_1843_5584_5584/master/5584.jpg");
      const res = await request(app)
        .get("/signed-image-url?url=" + urlParam)
        .set("Cookie", mockValidCookie);
      expect(res.status).toEqual(200);
      expect(mockPanda.verify).toHaveBeenCalledWith(mockValidCookie);
    });

    it("returns not authorised if no auth cookie provided", async () => {
      const urlParam = encodeURI("https://media.guim.co.uk/273bca7a4a3d0a38886ea9229f7a87a6d63d723c/608_1843_5584_5584/master/5584.jpg");
      const res = await request(app)
        .get("/signed-image-url?url=" + urlParam)
      expect(res.status).toEqual(403);
      expect(mockPanda.verify).toHaveBeenCalled();
    });

    it("returns not authorised if invalid auth cookie provided", async () => {
      const urlParam = encodeURI("https://media.guim.co.uk/273bca7a4a3d0a38886ea9229f7a87a6d63d723c/608_1843_5584_5584/master/5584.jpg");
      const res = await request(app)
        .get("/signed-image-url?url=" + urlParam)
        .set("Cookie", "gutoolsAuth-assym=meh");
      expect(res.status).toEqual(403);
      expect(mockPanda.verify).toHaveBeenCalled();
    });

  });

});