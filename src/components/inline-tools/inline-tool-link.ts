import SelectionUtils from '../selection';

import $ from '../dom';
import _ from '../utils';
import {API, InlineTool, SanitizerConfig} from '../../../types';
import {InlineToolbar, Notifier, Toolbar} from '../../../types/api';

/**
 * Link Tool
 *
 * Inline Toolbar Tool
 *
 * Wrap selected text with <a> tag
 */
export default class LinkInlineTool implements InlineTool {

  /**
   * Specifies Tool as Inline Toolbar Tool
   *
   * @return {boolean}
   */
  public static isInline = true;

  /**
   * Sanitizer Rule
   * Leave <a> tags
   * @return {object}
   */
  static get sanitize(): SanitizerConfig {
    return {
      a: {
        href: true,
        target: '_blank',
        rel: 'nofollow',
      },
    } as SanitizerConfig;
  }

  /**
   * Native Document's commands for link/unlink
   */
  private readonly commandLink: string = 'createLink';
  private readonly commandUnlink: string = 'unlink';

  /**
   * Enter key code
   */
  private readonly ENTER_KEY: number = 13;

  /**
   * Styles
   */
  private readonly CSS = {
    button: 'ce-inline-tool',
    buttonActive: 'ce-inline-tool--active',
    buttonModifier: 'ce-inline-tool--link',
    buttonUnlink: 'ce-inline-tool--unlink',
    input: 'ce-inline-tool-input',
    actionShowed: 'ce-inline-tool-wrap--showed',
    action: 'ce-inline-tool-wrap',
    close: 'ce-inline-tool-wrap__close',
  };

  /**
   * Elements
   */
  private nodes: {
    button: HTMLButtonElement;
    input: HTMLInputElement;
    action: HTMLDivElement;
  } = {
    button: null,
    input: null,
    action: null,
  };

  /**
   * SelectionUtils instance
   */
  private selection: SelectionUtils;

  /**
   * Input opening state
   */
  private inputOpened: boolean = false;

  /**
   * Available Toolbar methods (open/close)
   */
  private toolbar: Toolbar;

  /**
   * Available inline toolbar methods (open/close)
   */
  private inlineToolbar: InlineToolbar;

  /**
   * Notifier API methods
   */
  private notifier: Notifier;

  /**
   * @param {{api: API}} - Editor.js API
   */
  constructor({api}) {
    this.toolbar = api.toolbar;
    this.inlineToolbar = api.inlineToolbar;
    this.notifier = api.notifier;
    this.selection = new SelectionUtils();
  }

  /**
   * Create button for Inline Toolbar
   */
  public render(): HTMLElement {
    this.nodes.button = document.createElement('button') as HTMLButtonElement;
    this.nodes.button.type = 'button';
    this.nodes.button.classList.add(this.CSS.button, this.CSS.buttonModifier);
    this.nodes.button.appendChild($.svg('link', 34, 34));
    this.nodes.button.appendChild($.svg('unlink', 16, 18));
    return this.nodes.button;
  }

  /**
   * Input for the link
   */
  public renderActions(): HTMLElement {
    const close = document.createElement('span') as HTMLSpanElement;

    close.appendChild($.svg('close-inline', 11, 11));
    close.classList.add(this.CSS.close);
    close.addEventListener('click', (event: MouseEvent) => {
      this.handleSave(event);
    });

    this.nodes.action = document.createElement('div') as HTMLDivElement;
    this.nodes.action.classList.add(this.CSS.action);

    this.nodes.input = document.createElement('input') as HTMLInputElement;
    this.nodes.input.placeholder = 'Paste or type a link...';
    this.nodes.input.classList.add(this.CSS.input);
    this.nodes.input.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.keyCode === this.ENTER_KEY) {
        this.handleSave(event);
      }
    });

    this.nodes.action.appendChild(this.nodes.input);
    this.nodes.action.appendChild(close);

    return this.nodes.action;
  }

  /**
   * Handle clicks on the Inline Toolbar icon
   * @param {Range} range
   */
  public surround(range: Range): void {
    /**
     * Range will be null when user makes second click on the 'link icon' to close opened input
     */
    if (range) {
      /**
       * Save selection before change focus to the input
       */
      if (!this.inputOpened) {
        this.selection.save();
      } else {
        this.selection.restore();
      }
      const parentAnchor = this.selection.findParentTag('A');

      /**
       * Unlink icon pressed
       */
      if (parentAnchor) {
        this.selection.expandToTag(parentAnchor);
        this.unlink();
        this.closeActions();
        this.checkState();
        this.toolbar.close();
        return;
      }
    }

    this.toggleActions();
  }

  /**
   * Check selection and set activated state to button if there are <a> tag
   * @param {Selection} selection
   */
  public checkState(selection?: Selection): boolean {
    const anchorTag = this.selection.findParentTag('A');

    if (anchorTag) {
      this.nodes.button.classList.add(this.CSS.buttonUnlink);
      this.nodes.button.classList.add(this.CSS.buttonActive);
      this.openButtons();
      this.selection.save();
    } else {
      this.nodes.button.classList.remove(this.CSS.buttonUnlink);
      this.nodes.button.classList.remove(this.CSS.buttonActive);
    }

    return !!anchorTag;
  }

  /**
   * Function called with Inline Toolbar closing
   */
  public clear(): void {
    this.closeActions();
  }

  /**
   * Set a shortcut
   */
  public get shortcut(): string {
    return 'CMD+K';
  }

  private toggleActions(): void {
    if (!this.inputOpened) {
      this.openActions(true);
    } else {
      this.closeActions(false);
    }
  }

  /**
   * @param {boolean} needFocus - on link creation we need to focus input. On editing - nope.
   */
  private openActions(needFocus: boolean = false): void {
    this.nodes.action.classList.add(this.CSS.actionShowed);
    if (needFocus) {
      this.nodes.input.focus();
    }
    this.inputOpened = true;
    this.inlineToolbar.toggleButtons(false);
  }

  private openButtons(): void {
    this.nodes.action.classList.remove(this.CSS.actionShowed);
    this.inputOpened = false;
    this.inlineToolbar.toggleButtons(true);
  }

  /**
   * Close input
   * @param {boolean} clearSavedSelection — we don't need to clear saved selection
   *                                        on toggle-clicks on the icon of opened Toolbar
   */
  private closeActions(clearSavedSelection: boolean = true): void {
    this.nodes.action.classList.remove(this.CSS.actionShowed);
    this.nodes.input.value = '';
    if (clearSavedSelection) {
      this.selection.clearSaved();
    }
    this.inputOpened = false;
    this.inlineToolbar.toggleButtons(true);
  }

  /**
   * @param {UIEvent} event
   */
  private handleSave(event: UIEvent): void {
    let value = this.nodes.input.value || '';

    if (!value.trim()) {
      this.selection.restore();
      this.unlink();
      event.preventDefault();
      this.closeActions();
    }

    if (!this.validateURL(value)) {

      this.notifier.show({
        message: 'Pasted link is not valid.',
        style: 'error',
      });

      _.log('Incorrect Link pasted', 'warn', value);
      return;
    }

    value = this.prepareLink(value);

    this.selection.restore();

    this.insertLink(value);

    /**
     * Preventing events that will be able to happen
     */
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this.selection.collapseToEnd();
    this.inlineToolbar.close();
  }

  /**
   * Detects if passed string is URL
   * @param  {string}  str
   * @return {Boolean}
   */
  private validateURL(str: string): boolean {
    /**
     * Don't allow spaces
     */
    return !/\s/.test(str);
  }

  /**
   * Process link before injection
   * - sanitize
   * - add protocol for links like 'google.com'
   * @param {string} link - raw user input
   */
  private prepareLink(link: string): string {
    link = link.trim();
    link = this.addProtocol(link);
    return link;
  }

  /**
   * Add 'http' protocol to the links like 'vc.ru', 'google.com'
   * @param {String} link
   */
  private addProtocol(link: string): string {
    /**
     * If protocol already exists, do nothing
     */
    if (/^(\w+):(\/\/)?/.test(link)) {
      return link;
    }

    /**
     * We need to add missed HTTP protocol to the link, but skip 2 cases:
     *     1) Internal links like "/general"
     *     2) Anchors looks like "#results"
     *     3) Protocol-relative URLs like "//google.com"
     */
    const isInternal = /^\/[^\/\s]/.test(link),
      isAnchor = link.substring(0, 1) === '#',
      isProtocolRelative = /^\/\/[^\/\s]/.test(link);

    if (!isInternal && !isAnchor && !isProtocolRelative) {
      link = 'http://' + link;
    }

    return link;
  }

  /**
   * Inserts <a> tag with "href"
   * @param {string} link - "href" value
   */
  private insertLink(link: string): void {

    /**
     * Edit all link, not selected part
     */
    const anchorTag = this.selection.findParentTag('A');

    if (anchorTag) {
      this.selection.expandToTag(anchorTag);
    }

    document.execCommand(this.commandLink, false, link);
  }

  /**
   * Removes <a> tag
   */
  private unlink(): void {
    document.execCommand(this.commandUnlink);
  }
}
