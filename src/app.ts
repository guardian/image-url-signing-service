import express from "express";
import { format } from "@guardian/image";
import { json as jsonBodyParser } from "body-parser";
import { guardianValidation, PanDomainAuthentication } from '@guardian/pan-domain-node';
import { REGION, SETTINGS_FILE } from "./environment";

function getPanDomainAuth() {
  const SETTINGS_BUCKET = "pan-domain-auth-settings";
  const panda = new PanDomainAuthentication('gutoolsAuth-assym', REGION, SETTINGS_BUCKET, SETTINGS_FILE, guardianValidation);
  return panda;
}

function getCookieString(req: express.Request) {
  return "" + (req.headers.cookie || req.headers.Cookie || "");
}

export function buildApp(getPanda: () => PanDomainAuthentication = getPanDomainAuth) {

  const app = express();
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

    const panda = getPanda();
    panda.verify(getCookieString(req)).then((panAuthResult) => {

      if (panAuthResult.status === 'Authorised') {
        try {
          const signedUrl = format(url, salt, profile);
          res.send({ signedUrl });
        } catch (ex) {
          res.status(500).send({ error: "Error signing url", ex: ex });
        }
      } else {
        res.status(403).send({ error: "Not authorised by pan-domain login" }); 
      }
    }).catch((ex) => {
      res.status(500).send({ error: "Pan domain auth error", ex: ex });
    });

    
  });

  app.get("/userdetails", (req: express.Request, res: express.Response) => {
    const panda = getPanda();
    panda.verify(getCookieString(req)).then((result) => {
      res.send(result);
    })
    .catch(ex => {
      console.error("pan-domain-node error ", ex);
      res.status(500).send({ error: "pan-domain-node error", ex });
    })
    .finally(() => {
      panda.stop();
    })
  });

  app.get("/healthcheck", (req: express.Request, res: express.Response) => {
    res.status(200).json({ status: "OK" });
  });

  return app;
}


