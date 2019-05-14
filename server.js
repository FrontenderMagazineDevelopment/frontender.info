const express = require("express");
const mongoose = require("mongoose");
const compression = require("compression");
const { resolve } = require("path");
const dotenv = require("dotenv");
const { articles, article } = require("./source/routes");

process.on("uncaughtException", (error, origin) => {
  // eslint-disable-next-line no-console
  console.log(`Caught exception: ${error}
Exception origin: ${origin}`);
});

const staticPath = resolve(__dirname, "public");
const ENV_PATH = resolve(__dirname, ".env");
const envConfig = dotenv.config({
  allowEmptyValues: false,
  path: ENV_PATH
});

if (envConfig.error) {
  throw envConfig.error;
} else {
  Object.entries(envConfig).forEach(([name, value]) => {
    process.env[name] = value;
  });
}

const { MONGODB_PORT, MONGODB_HOST, MONGODB_NAME } = process.env;
const PORT = process.env.PORT || 3000;
const server = express();

server.disable("x-powered-by");
server.use(compression());

/**
 * Statics
 */
server.get(
  ["/favicon.ico", "/styles/*", "/images/*"],
  express.static(staticPath)
);

/**
 * Statics for article
 */
server.get("/:reponame", express.static("/websites/articles/"));

/**
 * Build static for article
 */
server.get("/:reponame", async (req, res, next) => {
  await article.notFound(req, res, next);
});

/**
 * Show articles list
 * @return {string} - html of the page
 */
server.get("/", articles.get);

(async () => {
  mongoose.Promise = global.Promise;
  await mongoose.connect(
    `mongodb://${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_NAME}`,
    {
      useUnifiedTopology: true,
      useNewUrlParser: true,
      useCreateIndex: true
    }
  );
  server.listen(PORT, () => {
    console.log(`Server listen on ${PORT}`);
  });
})();
