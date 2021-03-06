#!/usr/bin/gjs
// Sets up the environment and runs the tests.
// - `node bin/test`: All tests.
// - `node bin/test Action Panel`: Tests from src/app/{Action,Panel} only.

const path = String(new Error().stack).replace(/^.*?@(.*):[\s\S]*/, "$1");
const dirname = imports.gi.Gio.File.new_for_path(path).resolve_relative_path("../..").get_path();
imports.searchPath.push(dirname);
new imports.src.app.Gjs.Require.Require().require();
new imports.src.app.Gjs.GtkDom.GtkDom().require();
require("../src/app/Test/Test").require();

const { Worker } = require("../src/app/Gio/Worker");
const data = Worker.flatten(imports.gi.Gio.File.new_for_path(dirname + "/src"));

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
