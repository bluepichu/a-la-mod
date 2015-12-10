var gulp = require("gulp");
var sass = require("gulp-sass");
var autoprefix = require("gulp-autoprefixer");
var htmlMinify = require("gulp-minify-html");
var uglify = require("gulp-uglify");
var del = require("del");
var nconf = require("nconf");
var path = require("path");
var debug = require("gulp-debug");
var nop = require("gulp-nop");

nconf.argv().env();
var ROOT = nconf.get("d") || "build";
var MINIFY = !nconf.get("nominify");

gulp.task("sass", function(){
	return gulp.src("public/scss/main.scss")
		.pipe(sass({outputStyle: "compressed"}))
		.pipe(autoprefix({
		browsers: ["last 2 versions", "> 1%"],
		cascade: false,
		remove: false
	}))
		.pipe(gulp.dest(path.join(ROOT, "css")));
});

gulp.task("html", function(){
	return gulp.src("public/*.html")
		.pipe(MINIFY ? htmlMinify() : nop())
		.pipe(gulp.dest(ROOT));
});

gulp.task("images", function(){
	return gulp.src("public/images/**/*.{png,svg,jpg}")
		.pipe(gulp.dest(path.join(ROOT, "images")));
});

gulp.task("js", function(){
	return gulp.src("public/js/**/*.js")
		.pipe(MINIFY ? uglify() : nop())
		.pipe(gulp.dest(path.join(ROOT, "js")));
});

gulp.task("fonts", function(){
	return gulp.src("public/fonts/**/*.{eot,svg,ttf,woff,woff2}")
		.pipe(gulp.dest(path.join(ROOT, "fonts")));
});

gulp.task("static", function(){
	return gulp.src("public/static/**/*.*")
		.pipe(gulp.dest(path.join(ROOT, "static")));
});

gulp.task("templates", function(){
	return gulp.src("public/templates/*.hbs")
		.pipe(MINIFY ? htmlMinify() : nop())
		.pipe(gulp.dest(path.join(ROOT, "templates")));
});

gulp.task("others", function(){
	return gulp.src("public/service-worker.js")
		.pipe(gulp.dest("build"));
});

gulp.task("clean", function(){
	return Promise.all([del([ROOT])]);
});

gulp.task("watch", ["build"], function(){
	gulp.watch("public/scss/**/*.*", ["sass"]);
	gulp.watch("public/*.html", ["html"]);
	gulp.watch("public/images/**/*.*", ["images"]);
	gulp.watch("public/js/**/*.js", ["js"]);
	gulp.watch("public/fonts/**/*.*", ["fonts"]);
	gulp.watch("public/static/**/*.*", ["static"]);
	gulp.watch("public/templates/*.hbs", ["templates"]);
	gulp.watch("public/service-worker.js", ["others"]);
});

gulp.task("build", ["clean"], function(){
	gulp.start(["sass", "html", "images", "js", "fonts", "static", "templates", "others"]);
});