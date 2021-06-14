import express from "express";
import { format } from "@guardian/image";
import { json as jsonBodyParser } from "body-parser";
import { guardianValidation, PanDomainAuthentication } from '@guardian/pan-domain-node';
import { ResourceGroups } from "aws-sdk";

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

app.get("/pandacheck", (req: express.Request, res: express.Response) => {
  const REGION = process.env.REGION || "eu-west-1";
  const SETTINGS_FILE = process.env.PANDA_SETTINGS_FILE || "panda.settings";
  const SETTINGS_BUCKET = process.env.PANDA_SETTINGS_BUCKET || "image-url-signing-panda-settings";
  const panda = new PanDomainAuthentication('gutoolsAuth-assym', REGION, SETTINGS_BUCKET, SETTINGS_FILE, guardianValidation);

  const cookieString = req.headers && req.headers.cookie ? req.headers.cookie : "";

  panda.verify(cookieString).then(({ status, user }) => {
		if (status === 'Authorised') {
			// TODO MRB: remove once @guardian/pan-domain-node supports an API not including the refresher
			panda.stop();

			res.send({ authorised: true, user: user });
		} else {
			res.send({ authorised: false });
		}
	})
	.catch(ex => {
    console.error("pan-domain-node error ", ex);
		panda.stop();
		res.send({ error: "pan-domain-node error" });
	});
});

app.get("/healthcheck", (req: express.Request, res: express.Response) => {
  res.status(200).json({ status: "OK" });
});


