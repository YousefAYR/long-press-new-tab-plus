# Long Press New Tab Plus

A Firefox extension: click and hold a link to open it in a new tab, with no modifier keys or context menu. Each mouse button and drag direction can run its own action.

It is a fork of [Long Press New Tab](https://addons.mozilla.org/firefox/addon/long_press_new_tab/) by Kunihiro Ando (MIT).

## Features

### Long press

Choose an action for each mouse button with customizable hold time.

Quick clicks behave normally. Moving the mouse cancels a hold. Presses with Shift, Ctrl, Option or Cmd are left to Firefox.

On macOS, the context menu opens as soon as the right button goes down, so it can be blocked on links to make a right-button hold work. Shift+right-click still opens it.

### Drag link

Drag a link up, down, left or right, past a customizable drag distance, to run that direction's action.

The action can run either when the link is released or as soon as the drag passes the distance.

When a drag starts on an image inside a link, each direction can run its action or leave the drag to Firefox. Leaving it to Firefox is the default, so images can still be dragged to the desktop or other apps.

A link released within 12 pixels of where it was pressed is treated as a click, since a mouse often moves a little while clicking.

### Actions

- **Open Link in New Tab**, Background or Foreground. The tab opens the way Ctrl/Cmd+Click does: right after the current tab and the tabs already opened from it.
- **New Tab at End**, Background or Foreground.
- **Open Link in New Window** and **Open Link in New Private Window**, Foreground or Background. Private windows need "Run in Private Windows" allowed for the extension.
- **Open in Current Tab (Forced)**, even for links that would open a new tab.
- **Close Current Tab**: hold anywhere on the page. Text fields and scrollbars are skipped.
- **Save Link**.
- **Copy Link**. When the press or drag starts on an image inside the link, it can copy the link, the image, or the image's address, or not run at all.
- **Send Web Service**, Background or Foreground. It opens your URL prefix with the link added to the end.

### Containers

New tabs and windows can stay in the page's container, open without a container, or open in a container you pick.

### Closing tabs

Choose which tab Firefox switches to after you close one:

- **Tree order** (default): tabs are grouped under the tab that opened them. Closing one goes to the next tab in its group, then the previous one, then the tab that opened it, repeating up the tree.
  - An option treats any tab you open yourself as a child of the current tab.
- **Next tab**: the tab on the right (below, with vertical tabs).
- **Previously active tab**: the tab you were on before.
- **Firefox default**.

### Excluded sites

Long-press and drag are turned off on pages whose address matches a rule. The address checked is the page you are on and it is checked without its `?query` or `#part`. Write one rule per line:

| Rule | Matches |
| --- | --- |
| `example.com` | the site and its subdomains |
| `example.com/docs` | that page and pages under it |
| `"example.com/docs"` | only that page |
| `example.com/*.pdf` | `*` matches anything |
| `https://example.com/page` | that address and pages under it |
| `re:(?i)^https?://(www\.)?example\.(com\|org)/` | a regular expression with its flags at the start |
| `/^https?:\/\/(www\.)?example\.(com\|org)\//i` | a regular expression with its flags after the last slash |
| `# note` | nothing; notes and blank lines are ignored |

The settings page shows which line matches an address you type, and marks rules it can't read. Rule changes apply to open pages without reloading.

### Settings

The settings are in the add-on's Preferences tab in about:addons, and can also open in a tab of their own.

#### Themes

- Match Firefox (Light or Dark)
- Match Firefox (Light or Darker)
- Light (based on Firefox Light)
- Dark (based on Firefox Dark)
- Darker (based on Firefox Developer Edition Dark)

Settings are kept in the extension's storage, so clearing history or site data doesn't reset them. Settings from earlier versions are carried over.

## Permissions

| Permission | Used for |
| --- | --- |
| `tabs` | opening, placing and closing tabs |
| `downloads` | Save Link |
| `clipboardWrite` | Copy Link |
| `cookies` | knowing which container a tab is in |
| `contextualIdentities` | listing your containers |
| `storage` | keeping your settings |
| `<all_urls>` | running on every page, and fetching an image for "Copy the image" when the page can't provide it |

## Building

```bash
npx web-ext@8 lint
npx web-ext@8 build --ignore-files "META-INF/**" --overwrite-dest
```

The zip is written to `web-ext-artifacts/`. `META-INF` holds the original release's signature. It isn't tracked and shouldn't ship.

To try the extension, open `about:debugging`, choose This Firefox, then Load Temporary Add-on, and pick `manifest.json`. You can also run `npx web-ext@8 run`.

## Credits

This project is based on [Long Press New Tab](https://addons.mozilla.org/firefox/addon/long_press_new_tab/) by **Kunihiro Ando**, released under the MIT License. The first import commit contains the original, unmodified source from the AMO release (version 3.2). Later commits contain this fork's changes.

This fork is not affiliated with or endorsed by the original author.

## License

MIT. See [LICENSE](LICENSE). The original author's copyright notice is kept as the license requires.
