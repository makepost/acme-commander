const { FileQueryInfoFlags, FileType } = imports.gi.Gio;

function Require(
  Gio = imports.gi.Gio,
  GLib = imports.gi.GLib,
  _imports = imports,
  _window = window,
) {
  this.Gio = Gio;
  this.GLib = GLib;
  this.imports = _imports;
  this.window = _window;

  const keys = Object.getOwnPropertyNames(Require.prototype);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const val = this[key];

    if (key !== "constructor" && typeof val === "function") {
      this[key] = val.bind(this);
    }
  }

  /**
   * Object where filenames of the modules that have ever been required are keys.
   */
  this.filenames = {};

  /**
   * Modules, indexed by filename.
   */
  this.cache = {};

  /**
   * Arrays of required modules, indexed by parent filename.
   */
  this.dependencies = {};

  /**
   * File system polling interval.
   */
  this.HMR_INTERVAL = 1000;

  /**
   * Delay to make sure file has finished being written.
   */
  this.HMR_TIMEOUT = 1000;

  /**
   * Regular expression to get current module path from error stack.
   */
  this.RE = /\n.*?@(.*?):/;

  /**
   * Creates function from string. Breaks coverage for the module defining it,
   * so defined in `./Fun` that is required when `require` is available.
   *
   * @type {any}
   */
  this.Fun = undefined;
}

/**
 * Invalidates cache and calls a function when a module file is changed.
 *
 * @param {string} dirname
 * @param {string} path
 * @param {() => void} callback
 */
Require.prototype.accept = function(dirname, path, callback) {
  const filename = this.resolve(dirname, path);
  let lastContents = {};
  let isVerifyingChange = false;

  const handleChanged = () => {
    if (isVerifyingChange) {
      return;
    }

    isVerifyingChange = true;

    this.GLib.timeout_add(this.GLib.PRIORITY_DEFAULT, this.HMR_TIMEOUT, () => {
      this.flatten(filename).forEach(_filename => {
        if (!isVerifyingChange) {
          return;
        }

        const contents = String(this.GLib.file_get_contents(_filename)[1]);

        if (lastContents[_filename] !== contents) {
          lastContents[_filename] = contents;

          this.flatten(filename).forEach(__filename => {
            delete this.cache[__filename];
          });

          isVerifyingChange = false;
          callback();
        }
      });

      isVerifyingChange = false;
    });
  };

  this.flatten(filename).forEach(_filename => {
    lastContents[_filename] = String(this.GLib.file_get_contents(_filename)[1]);
  });

  this.GLib.timeout_add(this.GLib.PRIORITY_DEFAULT, this.HMR_INTERVAL, () => {
    if (isVerifyingChange) {
      return true;
    }

    this.flatten(filename).forEach(_filename => {
      if (isVerifyingChange) {
        return;
      }

      const contents = String(this.GLib.file_get_contents(_filename)[1]);

      if (lastContents[_filename] !== contents) {
        handleChanged();
      }
    });

    return true;
  });
};

/**
 * Gets pathnames of a cached module and all its dependencies.
 *
 * @param {string} filename
 */
Require.prototype.flatten = function(filename) {
  let result = [filename];
  let nextResult = null;
  let same = false;

  while (!same) {
    nextResult = result
      .reduce((prev, x) => prev.concat(this.dependencies[x]), result)
      .filter((x, i, a) => a.indexOf(x) === i);

    same = result.length === nextResult.length;
    result = nextResult;
  }

  return result;
};

/**
 * Returns a cached module or creates an empty one. Normalizes the path.
 *
 * @param {string} path
 */
Require.prototype.getOrCreate = function(path) {
  const gFile = this.Gio.File.new_for_path(path);
  const dirname = gFile.get_parent().get_path();
  const filename = gFile.get_path();

  const module = this.cache[filename] || (this.cache[filename] = {
    hot: { accept: this.accept.bind(null, dirname) },
    filename: filename,
    exports: {},
  });

  this.filenames[filename] = true;

  if (!this.dependencies[filename]) {
    this.dependencies[filename] = [];
  }

  return module;
};

/**
 * Defines __filename, __dirname, exports, module and require. Does just
 * enough to use some CommonJS from npm that isn't dependent on node.
 */
Require.prototype.require = function() {
  const window = this.window;

  Object.defineProperty(window, "__filename", {
    /**
     * Returns the full path to the module that requested it.
     */
    get: () => {
      const path = this.RE.exec(new Error().stack)[1];
      return this.Gio.File.new_for_path(path).get_path();
    },
  });

  Object.defineProperty(window, "__dirname", {
    /**
     * Returns the full path to the parent dir of the module that requested it.
     */
    get: () => {
      const path = this.RE.exec(new Error().stack)[1];
      return this.Gio.File.new_for_path(path).get_path().replace(/.[^/]+$/, "");
    },
  });

  Object.defineProperty(window, "exports", {
    /**
     * Returns the exports property of the module that requested it. Note: if
     * you refer to exports after reassigning module.exports, this won't behave
     * like CommonJS would.
     */
    get: () => {
      const path = this.RE.exec(new Error().stack)[1];
      const module = this.getOrCreate(path);
      return module.exports;
    },
  });

  Object.defineProperty(window, "module", {
    /**
     * Returns the meta object of the module that requested it, so you can
     * replace the default exported object if you really need to.
     */
    get: () => {
      const path = this.RE.exec(new Error().stack)[1];
      const module = this.getOrCreate(path);
      return module;
    },
  });

  Object.defineProperty(window, "require", {
    /**
     * Returns the require function bound to filename of the module that
     * requested it.
     */
    get: () => {
      const parentPath = this.RE.exec(new Error().stack)[1];
      const gFile = this.Gio.File.new_for_path(parentPath);
      const parentFilename = gFile.get_path();

      const require = this.requireModule.bind(null, parentFilename);
      require.cache = this.cache;
      require.resolve = this.resolve.bind(null, gFile.get_parent().get_path());
      return require;
    },
  });

  this.REQUIRE = memoize(this.REQUIRE);
  this.LOAD_AS_FILE = memoize(this.LOAD_AS_FILE);
  this.LOAD_INDEX = memoize(this.LOAD_INDEX);
  this.LOAD_AS_DIRECTORY = memoize(this.LOAD_AS_DIRECTORY);
  this.LOAD_NODE_MODULES = memoize(this.LOAD_NODE_MODULES);
  this.NODE_MODULES_PATHS = memoize(this.NODE_MODULES_PATHS);
  this.IS_FILE = memoize(this.IS_FILE);
  this.DIRNAME = memoize(this.DIRNAME);

  this.Fun = require("./Fun").default;

  // exports.Require = Require; // FIXME
};

/**
 * Require(X) from module at path Y.
 *
 * @see https://nodejs.org/api/modules.html#modules_all_together
 *
 * @param {string} X
 * @param {string} Y
 */
Require.prototype.REQUIRE = function(X, Y) {
  if (X[0] === "/") {
    Y = "/"; // filesystem root
  }

  if (X.slice(0, 2) === "./" || X[0] === "/" || X.slice(0, 3) === "../") {
    const result = this.LOAD_AS_FILE(this.JOIN(Y, X)) || this.LOAD_AS_DIRECTORY(this.JOIN(Y, X));

    if (result) {
      return result;
    }
  }

  const result = this.LOAD_NODE_MODULES(X, this.DIRNAME(Y));

  if (result) {
    return result;
  }

  throw new Error("Module not found: " + path);
};

/**
 * @param {string} X
 */
Require.prototype.LOAD_AS_FILE = function(X) {
  if (this.IS_FILE(X)) {
    return X;
  }

  if (this.IS_FILE(`${X}.js`)) {
    return `${X}.js`;
  }

  if (this.IS_FILE(`${X}.json`)) {
    return `${X}.json`;
  }
};

Require.prototype.LOAD_INDEX = function(X) {
  if (this.IS_FILE(this.JOIN(X, "index.js"))) {
    return this.JOIN(X, "index.js");
  }

  if (this.IS_FILE(this.JOIN(X, "index.json"))) {
    return this.JOIN(X, "index.json");
  }
};

/**
 * @param {string} X
 */
Require.prototype.LOAD_AS_DIRECTORY = function(X) {
  if (this.IS_FILE(this.JOIN(X, "package.json"))) {
    const contents = String(this.GLib.file_get_contents(this.JOIN(X, "package.json"))[1]);
    const M = this.JOIN(X, JSON.parse(contents).main);
    const result = this.LOAD_AS_FILE(M) || this.LOAD_INDEX(M);

    if (result) {
      return result;
    }
  }

  return this.LOAD_INDEX(X);
};

/**
 * @param {string} X
 * @param {string} START
 */
Require.prototype.LOAD_NODE_MODULES = function(X, START) {
  const DIRS = this.NODE_MODULES_PATHS(START);

  for (const DIR of DIRS) {
    const result = this.LOAD_AS_FILE(this.JOIN(DIR, X)) || this.LOAD_AS_DIRECTORY(this.JOIN(DIR, X));

    if (result) {
      return result;
    }
  }
};

/**
 * @param {string} START
 */
Require.prototype.NODE_MODULES_PATHS = function(START) {
  const PARTS = START.split("/");
  let I = PARTS.length - 1;

  /** @type {string[]} */
  const DIRS = [];

  while (I >= 0) {
    if (PARTS[I] !== "node_modules") {
      DIRS.push(PARTS.slice(0, I + 1).concat("node_modules").reduce(this.JOIN));
    }

    I = I - 1;
  }

  return DIRS;
};

/**
 * @param {string} X
 */
Require.prototype.IS_FILE = function(X) {
  const gFile = this.Gio.file_new_for_path(X);

  if (!gFile.query_exists(null)) {
    return false;
  }

  const gFileInfo = gFile.query_info(
    "standard::type",
    FileQueryInfoFlags.NONE,
    null,
  );

  return gFileInfo.get_file_type() === FileType.REGULAR;
};

/**
 * @param {string} X
 */
Require.prototype.DIRNAME = function(X) {
  return this.Gio.file_new_for_path(X).get_parent().get_path();
};

/**
 * @param {string} X
 * @param {string} Y
 */
Require.prototype.JOIN = function(X, Y) {
  return this.Gio.file_new_for_path(X).resolve_relative_path(Y).get_path();
};

/**
 * Gets a normalized local pathname. Understands Dot and Dot Dot, or looks into
 * node_modules up to the root. Adds '.js' suffix if omitted.
 *
 * @param {string} dirname
 * @param {string} path
 */
Require.prototype.resolve = function(dirname, path) {
  return this.REQUIRE(path, dirname);
};

/**
 * Loads a module by evaluating file contents in a closure. For example, this
 * can be used to require lodash/toString, which Gjs can't import natively. Or
 * to reload a module that has been deleted from cache.
 *
 * @param {string} parentFilename
 * @param {string} path
 */
Require.prototype.requireClosure = function(parentFilename, path) {
  const dirname = this.Gio.file_new_for_path(parentFilename).get_parent().get_path();
  const filename = this.resolve(dirname, path);

  if (this.cache[filename]) {
    return this.cache[filename].exports;
  }

  const contents = String(this.GLib.file_get_contents(filename)[1]);
  const module = this.getOrCreate(filename);

  const require = this.requireModule.bind(null, filename);
  require.cache = this.cache;
  require.resolve = this.resolve.bind(null, dirname);

  this.Fun("exports", "require", "module", "__filename", "__dirname",
    contents,
  )(module.exports, require, module, filename, dirname);

  if (!this.dependencies[parentFilename]) {
    this.dependencies[parentFilename] = [filename];
  } else if (this.dependencies[parentFilename].indexOf(filename) === -1) {
    this.dependencies[parentFilename].push(filename);
  }

  return module.exports;
};

/**
 * Loads a module and returns its exports. Caches the module.
 *
 * @param {string} parentFilename
 * @param {string} path
 */
Require.prototype.requireModule = function(parentFilename, path) {
  const dirname = this.Gio.File.new_for_path(parentFilename).get_parent().get_path();
  const filename = this.resolve(dirname, path);

  if (this.cache[filename]) {
    return this.cache[filename].exports;
  }

  if (this.filenames[filename]) {
    // The module has been deleted from cache.

    if (this.dependencies[filename]) {
      this.dependencies[filename].splice(0);
    }

    return this.requireClosure(parentFilename, path);
  }

  const parts = filename
    .replace(this.imports.searchPath[this.imports.searchPath.length - 2] + "/", "../")
    .replace(this.imports.searchPath[this.imports.searchPath.length - 1] + "/", "")
    .replace(/\.js$/, "")
    .split("/");

  if (parts[parts.length - 1] === "toString") {
    return this.requireClosure(parentFilename, path);
  }

  const module = this.getOrCreate(filename);
  let current = this.imports;
  parts.forEach(x => {
    current = current[x];
  });

  if (!this.dependencies[parentFilename]) {
    this.dependencies[parentFilename] = [filename];
  } else if (this.dependencies[parentFilename].indexOf(filename) === -1) {
    this.dependencies[parentFilename].push(filename);
  }

  return module.exports;
};

/**
 * Caches results of unary or binary function.
 *
 * @param {(arg1: any, arg2?: any) => any} fun
 * @param {({ [key: string]: any })=} cache
 */
function memoize(fun, cache) {
  if (!cache) {
    cache = {};
  }

  if (fun.length === 1) {
    return (arg) => {
      if (cache[arg]) {
        return cache[arg];
      }

      const result = fun(arg);
      cache[arg] = result;
      return result;
    };
  }

  return (arg1, arg2) => {
    if (cache[arg1] && cache[arg1][arg2]) {
      return cache[arg1][arg2];
    }

    const result = fun(arg1, arg2);

    if (!cache[arg1]) {
      cache[arg1] = {};
    }

    cache[arg1][arg2] = result;

    return result;
  };
}
