import restify from "restify";
import mongoose from "mongoose";
import cookieParser from "restify-cookies";
import dotenv from "dotenv";
import fs from "fs";
import { resolve } from "path";
import { Article, Event } from "@frontender-magazine/models";
import ejs from "ejs";
import queryString from "query-string";

if (!global.Intl) {
  global.Intl = require("intl"); // eslint-disable-line
}
const IntlRelativeFormat = require("intl-relativeformat");

const rf = new IntlRelativeFormat("ru");

const articlesTemplate = fs.readFileSync(
  resolve(__dirname, "../source/components/Articles/Articles.ejs"),
  {
    encoding: "utf-8"
  }
);

const ENV_PATH = resolve(__dirname, "../.env");
dotenv.config({
  allowEmptyValues: false,
  path: ENV_PATH
});
const { MONGODB_PORT, MONGODB_HOST, MONGODB_NAME, DOMAIN } = process.env;
const { name, version } = require("../package.json");

const PORT = process.env.PORT || 4000;
const server = restify.createServer({
  name,
  version,
  formatters: {
    "application/json": (req, res, body) => JSON.stringify(body),
    "text/html": (req, res, body) => body
  }
});

server.pre(restify.plugins.pre.dedupeSlashes());
server.pre(restify.plugins.pre.sanitizePath());
server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());
server.use(restify.plugins.gzipResponse());
server.use(cookieParser.parse);

server.pre((req, res, next) => {
  res.charSet("utf-8");
  return next();
});

server.get(
  {
    path: /\/(styles|images)\/*/,
    name: "Serve styles"
  },
  restify.plugins.serveStatic({
    directory: `${__dirname}/../build/`
  })
);

/**
 * Show articles list
 * @return {string} - html of the page
 */
server.get(
  {
    path: "/",
    name: "Show articles list"
  },
  async (req, res, next) => {
    if (req.query.s !== undefined && req.query.s.trim().length === 0) {
      delete req.query.s;
    }

    let params = {
      ...req.query
    };
    delete params.page;
    params = queryString.stringify(params);

    let query = [];

    query.push({
      $match: {
        state: "published"
      }
    });

    let result = await Event.aggregate(query);
    result = result.map(event => event.article_id);

    query = [];

    if (req.query.s !== undefined) {
      res.setHeader("Cache-Control", "no-cache");
      query.push({
        $match: {
          $and: [
            {
              $text: {
                $search: req.query.s,
                $caseSensitive: false,
                $diacriticSensitive: false
              }
            },
            {
              _id: { $in: result }
            }
          ]
        }
      });
    } else {
      query.push({ $match: { _id: { $in: result } } });
    }

    query.push({
      $unwind: {
        path: "$translations",
        preserveNullAndEmptyArrays: true
      }
    });

    query.push({
      $lookup: {
        from: "users",
        localField: "author",
        foreignField: "_id",
        as: "author"
      }
    });

    query.push({
      $lookup: {
        from: "users",
        localField: "translations.author",
        foreignField: "_id",
        as: "translations.author"
      }
    });

    query.push({
      $group: {
        _id: "$_id",
        url: { $first: "$url" },
        domain: { $first: "$domain" },
        title: { $first: "$title" },
        published: { $first: "$published" },
        lang: { $first: "$lang" },
        tags: { $first: "$tags" },
        contributors: { $first: "$contributors" },
        author: { $first: "$author" },
        translations: { $push: "$translations" }
      }
    });

    query.push({
      $sort: {
        published: -1
      }
    });

    let page = parseInt(req.query.page, 10) || 1;
    const perPage = parseInt(req.query.per_page, 10) || 10;
    const full = await Article.aggregate(query);
    const total = full.length;
    const pagesCount = Math.ceil(total / perPage);

    page = Math.min(page, pagesCount);

    const links = [];
    links.push(`<${DOMAIN}?page=1>; rel=first`);
    if (page > 1) {
      links.push(`<${DOMAIN}?page=${page - 1}>; rel=prev`);
    }
    links.push(`<${DOMAIN}?page=${page}>; rel=self`);
    if (page < pagesCount) {
      links.push(`<${DOMAIN}?page=${page + 1}>; rel=prev`);
    }
    links.push(`<${DOMAIN}?page=${pagesCount}>; rel=last`);
    res.setHeader("Link", links.join(", "));

    let articles = await Article.aggregate(query)
      .skip(Math.max(page - 1, 0) * perPage)
      .limit(perPage);
    articles = articles.map(article => {
      const publishedHuman = rf.format(new Date(article.published));
      const isTranslation = article.domain !== "frontender.info";
      let data = {
        isTranslation,
        url: article.url,
        title: article.title,
        published: article.published,
        publishedHuman,
        author: article.author
      };

      if (isTranslation) {
        const translations = article.translations.filter(
          translation => translation.domain === "frontender.info"
        );
        const translation = translations.length > 0 ? translations[0] : null;
        const translatedHuman = rf.format(new Date(translation.published));

        data = {
          ...data,
          isTranslation,
          url: translation.url,
          title: translation.title,
          translated: translation.published,
          translatedHuman,
          translator: translation !== null ? translation.author : []
        };
      }

      return data;
    });

    const rendered = ejs.render(articlesTemplate, {
      params,
      keywords: req.query.s !== undefined ? req.query.s : "",
      articles,
      pagesCount,
      page,
      articlePaginationTemplate: resolve(
        __dirname,
        "../source/components/Pagination/Pagination.ejs"
      ),
      articleFormTemplate: resolve(
        __dirname,
        "../source/components/SearchForm/SearchForm.ejs"
      ),
      articleCardTemplate: resolve(
        __dirname,
        "../source/components/ArticleCard/ArticleCard.ejs"
      )
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Length", Buffer.byteLength(rendered));
    res.setHeader("X-Pagination-Current-Page", page);
    res.setHeader("X-Pagination-Per-Page", perPage);
    res.setHeader("X-Pagination-Total-Count", total);
    res.setHeader("X-Pagination-Page-Count", pagesCount);

    res.status(200);
    res.send(rendered);
    res.end();
    return next();
  }
);

(async () => {
  mongoose.Promise = global.Promise;
  await mongoose.connect(
    `mongodb://${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_NAME}`,
    {
      useNewUrlParser: true,
      useCreateIndex: true
    }
  );
  server.listen(PORT);
})();
