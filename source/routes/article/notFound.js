const ArticleSDK = require("@frontender-magazine/fm-article").default;
const builder = require("@frontender-magazine/article-builder").default;

const { PROTOCOL, ARTICLE_SERVICE } = process.env;
const articleSDK = new ArticleSDK(`${PROTOCOL}${ARTICLE_SERVICE}`);
const articlesPath = "/websites/articles/";

async function notFound(req, res, err, next) {
  const {
    originalUrl: url,
    params: { reponame }
  } = req;

  console.log("not found hited: ", reponame);

  if (reponame !== undefined && /[\w\d-]{3,}/gi.test(reponame)) {
    try {
      console.log("connecting to: ", `${PROTOCOL}${ARTICLE_SERVICE}`);
      const article = await articleSDK.getByReponame(reponame);
      console.log(article);
      console.log("build to: ", reponame, articlesPath);
      await builder(reponame, articlesPath, article);
      res.redirect(301, url, next);
    } catch (error) {
      console.log(error);
      res.status(error.statusCode || 404).end();
    }
  }
  res.status(404).end();
}

module.exports = {
  notFound
};
