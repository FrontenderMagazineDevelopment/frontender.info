const { src, dest, watch } = require("gulp");

const concat = require("gulp-concat");
const postcss = require("gulp-postcss");
const order = require("gulp-order");
const csso = require("gulp-csso");

const paths = {
  source: {
    helpers: "./source/helpers/**/*.css",
    components_css: "./source/components/**/*.css",
    all_css: ["./source/components/**/*.css", "./source/helpers/**/*.css"]
  },
  build: {
    css: "./build/styles/"
  }
};

const css = () =>
  src(paths.source.all_css)
    .pipe(postcss())
    .pipe(order(["reset.css"]))
    .pipe(concat("styles.css"))
    .pipe(csso())
    .pipe(dest(paths.build.css));

exports.watch = () => {
  watch(paths.source.all_css, css);
};

exports.css = css;

exports.default = css;
