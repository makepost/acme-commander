const { DragAction, Gravity } = imports.gi.Gdk;
const {
  Box,
  Button,
  IconSize,
  Image,
  Label,
  ReliefStyle,
} = imports.gi.Gtk;
const { Component } = require("inferno");
const { inject, observer } = require("inferno-mobx");
const nullthrows = require("nullthrows").default;
const { Place } = require("../../domain/Place/Place");
const { Drag } = require("../Drag/Drag");
const { GioIcon } = require("../Gio/GioIcon");
const { autoBind } = require("../Gjs/autoBind");
const { h } = require("../Gjs/GtkInferno");
const { JobService } = require("../Job/JobService");
const { MouseEvent } = require("../Mouse/MouseEvent");
const { PanelService } = require("../Panel/PanelService");
const { PlaceService } = require("../Place/PlaceService");

/**
 * @typedef IProps
 * @property {JobService?} [jobService]
 * @property {number} panelId
 * @property {Place} place
 * @property {PanelService?} [panelService]
 * @property {PlaceService?} [placeService]
 *
 * @extends Component<IProps>
 */
class PlaceEntry extends Component {
  /**
   * @param {IProps} props
   */
  constructor(props) {
    super(props);
    autoBind(this, PlaceEntry.prototype, __filename);

    /**
     * @type {Button | null}
     */
    this.button = null;
  }

  /**
   * @param {{ action: number, uris: string[] }} ev
   */
  handleDrop(ev) {
    const { run } = nullthrows(this.props.jobService);
    const { refresh } = nullthrows(this.props.panelService);

    run({
      destUri: nullthrows(this.props.place.rootUri),
      type: ev.action === DragAction.MOVE ? "mv" : "cp",
      uris: ev.uris,
    }, refresh);
  }

  handleMenu() {
    const { menus, select } = nullthrows(this.props.placeService);
    const menu = nullthrows(menus[this.props.panelId]);

    select(this.props.place);

    menu.popup_at_widget(
      nullthrows(this.button),
      Gravity.CENTER,
      Gravity.STATIC,
      null,
    );
  }

  /**
   * @param {Button | null} button
   */
  ref(button) {
    if (!button) {
      return;
    }

    this.button = button;

    button.connect("clicked", () => {
      const { openPlace } = nullthrows(this.props.panelService);
      const { popovers } = nullthrows(this.props.placeService);
      const popover = nullthrows(popovers[this.props.panelId]);

      openPlace(this.props.panelId, this.props.place);
      popover.hide();
    });

    new Drag(button).onDrop(this.handleDrop);

    MouseEvent.connectMenu(button, this.handleMenu);

    button.connect("popup-menu", this.handleMenu);
  }

  render() {
    const { place } = this.props;
    const { status } =
      /** @type {PlaceService} */ (this.props.placeService);

    return (
      h(Button, {
        ref: this.ref,
        relief: ReliefStyle.NONE,
        tooltip_text: status(place),
      }, [
        h(Box, { spacing: 4 }, [
          h(Image, {
            gicon: GioIcon.get(place),
            icon_size: IconSize.SMALL_TOOLBAR,
          }),

          h(Label, { label: place.name }),
        ]),
      ])
    );
  }
}

exports.PlaceEntry = PlaceEntry;
exports.default = inject("jobService", "panelService", "placeService")(observer(PlaceEntry));
