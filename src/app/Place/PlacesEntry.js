const Gtk = imports.gi.Gtk;
const { Box, Image, Label } = Gtk;
const Component = require("inferno-component").default;
const { connect } = require("inferno-mobx");
const { Place } = require("../../domain/Place/Place");
const { GioIcon } = require("../Gio/GioIcon");
const { autoBind } = require("../Gjs/autoBind");
const { h } = require("../Gjs/GtkInferno");
const { PanelService } = require("../Panel/PanelService");
const ToggleButton = require("../ToggleButton/ToggleButton").default;
const { PlaceService } = require("./PlaceService");

/**
 * @typedef IProps
 * @property {number} panelId
 * @property {PanelService?} [panelService]
 * @property {Place} place
 * @property {PlaceService?} [placeService]
 *
 * @extends Component<IProps>
 */
class PlacesEntry extends Component {
  /**
   * @param {IProps} props
   */
  constructor(props) {
    super(props);
    autoBind(this, PlacesEntry.prototype, __filename);
  }

  isActive() {
    const { getActivePlace } =
      /** @type {PanelService} */ (this.props.panelService);

    const place = getActivePlace(this.props.panelId);

    return place === this.props.place;
  }

  handleClicked() {
    const { openPlace, refresh } =
      /** @type {PanelService} */ (this.props.panelService);

    const { mountUuid, unmount } =
      /** @type {PlaceService} */ (this.props.placeService);

    const { canUnmount, rootUri, uuid } = this.props.place;

    const menu = new Gtk.Menu();
    let item;

    if (rootUri && !this.isActive()) {
      item = new Gtk.MenuItem();
      item.label = "Open";
      item.connect("activate", () => {
        openPlace(this.props.panelId, this.props.place);
      });
      menu.add(item);
    }

    if (rootUri && canUnmount && !this.isActive()) {
      item = new Gtk.MenuItem();
      item.label = "Unmount";
      item.connect("activate", () => {
        unmount(rootUri, refresh);
      });
      menu.add(item);
    }

    if (!rootUri && uuid) {
      item = new Gtk.MenuItem();
      item.label = "Mount";
      item.connect("activate", () => {
        mountUuid(uuid, refresh);
      });
      menu.add(item);
    }

    if (!item) {
      openPlace(this.props.panelId, this.props.place);
      return;
    }

    menu.show_all();
    menu.popup(null, null, null, 0, 0);
  }

  render() {
    const { shortNames, status } =
      /** @type {PlaceService} */ (this.props.placeService);

    const { icon, iconType, name } = this.props.place;

    return h(ToggleButton, {
      active: this.isActive(),
      can_focus: false,
      pressedCallback: this.handleClicked,
      relief: Gtk.ReliefStyle.NONE,
      tooltip_text: status(this.props.place),
    }, [
        h(Box, { spacing: 4 }, [
          h(Image, {
            gicon: GioIcon.get({ icon: icon, iconType: iconType }),
            icon_size: Gtk.IconSize.SMALL_TOOLBAR,
          }),
          h(Label, { label: shortNames[name] }),
        ]),
      ]);
  }
}

exports.PlacesEntry = PlacesEntry;
exports.default = connect(["panelService", "placeService"])(PlacesEntry);