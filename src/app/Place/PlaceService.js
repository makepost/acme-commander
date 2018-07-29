const {
  File,
  FileInfo,
  FileQueryInfoFlags,
  Mount,
  MountMountFlags,
  MountOperation,
  MountOperationResult,
  MountUnmountFlags,
  Volume,
  VolumeMonitor,
} = imports.gi.Gio;
const GLib = imports.gi.GLib;
const { PRIORITY_DEFAULT } = GLib;
const { Button, Menu, Popover } = imports.gi.Gtk;
const { map, parallel } = require("async");
const { noop } = require("lodash");
const { action, computed, decorate, observable, runInAction } = require("mobx");
const Uri = require("url-parse");
const { Place } = require("../../domain/Place/Place");
const { GioAsync } = require("../Gio/GioAsync");
const { GioIcon } = require("../Gio/GioIcon");
const { autoBind } = require("../Gjs/autoBind");
const { RefService } = require("../Ref/RefService");
const formatSize = require("../Size/formatSize").default;

/**
 * Mounts drives and remote locations.
 */
class PlaceService {
  /**
   * Shortens the string as much as possible without making it confusing.
   *
   * @param {string[]} xs
   * @param {string} x
   */
  static minLength(xs, x) {
    for (let i = 1; i < x.length; i++) {
      const short = x.slice(0, i);
      const same = xs.filter(other => other.slice(0, i) === short).length;

      if (same === 1) {
        return short;
      }
    }

    return x;
  }

  /**
   * @private
   */
  get places() {
    /** @type {Place[]} */
    const places = [];

    for (const drive of this.drives) {
      if (!drive.rootUri) {
        places.push(drive);
      }
    }

    for (const mount of this.mounts) {
      if (!mount.isShadowed) {
        places.push(mount);
      }
    }

    places.sort((a, b) => a.name.localeCompare(b.name));

    places.unshift(this.root);

    if (this.home) {
      places.push(this.home);
    }

    return places;
  }

  /**
   * @private
   */
  get shortNames() {
    const places = this.places;

    /** @type {{ [name: string]: string }} */
    const shortNames = {};

    for (const { name, icon } of places) {
      const sameIcon = places
        .filter(x => x.icon === icon)
        .map(x => x.name);

      shortNames[name] = PlaceService.minLength(sameIcon, name);
    }

    return shortNames;
  }

  /**
   * @param {{ refService: RefService }} props
   */
  constructor(props) {
    /** @type {Place[]} */
    this.drives = [];

    this.File = File;

    this.GLib = GLib;

    /** @type {Place | undefined} */
    this.home = undefined;

    // Work around error TS6133 "declared but its value is never read".
    noop(Menu);

    /** @type {{ [panelId: number]: Menu | null }} */
    this.menus = Object.defineProperties({}, {
      0: props.refService.property("placeService.menus.0"),
      1: props.refService.property("placeService.menus.1"),
    });

    this.MountOperation = MountOperation;

    /** @type {Place[]} */
    this.mounts = [];

    this.props = props;

    /** @type {{ [panelId: number]: Popover | null }} */
    this.popovers = Object.defineProperties({}, {
      0: props.refService.property("placeService.popovers.0"),
      1: props.refService.property("placeService.popovers.1"),
    });

    /** @type {Place} */
    this.root = {
      canUnmount: false,
      filesystemFree: 0,
      filesystemSize: 0,
      icon: "computer",
      iconType: "ICON_NAME",
      isShadowed: false,
      name: "/",
      rootUri: "file:///",
      uuid: null,
    };

    /** @type {Place | undefined} */
    this.selected = undefined;

    /** @type {Place[]} */
    this.specials = [];

    // Work around error TS6133 "declared but its value is never read".
    noop(Button);

    /** @type {{ [panelId: number]: Button | null }} */
    this.toggles = Object.defineProperties({}, {
      0: props.refService.property("placeService.toggles.0"),
      1: props.refService.property("placeService.toggles.1"),
    });

    /** @type {Place | undefined} */
    this.trash = undefined;

    this.VolumeMonitor = VolumeMonitor;

    autoBind(this, PlaceService.prototype, __filename);
  }

  /**
   * Returns the place a URI belongs to.
   *
   * @param {string} uri
   */
  getActive(uri) {
    const places = this.places.filter(place => {
      const root = place.rootUri;
      return root && root.length <= uri.length && uri.indexOf(root) === 0;
    });

    if (!places.length) {
      return this.root;
    }

    places.sort((a, b) => {
      const aUri = /** @type {string} */ (a.rootUri);
      const bUri = /** @type {string} */ (b.rootUri);

      return bUri.length - aUri.length;
    });

    return places[0];
  }

  /**
   * Opens a keyboard-friendly places list.
   *
   * @param {number} panelId
   */
  list(panelId) {
    const popover =
      /** @type {Popover} */ (this.popovers[panelId]);

    popover.popup();
  }

  /**
   * Mounts a remote place, such as SFTP.
   *
   * @param {string} uriStr
   * @param {(error: Error | undefined, uri: string | undefined) => void} callback
   */
  mount(uriStr, callback) {
    const uri = Uri(uriStr);
    const { auth, username, password, host } = uri;

    if (!uri.pathname) {
      uri.set("pathname", "/");
    }

    const mountOperation = new this.MountOperation();

    if ((username && password) || auth === username + ":") {
      mountOperation.connect("ask-password", () => {
        mountOperation.set_domain(host);
        mountOperation.set_username(username);
        mountOperation.set_password(password);
        mountOperation.reply(MountOperationResult.HANDLED);
      });
    }

    uri.set("password", "");
    const gFile = this.File.new_for_uri(uri.toString());
    gFile.mount_enclosing_volume(
      MountMountFlags.NONE,
      mountOperation,
      null,
      (_, result) => {
        try {
          gFile.mount_enclosing_volume_finish(result);
        } catch (error) {
          callback(error, undefined);
          return;
        }
        callback(undefined, uri.toString());
      },
    );
  }

  /**
   * Mounts a local volume.
   *
   * @param {string} uuid
   * @param {() => void} callback
   */
  mountUuid(uuid, callback) {
    const gVolMon = this.VolumeMonitor.get();

    for (const gVolume of gVolMon.get_volumes()) {
      if (gVolume.get_identifier("uuid") !== uuid) {
        continue;
      }

      const mountOperation = new this.MountOperation();

      gVolume.mount(MountMountFlags.NONE, mountOperation, null, () => {
        callback();
      });

      break;
    }
  }

  /**
   * Gets a places list from system.
   */
  refresh() {
    parallel(
      [
        this.refreshDrives,
        this.refreshHome,
        this.refreshMounts,
        this.refreshRoot,
        this.refreshSpecials,
        this.refreshTrash,
      ],

      (error) => {
        if (error) {
          print(error);
        }
      },
    );
  }

  /**
   * Selects a given place. For example, context menu will use it.
   *
   * @param {Place} place
   */
  select(place) {
    this.selected = place;
  }

  /**
   * Formats information about a file system for display.
   *
   * @param {Place} place
   */
  status(place) {
    const name = `[${place.name}]`;

    if (!place.filesystemSize) {
      return name;
    }

    const free = formatSize(place.filesystemFree);
    const size = formatSize(place.filesystemSize);

    return `${name} ${free} of ${size} free`;
  }

  /**
   * Unmounts a place.
   *
   * @param {string} uri
   * @param {() => void} callback
   */
  unmount(uri, callback) {
    const gFile = this.File.new_for_uri(uri);
    const gMount = gFile.find_enclosing_mount(null);

    gMount.unmount(MountUnmountFlags.NONE, null, () => {
      callback();
    });
  }

  /**
   * @private
   * @param {File} file
   * @param {(error?: Error, mount?: Mount) => void} callback
   */
  findEnclosingMount(file, callback) {
    GioAsync(
      readyCallback => file.find_enclosing_mount_async(
        PRIORITY_DEFAULT,
        null,
        readyCallback,
      ),

      result => file.find_enclosing_mount_finish(result),

      (error, mount) => {
        if (!mount && error.toString().indexOf("Gio.IOErrorEnum") === 0) {
          callback();
        } else {
          callback(error, mount);
        }
      },
    );
  }

  /**
   * @private
   * @param {FileInfo} info
   */
  getFilesystemFree(info) {
    return Number(info.get_attribute_as_string("filesystem::free"));
  }

  /**
   * @private
   * @param {FileInfo} info
   */
  getFilesystemSize(info) {
    return Number(info.get_attribute_as_string("filesystem::size"));
  }

  /**
   * @private
   * @param {File} file
   * @param {(error?: Error, info?: FileInfo) => void} callback
   */
  queryFileInfo(file, callback) {
    GioAsync(
      readyCallback => file.query_info_async(
        "standard::*",
        FileQueryInfoFlags.NONE,
        PRIORITY_DEFAULT,
        null,
        readyCallback,
      ),

      result => file.query_info_finish(result),

      callback,
    );
  }

  /**
   * @private
   * @param {File} file
   * @param {(error?: Error, info?: FileInfo) => void} callback
   */
  queryFilesystemInfo(file, callback) {
    GioAsync(
      readyCallback => file.query_filesystem_info_async(
        "filesystem::*,mountable::*,standard::icon",
        PRIORITY_DEFAULT,
        null,
        readyCallback,
      ),

      (result) => file.query_filesystem_info_finish(result),

      callback,
    );
  }

  /**
   * @private
   * @param {(error: Error | undefined) => void} callback
   */
  refreshDrives(callback) {
    const gVolMon = this.VolumeMonitor.get();

    /** @type {Volume[]} */
    const volumes = [];

    for (const drive of gVolMon.get_connected_drives()) {
      for (const volume of drive.get_volumes()) {
        volumes.push(volume);
      }
    }

    map(
      volumes,

      (volume, next) => {
        const label = volume.get_identifier("label");
        const uuid = volume.get_identifier("uuid");
        const gMount = volume.get_mount();

        /** @type {Place} */
        const place = {
          canUnmount: !!gMount,
          filesystemFree: 0,
          filesystemSize: 0,
          icon: "drive-harddisk",
          iconType: "ICON_NAME",
          isShadowed: !!gMount,
          name: label || uuid,
          rootUri: gMount ? gMount.get_root().get_uri() : null,
          uuid,
        };

        next(undefined, place);
      },

      (error, places) => {
        if (!places) {
          callback(error);
          return;
        }

        runInAction(() => {
          this.drives = places;
        });

        callback(undefined);
      },
    );
  }

  /**
   * @private
   * @param {File} file
   * @param {(error?: Error, place?: Place) => void} callback
   */
  refreshFile(file, callback) {
    parallel(
      [
        next => this.findEnclosingMount(file, next),
        next => this.queryFileInfo(file, next),
        next => this.queryFilesystemInfo(file, next),
      ],

      (error, results) => {
        if (error) {
          callback(error);
          return;
        }

        const [mount, info, fsInfo] =
          /** @type {[Mount, FileInfo, FileInfo]} */ (results);

        const icon = GioIcon.stringify(info.get_icon());

        callback(undefined, {
          canUnmount: false,
          filesystemFree: this.getFilesystemFree(fsInfo),
          filesystemSize: this.getFilesystemSize(fsInfo),
          icon: icon || "folder",
          iconType: icon ? "GICON" : "ICON_NAME",
          isShadowed: false,
          name: info.get_display_name(),
          rootUri: mount ? mount.get_root().get_uri() : file.get_uri(),
          uuid: mount ? mount.get_uuid() : null,
        });
      },
    );
  }

  /**
   * @private
   * @param {(error?: Error) => void} callback
   */
  refreshHome(callback) {
    const path = this.GLib.get_home_dir();

    if (!path) {
      callback();
      return;
    }

    const file = File.new_for_path(path);

    this.refreshFile(file, (error, place) => {
      if (!place) {
        callback(error);
        return;
      }

      runInAction(() => {
        this.home = place;
      });

      callback();
    });
  }

  /**
   * @private
   * @param {(error?: Error) => void} callback
   */
  refreshMounts(callback) {
    const gVolMon = this.VolumeMonitor.get();
    const mounts = gVolMon.get_mounts();

    map(
      mounts,

      (mount, next) => {
        const root = mount.get_root();

        this.queryFilesystemInfo(root, (error, info) => {
          if (!info) {
            next(error);
            return;
          }

          const icon = GioIcon.stringify(info.get_icon());

          /** @type {Place} */
          const place = {
            canUnmount: info.get_attribute_boolean("mountable::can-unmount"),
            filesystemFree: this.getFilesystemFree(info),
            filesystemSize: this.getFilesystemSize(info),
            icon: icon || "folder",
            iconType: icon ? "GICON" : "ICON_NAME",
            isShadowed: mount.is_shadowed(),
            name: mount.get_name(),
            rootUri: root.get_uri(),
            uuid: mount.get_uuid(),
          };

          next(undefined, place);
        });
      },

      (error, places) => {
        if (!places) {
          callback(error);
          return;
        }

        runInAction(() => {
          this.mounts = places;
        });

        callback();
      },
    );
  }

  /**
   * @private
   * @param {(error?: Error) => void} callback
   */
  refreshRoot(callback) {
    const file = this.File.new_for_uri("file:///");

    this.queryFilesystemInfo(file, (error, info) => {
      if (!info) {
        callback(error);
        return;
      }

      /** @type {Place} */
      const place = {
        canUnmount: false,
        filesystemFree: this.getFilesystemFree(info),
        filesystemSize: this.getFilesystemSize(info),
        icon: "computer",
        iconType: "ICON_NAME",
        isShadowed: false,
        name: "/",
        rootUri: "file:///",
        uuid: null,
      };

      runInAction(() => {
        this.root = place;
      });

      callback();
    });
  }

  /**
   * @private
   * @param {(error?: Error) => void} callback
   */
  refreshSpecials(callback) {
    /** @type {File[]} */
    const files = [];
    const count = this.GLib.UserDirectory.N_DIRECTORIES;

    for (let i = 0; i < count; i++) {
      const path = this.GLib.get_user_special_dir(i);

      if (path) {
        files.push(File.new_for_path(path));
      }
    }

    map(files, this.refreshFile, (error, places) => {
      if (!places) {
        callback(error);
        return;
      }

      runInAction(() => {
        this.specials = /** @type {any} */ (places);
      });

      callback();
    });
  }

  /**
   * @private
   * @param {(error?: Error, place?: Place) => void} callback
   */
  refreshTrash(callback) {
    const file = File.new_for_uri("trash://");

    this.refreshFile(file, (error, place) => {
      if (!place && String(error).indexOf("Gio.IOErrorEnum") === 0) {
        callback();
        return;
      }

      if (!place) {
        callback(error);
        return;
      }

      runInAction(() => {
        this.trash = place;
      });

      callback();
    });
  }
}

decorate(PlaceService, {
  drives: observable,
  home: observable,
  mounts: observable,
  places: computed,
  root: observable,
  select: action,
  selected: observable,
  shortNames: computed,
  specials: observable,
  trash: observable,
});

exports.PlaceService = PlaceService;
