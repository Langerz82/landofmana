// Converted from AMD (define) + Class.extend to a native ES6 module/class.
export default class TabBook {
    // FIX: constructor never declared a `parent` parameter, so `this.parent = parent` resolved
    // to the global `window.parent`, not anything meaningful. Every current subclass
    // (storedialog.js/craftdialog.js/auctiondialog.js/appearancedialog.js) immediately
    // re-assigns `this.parent = parent` right after calling super(), which masked this, but
    // any future subclass that didn't repeat that assignment would silently get window.parent.
    constructor(id, parent) {
      this.parent = parent;
      this.id = id;
      this.body = $(id);
      this.pages = [];
      this.pageIndex = -1;

      this.openHandler = null;
    }

    getPageCount() {
      return this.pages.length;
    }
    getPageIndex() {
      return this.pageIndex;
    }
    setPageIndex(value) {
      if(this.pageIndex >= 0) {
        this.pages[this.pageIndex].setVisible(false);
      }
      if((value >= 0) && (value < this.pages.length)) {
        const done = this.openHandler ? this.openHandler(this, value) : true;
        if(done) {
          this.pageIndex = value;
          this.pages[this.pageIndex].setVisible(true);
        }
      } else {
        this.pageIndex = -1;
      }
    }
    getActivePage() {
      return this.pageIndex >= 0 ? this.pages[this.pageIndex] : null;
    }
    setActivePage(value) {
      const index = this.pages.indexOf(value);
      if(index >= 0) {
        this.setPageIndex(index);
      }
    }

    add(page) {
      page.setParent(this);
      this.pages.push(page);
    }

    onOpen(handler) {
      this.openHandler = handler;
    }
}
