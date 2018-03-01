var assign = require('lodash.assign');
var cleanCSS = require('gulp-clean-css');
var concat = require('gulp-concat');
var del = require('del');
var frontMatter = require('gulp-front-matter');
var fs = require('fs');
var gls = require('gulp-live-server');
var gulp = require('gulp');
var gulpif = require('gulp-if');
var highlight = require('highlight.js');
var layout = require('gulp-layout');
var marked = require('marked');
var open = require('gulp-open');
var prettify = require('gulp-prettify');
var rename = require("gulp-rename");
var sass = require('gulp-sass');
var tildeImporter = require('node-sass-tilde-importer');
var uglify = require('gulp-uglify');
var yaml = require('js-yaml');

var renderer = new marked.Renderer();
var COMPRESS = true;

renderer.code = function (code, language) {
  var highlighted = language ? highlight.highlight(language, code).value
                             : highlight.highlightAuto(code).value;

  return '<pre class="highlight ' + language + '"><code>' + highlighted + '</code></pre>';
};

var readGlobalYml = function() {
  return yaml.safeLoad(fs.readFileSync('./src/global.yml', 'utf8'));
};

var getGlobalPageData = function() {
  var config = readGlobalYml();

  return {
    current_page: {
      data: config
    },
    layout: './src/layout.ejs',
    page_classes: '',
    image_tag: function(filename, alt, className) {
      return '<img alt="' + alt + '" class="' + className + '" src="/docs/images/' + filename + '">';
    },
    javascript_include_tag: function(name) {
      return '<script src="/docs/javascripts/' + name + '.js"></script>';
    },
    stylesheet_link_tag: function(name, media) {
      return '<link href="/docs/stylesheets/' + name + '.css" rel="stylesheet" type="text/css" media="' + media + '" />';
    },
    langs: (config.language_tabs || []).map(function(lang) {
      return typeof lang == 'string' ? lang : lang.keys.first;
    })
  };
};

gulp.task('clean', function () {
  return del.sync(['dist/*']);
});

gulp.task('fonts', function() {
  return gulp.src('./src/fonts/**/*').pipe(gulp.dest('dist/docs/fonts'));
});

gulp.task('images', function() {
  return gulp.src('./src/images/**/*').pipe(gulp.dest('dist/docs/images'));
});

gulp.task('js', function() {
  var config = readGlobalYml();
  var libs = [
    './src/javascripts/lib/_energize.js',
    './src/javascripts/lib/_jquery.js',
    './src/javascripts/lib/_jquery_ui.js',
    './src/javascripts/lib/_jquery.tocify.js',
    './src/javascripts/lib/_imagesloaded.min.js',
  ];
  var scripts = [
    './src/javascripts/app/_lang.js',
    './src/javascripts/app/_toc.js',
  ];

  if (config.search) {
    libs.push('./src/javascripts/lib/_lunr.js');
    libs.push('./src/javascripts/lib/_jquery.highlight.js');
    libs.push('./src/javascripts/app/_search.js');
  }

  return gulp.src(libs.concat(scripts))
    .pipe(concat('all.js'))
    .pipe(gulpif(COMPRESS, uglify()))
    .pipe(gulp.dest('./dist/docs/javascripts'));
});

gulp.task('sass', function () {
  return gulp.src('./src/stylesheets/*.css.scss')
    .pipe(sass({ importer: tildeImporter }).on('error', sass.logError))
    .pipe(rename({ extname: ''}))
    .pipe(gulpif(COMPRESS, cleanCSS()))
    .pipe(gulp.dest('./dist/docs/stylesheets'));
});

gulp.task('highlightjs', function () {
  var config = readGlobalYml();
  var path = './node_modules/highlight.js/styles/' + config.highlight_theme + '.css';
  return gulp.src(path)
    .pipe(rename({ prefix: 'highlight-'}))
    .pipe(gulpif(COMPRESS, cleanCSS()))
    .pipe(gulp.dest('./dist/docs/stylesheets'));
});

gulp.task('html', function () {
  var globalData = getGlobalPageData();
  return gulp.src('./src/pages/**/index.md')
    .pipe(frontMatter())
    .pipe(layout(function(file) {
      var includes = file.frontMatter.includes
        .map(function(include) { return './src/includes/' + include + '.md'; })
        .map(function(include) { return fs.readFileSync(include, 'utf8'); })
        .map(function(include) { return marked(include, { renderer: renderer }); });

      return assign({}, globalData, {
        prepend: marked(file.contents.toString(), { renderer: renderer }),
        includes: includes
      });
    }))
    .pipe(gulpif(COMPRESS, prettify({indent_size: 2})))
    .pipe(gulp.dest('./dist/docs'));
});

gulp.task('NO_COMPRESS', function() {
  COMPRESS = false;
});

gulp.task('default', ['clean', 'fonts', 'images', 'highlightjs', 'js', 'sass', 'html']);

gulp.task('serve', ['NO_COMPRESS', 'default'], function() {

  gulp.watch(['./src/layout.ejs', './src/**/*', './src/includes/**/*'], ['html']);
  gulp.watch('./src/javascripts/**/*', ['js']);
  gulp.watch('./src/stylesheets/**/*', ['sass']);
  gulp.watch('./src/global.yml', ['highlightjs', 'js', 'html']);

  var server = gls.static('dist', 4567);
  server.start();

  gulp.watch(['dist/**/*'], function (file) {
    server.notify.apply(server, [file]);
  });

  gulp.src(__filename).pipe(open({uri: 'http://localhost:4567/docs'}));
});
