var gulp = require('gulp'), uglify = require('gulp-uglify'), rename = require('gulp-rename');
gulp.task('default', [], function () {
  gulp.src('./leon.js').pipe(uglify()).pipe(rename('leon.min.js')).pipe(gulp.dest('./'));
});
