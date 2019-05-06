const { src, dest, watch } = require("gulp");

const concat = require("gulp-concat");
const postcss = require("gulp-postcss");
const order = require("gulp-order");
const csso = require("gulp-csso");

const paths = {
  source: {
    static: "./static/**/*",
    helpers: "./source/helpers/**/*.css",
    components_css: "./source/components/**/*.css",
    all_css: ["./source/components/**/*.css", "./source/helpers/**/*.css"]
  },
  public: {
    css: "./public/styles/",
    target: "./public/"
  }
};

const staticFiles = () =>
  src(paths.source.static).pipe(dest(paths.public.target));

const css = () =>
  src(paths.source.all_css)
    .pipe(postcss())
    .pipe(order(["reset.css"]))
    .pipe(concat("styles.css"))
    .pipe(csso())
    .pipe(dest(paths.public.css));

exports.watch = () => {
  watch(paths.source.all_css, css);
};

exports.static = staticFiles;

exports.css = css;

exports.default = css;
