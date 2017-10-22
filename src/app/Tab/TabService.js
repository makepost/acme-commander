const { extendObservable } = require("mobx");
const orderBy = require("lodash/orderBy");

function TabService() {
  extendObservable(this, {
    entities: this.entities,
  });
}

const sampleFiles = [
  {
    name: "..",
    fileType: "DIRECTORY",
    icon: "folder",
    iconType: "ICON_NAME",
    size: 0,
    modificationTime: Date.now(),
    mode: "0755",
  },
  {
    name: "clan in da front.txt",
    fileType: "REGULAR",
    icon: "text-x-generic",
    iconType: "ICON_NAME",
    size: 4110,
    modificationTime: Date.now(),
    mode: "0644",
  },
];

TabService.prototype.entities = {
  0: {
    cursor: 0,
    files: sampleFiles,
    location: "file:///",
    selected: [],
    sortedBy: "ext",
  },
  1: {
    cursor: 0,
    files: sampleFiles,
    location: "file:///",
    selected: [],
    sortedBy: "ext",
  },
};

/**
 * @param {{ cursor: number, tabId: number }} props
 */
TabService.prototype.cursor = function(props) {
  this.entities[props.tabId].cursor = props.cursor;
};

/**
 * @param {{ selected: number[], tabId: number }} props
 */
TabService.prototype.selected = function(props) {
  this.entities[props.tabId].selected = props.selected;
};

/**
 * @param {{ files: any[], id: number, location: string, sortedBy?: string }} props
 */
TabService.prototype.set = function(props) {
  const tab = this.entities[props.id];
  const sortedBy = props.sortedBy || tab.sortedBy;

  tab.files = sortFiles(sortedBy, props.files);
  tab.location = props.location;
};

/**
 * @param {{ by: string, tabId: number }} props
 */
TabService.prototype.sorted = function(props) {
  const tab = this.entities[props.tabId];

  const by = nextSort(tab.sortedBy, props.by);
  const files = sortFiles(by, tab.files);

  tab.sortedBy = by;
  tab.files = files;
};

exports.nextSort = nextSort;
function nextSort(prevBy, by) {
  if (by === "filename" && prevBy !== "filename") {
    return "filename";
  }
  if (by === "filename" && prevBy === "filename") {
    return "-filename";
  }
  if (by === "ext" && prevBy !== "ext") {
    return "ext";
  }
  if (by === "ext" && prevBy === "ext") {
    return "-ext";
  }
  if (by === "mtime" && prevBy !== "mtime") {
    return "mtime";
  }
  if (by === "mtime" && prevBy === "mtime") {
    return "-mtime";
  }
  return prevBy;
}

exports.sortFiles = sortFiles;
function sortFiles(by, files) {
  switch (by) {
    case "filename":
      return orderBy(
        files,
        [
          x => x.fileType === "DIRECTORY",
          x => x.name.toLowerCase(),
        ],
        ["desc", "asc"],
      );

    case "-filename":
      return orderBy(
        files,
        [
          x => x.fileType === "DIRECTORY",
          x => x.name.toLowerCase(),
        ],
        ["desc", "desc"],
      );

    case "ext":
      return orderBy(
        files,
        [
          x => x.fileType === "DIRECTORY",
          x => {
            const matches = /^(.+)\.(.*?)$/.exec(x.name);
            return matches && x.fileType !== "DIRECTORY" ? matches[2].toLowerCase() : "";
          },
          x => x.name.toLowerCase(),
        ],
        ["desc", "asc", "asc"],
      );

    case "-ext":
      return orderBy(
        files,
        [
          x => x.fileType === "DIRECTORY",
          x => {
            const matches = /^(.+)\.(.*?)$/.exec(x.name);
            return matches && x.fileType !== "DIRECTORY" ? matches[2].toLowerCase() : "";
          },
          x => x.name.toLowerCase(),
        ],
        ["desc", "desc", "desc"],
      );

    case "mtime":
      return orderBy(
        files,
        [
          x => x.fileType === "DIRECTORY",
          "modificationTime",
          x => x.name.toLowerCase(),
        ],
        ["desc", "asc", "asc"],
      );

    case "-mtime":
      return orderBy(
        files,
        [
          x => x.fileType === "DIRECTORY",
          "modificationTime",
          x => x.name.toLowerCase(),
        ],
        ["desc", "desc", "desc"],
      );

    default:
      return files;
  }
}

exports.TabService = TabService;
