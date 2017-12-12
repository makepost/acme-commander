const { DragAction } = imports.gi.Gdk;
const { Button, DestDefaults, ReliefStyle } = imports.gi.Gtk;
const Component = require("inferno-component").default;
const { h } = require("../Gjs/GtkInferno");
const { connect } = require("inferno-mobx");
const { autoBind } = require("../Gjs/autoBind");
const { JobService } = require("../Job/JobService");
const { PanelService } = require("../Panel/PanelService");
const { SelectionService } = require("../Selection/SelectionService");

/**
 * @typedef IProps
 * @property {JobService?} [jobService]
 * @property {PanelService?} [panelService]
 * @property {SelectionService?} [selectionService]
 * @property {string} label
 *
 * @extends Component<IProps>
 */
class ActionBarRm extends Component {
  /**
   * @param {IProps} props
   */
  constructor(props) {
    super(props);
    autoBind(this, ActionBarRm.prototype, __filename);
  }

  // tslint:disable:variable-name
  /**
   * @param {any} _node
   * @param {any} _dragContext
   * @param {number} _x
   * @param {number} _y
   * @param {{ get_uris(): string[] }} selectionData
   */
  handleDrop(_node, _dragContext, _x, _y, selectionData) {
    const { run } = /** @type {JobService} */ (this.props.jobService);
    const { refresh } = /** @type {PanelService} */ (this.props.panelService);
    const uris = selectionData.get_uris();

    run({
      destUri: "",
      type: "rm",
      uris,
    }, refresh);
  }
  // tslint-enable: variable-name

  handlePressed() {
    const { rm } = /** @type {SelectionService} */ (this.props.selectionService);
    rm();
  }

  /**
   * @param {Button} node
   */
  ref(node) {
    node.connect("drag-data-received", this.handleDrop);
    node.connect("pressed", this.handlePressed);
    node.drag_dest_set(DestDefaults.ALL, [], DragAction.MOVE);
    node.drag_dest_add_uri_targets();
  }

  render() {
    return (
      h(Button, {
        can_focus: false,
        expand: true,
        label: this.props.label,
        ref: this.ref,
        relief: ReliefStyle.NONE,
      })
    );
  }
}

exports.ActionBarRm = ActionBarRm;
exports.default = connect(["jobService", "panelService", "selectionService"])(
  ActionBarRm,
);
