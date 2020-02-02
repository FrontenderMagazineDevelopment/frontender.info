const { resolve } = require("path");
const ejs = require("ejs");
const queryString = require("query-string");
const { Article, Event } = require("@frontender-magazine/models");
const fs = require("fs");

if (!global.Intl) {
  global.Intl = require("intl"); // eslint-disable-line
}

const IntlRelativeFormat = require("intl-relativeformat");

const componentsPath = resolve(process.cwd(), "source/components/");

const rf = new IntlRelativeFormat("ru");

const articlesTemplate = fs.readFileSync(
  resolve(componentsPath, "Articles/Articles.ejs"),
  { encoding: "utf-8" }
);

async function get(req, res) {
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

  console.log("show list");

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

  const { DOMAIN } = process.env;

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
      componentsPath,
      "Pagination/Pagination.ejs"
    ),
    articleFormTemplate: resolve(componentsPath, "SearchForm/SearchForm.ejs"),
    articleCardTemplate: resolve(componentsPath, "ArticleCard/ArticleCard.ejs")
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
}

module.exports = {
  get
};
