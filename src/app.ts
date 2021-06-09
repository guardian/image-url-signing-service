import express from "express";
import { format } from "@guardian/image";
import { json as jsonBodyParser } from "body-parser";

export const app = express();
app.use(jsonBodyParser());

app.all("/signed-image-url", (req: express.Request, res: express.Response) => {
  // Allow setting of image URL via body or query parameter
  const url = req.body?.url || req.query["url"];
  if (!url || typeof url != "string" || url.length <= 0) {
    res.status(400);
    res.send({ error: "No URL provided" });
    return;
  }

  const salt = process.env.SALT;
  if (!salt) {
    res.status(500);
    res.send({ error: "Service incorrectly configured. No salt provided" });
    return;
  }

  let profile = {
    width: 800,
  };

  // Allow setting of image format profile via POST body
  if (req.body?.profile) {
    profile = req.body.profile;
  }

  const signedUrl = format(url, salt, profile);
  res.send({ signedUrl });
});

app.get("/healthcheck", (req: express.Request, res: express.Response) => {
  res.status(200).json({ status: "OK" });
});


