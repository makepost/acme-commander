#!/usr/bin/gjs
// Sets up the environment and runs the tests.
// - `node bin/test`: All tests.
// - `node bin/test Action Panel`: Tests from src/app/{Action,Panel} only.

const path = /^.*?@(.*):/.exec(new Error().stack)[1];
const dirname = imports.gi.Gio.File.new_for_path(path).get_parent().get_parent().get_path();
imports.searchPath.push(dirname);
new imports.src.app.Gjs.Require.Require().require();
new imports.src.app.Gjs.GtkDom.GtkDom().require();
require("../src/app/Test/Test").require();

const { Worker } = require("../src/app/Gio/Worker");
const data = new Worker(null, null).flatten(imports.gi.Gio.File.new_for_path(dirname + "/src"));

const scripts = data.files.map(x => x.relativePath).filter(x => (
  !!x &&
  x.slice(-3) === ".js" &&
  x !== "app/index.js" &&
  (!ARGV.length || ARGV.indexOf(x.split("/").slice(-2)[0]) !== -1)
)).map(x => "../src/" + x);

const tests = scripts.filter(x => /\.test\.js$/.test(x));
tests.forEach(x => {
  require(x);
});

// Make sure the report shows uncovered modules.
const modules = scripts.filter(x => !/\.test\.js$/.test(x));
modules.forEach(x => {
  require(x);
});