const groupBy = require("lodash/groupBy");
const throttle = require("lodash/throttle");
const perf = {};

const reportPerf = throttle(function() {
  const data = Object.keys(perf)
    .map(location => ({
      location,
      time: perf[location],
    }))
    .sort((a, b) => b.time - a.time)
    .slice(0, 10);

  print(JSON.stringify(data));
}, 10000);

exports.default = exports.autoBind = function(self, prototype) {
  const keys = Object.getOwnPropertyNames(prototype);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const val = prototype[key];

    if (key !== "constructor" && typeof val === "function") {
      self[key] = val.bind(self);

      if (process.env.NODE_ENV === "development") {
        const bound = self[key];

        self[key] = function() {
          const args = Array.prototype.slice.call(arguments);
          const match = /.*app\/(.*)/.exec(new Error().stack.split("\n")[1]);
          const start = Date.now();
          const result = bound.apply(self, args);
          if (match) {
            perf[match[1]] = (perf[match[1]] || 0) + Date.now() - start;
          }
          reportPerf();
          return result;
        };
      }
    }
  }
};
