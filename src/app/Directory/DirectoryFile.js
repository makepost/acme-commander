const { FileType } = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Component = require("inferno-component").default;
const { h } = require("../Gjs/GtkInferno");
const { connect } = require("inferno-mobx");
const { File } = require("../../domain/File/File");
const { autoBind } = require("../Gjs/autoBind");
const formatSize = require("../Size/formatSize").default;

/**
 * @typedef IProps
 * @property {File} file
 * @property {boolean} isSelected
 *
 * @extends Component<IProps>
 */
class DirectoryFile extends Component {
  /**
   * @param {IProps} props
   */
  constructor(props) {
    super(props);
    autoBind(this, DirectoryFile.prototype, __filename);
  }

  name() {
    const file = this.props.file;
    let filename = file.name;
    let ext = "";

    const matches = /^(.+)\.(.*?)$/.exec(file.name);

    if (file.fileType !== FileType.DIRECTORY && file.name !== ".." && matches) {
      filename = matches[1];
      ext = matches[2];
    }

    if (file.fileType === FileType.DIRECTORY) {
      filename = "[" + file.name + "]";
    }
    return [filename, ext];
  }

  size() {
    const file = this.props.file;
    return file.fileType === FileType.DIRECTORY ? "<DIR>" : formatSize(file.size);
  }

  mtime() {
    const time = this.props.file.modificationTime;
    const date = new Date(time * 1000);

    const month = ("00" + (date.getMonth() + 1)).slice(-2);
    const day = ("00" + date.getDate()).slice(-2);
    const year = ("0000" + date.getFullYear()).slice(-4);
    const hours = ("00" + date.getHours()).slice(-2);
    const minutes = ("00" + date.getMinutes()).slice(-2);

    return [month, day, year].join("/") + " " + [hours, minutes].join(":");
  }

  /**
   * @param {string} input
   */
  shouldSearchSkip(input) {
    return !GLib.pattern_match_simple(input.toLowerCase() + "*", this.props.file.name.toLowerCase());
  }

  render() {
    const { file, isSelected } = this.props;
    const [filename, ext] = this.name();

    return h("stub", {
      ext,
      filename,
      icon: file,
      isSelected,
      mode: file.mode,
      mtime: this.mtime(),
      pixbuf: isSelected ? DirectoryFile.selected : file,
      shouldSearchSkip: this.shouldSearchSkip,
      size: this.size(),
    });
  }
}

DirectoryFile.selected = { icon: "emblem-default", iconType: "GICON" };

exports.DirectoryFile = DirectoryFile;
exports.default = connect([])(DirectoryFile);
