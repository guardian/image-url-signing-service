import request from "supertest";
import { app } from "./app";

describe("/signed-image-url", () => {

  beforeAll(() => {
    process.env.SALT = "fake";
  })

  it("responds with an error if no url provided", () => {
    return request(app)
      .get("/signed-image-url")
      .expect("Content-Type", /json/)
      .expect(400);
  });

  it("responds with correct i.guim.co.uk url when url provided", async () => {
    const urlParam = encodeURI("https://media.guim.co.uk/273bca7a4a3d0a38886ea9229f7a87a6d63d723c/608_1843_5584_5584/master/5584.jpg");
    const res = await request(app).get("/signed-image-url?url=" + urlParam);
    expect(res.status).toEqual(200);
    const actualUrl: string = res.body.signedUrl;
    const expectedUrl = "https://i.guim.co.uk/img/media/273bca7a4a3d0a38886ea9229f7a87a6d63d723c/608_1843_5584_5584/master/5584.jpg?width=800&s=55cbb2fa7c0608af6b0dcd2e6fcc1f58";
    expect(actualUrl).toBe(expectedUrl);
  });
  
});
