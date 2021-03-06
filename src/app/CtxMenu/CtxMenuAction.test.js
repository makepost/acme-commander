const expect = require("expect");
const { CtxMenuAction } = require("./CtxMenuAction");

describe("CtxMenuAction", () => {
  it("renders", () => {
    new CtxMenuAction({
      icon: "edit-copy",
      iconSize: 16,
      id: "copy",
      label: "Copy",
    }).render();
  });

  it("connects activate", () => {
    const handler = expect.createSpy();

    /** @type {any} */
    const actionService = {
      get: () => ({ handler }),
    };

    /** @type {any} */
    const menuItem = {
      connect: expect.createSpy(),
    };

    new CtxMenuAction({
      actionService,
      icon: "edit-copy",
      iconSize: 16,
      id: "selectService.copy",
      label: "Copy",
    }).ref(menuItem);

    expect(menuItem.connect).toHaveBeenCalledWith("activate", handler);
  });
});
