import express from "express";

const app = express();

app.get("/healthcheck", (req: express.Request, res: express.Response) => {
  res.header("Content-Type", "text/plain");
  res.send("OK");
});

const PORT = 3232;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
