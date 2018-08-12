const expect = require("expect");
const { noop } = require("lodash");
const { ActionBarRm } = require("./ActionBarRm");

describe("ActionBarRm", () => {
  it("renders", () => {
    new ActionBarRm({ label: "" }).render();
  });

  it("enables drop", () => {
    /** @type {any} */
    const node = {
      connect: noop,
      drag_dest_add_uri_targets: expect.createSpy(),
      drag_dest_set: expect.createSpy(),
    };

    new ActionBarRm({ label: "" }).ref(node);

    expect(node.drag_dest_set).toHaveBeenCalled();
    expect(node.drag_dest_add_uri_targets).toHaveBeenCalled();
  });

  it("removes dropped files", () => {
    /** @type {any} */
    const jobService = {
      run: expect.createSpy(),
    };

    /** @type {any} */
    const panelService = {
      refresh: expect.createSpy(),
    };

    new ActionBarRm({
      jobService,
      label: "",
      panelService,
    }).handleDrop({
      uris: ["file:///foo.bar"],
    });

    expect(jobService.run).toHaveBeenCalledWith({
      destUri: "",
      type: "rm",
      uris: ["file:///foo.bar"],
    }, panelService.refresh);
  });

  it("removes selected files on click", () => {
    /** @type {any} */
    const selectService = {
      rm: expect.createSpy(),
    };

    new ActionBarRm({
      label: "",
      selectService,
    }).handlePressed();

    expect(selectService.rm).toHaveBeenCalled();
  });

  it("refs null", () => {
    new ActionBarRm({ label: "" }).ref(null);
  });
});
