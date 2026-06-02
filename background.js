"use strict";

/*
 * System color scheme:
 * The color scheme of the operating system, usually light or dark.
 *
 * Browser color scheme:
 * The "website appearance" settings of Firefox, which can be light, dark, or auto.
 *
 * `cashe.scheme`:
 * Derived from system and browser color scheme and decides whether the light theme or dark theme is preferred.
 *
 * `pref.allowDarkLight`:
 * A setting that decides if a light theme is allowed to be used when current.scheme is dark, or vice versa.
 *
 * meta tag theme:
 * A color defined with a meta tag by some websites, usually static.
 * It is often more related to the branding than the actual appearance of the website.
 *
 * Theme:
 * An object that defines the color of the Firefox UI.
 */

import preference from "./preference.js";
import color from "./color.js";
import {
	aboutPagecolor,
	mozillaPagecolor
} from "./constants.js";
import {
	onSchemeChanged,
	getCurrentScheme,
	getSystemScheme,
	getAddonId,
} from "./utility.js";

const pref = new preference();

const colorCode = Object.freeze({
	HOME: {
		get light() {
			return new color(pref.homeBackground_light);
		},
		get dark() {
			return new color(pref.homeBackground_dark);
		},
	},
	FALLBACK: {
		get light() {
			return new color(pref.fallbackcolor_light);
		},
		get dark() {
			return new color(pref.fallbackcolor_dark);
		},
	},
	PLAINTEXT: {
		light: new color().rgba(255, 255, 255, 1),
		dark: new color().rgba(28, 27, 34, 1),
	},
	SYSTEM: {
		light: new color().rgba(255, 255, 255, 1),
		dark: new color().rgba(30, 30, 30, 1),
	},
	ADDON: {
		light: new color().rgba(236, 236, 236, 1),
		dark: new color().rgba(50, 50, 50, 1),
	},
	PDFVIEWER: {
		light: new color().rgba(249, 249, 250, 1),
		dark: new color().rgba(56, 56, 61, 1),
	},
	IMAGEVIEWER: { light: undefined, dark: new color().rgba(33, 33, 33, 1) },
	JSONVIEWER: {
		get light() {
			return getSystemScheme() === "light"
				? new color().rgba(249, 249, 250, 1)
				: undefined;
		},
		get dark() {
			return getSystemScheme() === "dark"
				? new color().rgba(12, 12, 13, 1)
				: undefined;
		},
	},
	DEFAULT: {
		light: new color().rgba(255, 255, 255, 1),
		dark: new color().rgba(28, 27, 34, 1),
	},
});

const cache = {
	meta: {},
	policy: {},
	scheme: "light",
	get reversedScheme() {
		return this.scheme === "light" ? "dark" : "light";
	},
	async clear() {
		this.scheme = await getCurrentScheme();
		this.meta = {};
		this.policy = {};
	},
};

async function update() {
	if (!pref.valid()) await initialise();
	await cache.clear();
	const activeTabs = await browser.tabs.query({
		active: true,
		status: "complete",
	});
	activeTabs.forEach(updateTab);
}

async function initialise() {
	await pref.load();
	await pref.normalise();
	await pref.save();
	await update();
}

async function handleMessage(message, sender) {
	const tab = sender.tab;
	const header = message.header;
	switch (header) {
		case "INIT_REQUEST":
			await initialise();
			break;
		case "PREF_CHANGED":
			await pref.load();
			await update();
			break;
		case "SCRIPT_READY":
			if (tab) updateTab(tab);
			break;
		case "UPDATE_color":
			if (!tab) break;
			const tabMeta = parseTabcolor(
				cache.policy[tab.windowId],
				message.color,
			);
			cache.meta[tab.windowId] = tabMeta;
			setFramecolor(tab, tabMeta.color);
			break;
		case "SCHEME_REQUEST":
			return await getCurrentScheme();
		case "META_REQUEST":
			return cache.meta[message.windowId];
		default:
			update();
	}
	return true;
}

async function updateTab(tab) {
	const windowId = tab.windowId;
	const policy = pref.getPolicy(tab.url).policy;
	cache.policy[windowId] = policy;
	const tabMeta = await getTabMeta(policy, tab);
	cache.meta[windowId] = tabMeta;
	setFramecolor(tab, tabMeta.color);
}

async function getTabMeta(policy, tab) {
	try {
		const tabcolor = await browser.tabs.sendMessage(tab.id, {
			header: "GET_color",
			dynamic: policy?.type === "color" ? false : pref.dynamic,
			query: policy?.type === "QUERY_SELECTOR" ? policy.value : undefined,
		});
		return parseTabcolor(policy, tabcolor);
	} catch (error) {
		console.warn("Failed to connect to", tab.url);
		if (policy?.headerType === "URL" && policy?.type === "color") {
			return {
				color: new color(policy.value),
				reason: "color_SPECIFIED",
			};
		} else return await getProtectedPageMeta(tab);
	}
}

function parseTabcolor(policy, { theme, page, query }) {
	const parseThemecolor = () => new color(theme[cache.scheme], false);
	const parsePagecolor = () => {
		let pagecolor = new color();
		for (const element of page) {
			const opacity = parseFloat(element.opacity);
			if (isNaN(opacity)) continue;
			pagecolor = pagecolor.mix(
				new color(element.color, false).opacity(opacity),
			);
			if (pagecolor.isOpaque()) break;
		}
		return pagecolor.isOpaque()
			? pagecolor
			: pagecolor.mix(colorCode.FALLBACK[cache.scheme]);
	};
	const parseQuerycolor = () => new color(query?.color);
	switch (policy?.type) {
		case "THEME_color": {
			const themecolor = parseThemecolor();
			if (policy.value && themecolor.isOpaque()) {
				return {
					color: themecolor,
					reason: "THEME_USED",
				};
			}
			return {
				color: parsePagecolor(),
				reason: policy.value
					? "THEME_MISSING"
					: themecolor.isOpaque()
						? "THEME_IGNORED"
						: "color_PICKED",
			};
		}
		case "QUERY_SELECTOR": {
			const querycolor = parseQuerycolor();
			return querycolor.isOpaque()
				? {
					color: querycolor,
					reason: "QS_USED",
					info: policy.value || "🕳️",
				}
				: {
					color: parsePagecolor(),
					reason: "QS_FAILED",
					info: policy.value || "🕳️",
				};
		}
		case "color": {
			return {
				color: new color(policy.value),
				reason: "color_SPECIFIED",
			};
		}
		default:
			return { color: parsePagecolor(), reason: "color_PICKED" };
	}
}

async function getProtectedPageMeta(tab) {
	if (!tab.url) {
		return {
			color: new color("FALLBACK"),
			reason: "FALLBACK_color",
		};
	}
	const url = new URL(tab.url);
	const tabTitle = tab.title || "";
	if (
		["about:firefoxview", "about:home", "about:newtab"].some((href) =>
			url.href.startsWith(href),
		)
	) {
		return { color: new color("HOME"), reason: "HOME_PAGE" };
	} else if (
		url.href === "about:blank" &&
		tabTitle.startsWith("about:") &&
		tabTitle.endsWith("profile")
	) {
		return getAboutPageMeta(tabTitle.slice(6));
	} else if (url.protocol === "about:") {
		return getAboutPageMeta(url.pathname);
	} else if (url.protocol === "moz-extension:") {
		return await getAddonPageMeta(url.href);
	} else if (url.hostname in mozillaPagecolor) {
		return getMozillaPageMeta(url.hostname);
	} else if (url.protocol === "view-source:") {
		return {
			color: new color("PLAINTEXT"),
			reason: "PROTECTED_PAGE",
		};
	} else if (["chrome:", "resource:", "jar:file:"].includes(url.protocol)) {
		if (
			[".txt", ".css", ".jsm", ".js"].some((extention) =>
				url.href.endsWith(extention),
			)
		) {
			return {
				color: new color("PLAINTEXT"),
				reason: "PROTECTED_PAGE",
			};
		} else if (
			[".png", ".jpg"].some((extention) => url.href.endsWith(extention))
		) {
			return {
				color: new color("IMAGEVIEWER"),
				reason: "PROTECTED_PAGE",
			};
		} else {
			return {
				color: new color("SYSTEM"),
				reason: "PROTECTED_PAGE",
			};
		}
	} else if (url.href.startsWith("data:image")) {
		return {
			color: new color("IMAGEVIEWER"),
			reason: "IMAGE_VIEWER",
		};
	} else if (url.href.endsWith(".pdf") || tabTitle.endsWith(".pdf")) {
		return {
			color: new color("PDFVIEWER"),
			reason: "PDF_VIEWER",
		};
	} else if (url.href.endsWith(".json") || tabTitle.endsWith(".json")) {
		return {
			color: new color("JSONVIEWER"),
			reason: "JSON_VIEWER",
		};
	} else if (tab.favIconUrl?.startsWith("chrome:")) {
		return {
			color: new color("DEFAULT"),
			reason: "PROTECTED_PAGE",
		};
	} else if (url.href.match(new RegExp(`https?:\\/\\/${tabTitle}$`, "i"))) {
		return {
			color: new color("PLAINTEXT"),
			reason: "TEXT_VIEWER",
		};
	} else {
		return {
			color: new color("FALLBACK"),
			reason: "FALLBACK_color",
		};
	}
}

function getAboutPageMeta(pathname) {
	if (aboutPagecolor[pathname]?.[cache.scheme]) {
		return {
			color: new color(aboutPagecolor[pathname][cache.scheme]),
			reason: "PROTECTED_PAGE",
		};
	} else if (aboutPagecolor[pathname]?.[cache.reversedScheme]) {
		return {
			color: new color(aboutPagecolor[pathname][cache.reversedScheme]),
			reason: "PROTECTED_PAGE",
		};
	} else {
		return {
			color: new color("DEFAULT"),
			reason: "PROTECTED_PAGE",
		};
	}
}

function getMozillaPageMeta(hostname) {
	if (mozillaPagecolor[hostname]?.[cache.scheme]) {
		return {
			color: new color(mozillaPagecolor[hostname][cache.scheme]),
			reason: "PROTECTED_PAGE",
		};
	} else if (mozillaPagecolor[hostname]?.[cache.reversedScheme]) {
		return {
			color: new color(
				mozillaPagecolor[hostname][cache.reversedScheme],
			),
			reason: "PROTECTED_PAGE",
		};
	} else {
		return {
			color: new color("FALLBACK"),
			reason: "PROTECTED_PAGE",
		};
	}
}

async function getAddonPageMeta(url) {
	const addonId = await getAddonId(url);
	if (!addonId) return { color: new color("ADDON"), reason: "ADDON" };
	const policy = pref.getPolicy(addonId).policy;
	return policy
		? {
			color: new color(policy.value),
			reason: "ADDON",
			info: addonId,
		}
		: {
			color: new color("ADDON"),
			reason: "ADDON",
			info: addonId,
		};
}

function setFramecolor(tab, color) {
	if (!tab?.active) return;
	const windowId = tab.windowId;
	let finalcolor, finalScheme;

	if (color.code) {
		if (colorCode[color.code][cache.scheme]) {
			finalcolor = colorCode[color.code][cache.scheme];
			finalScheme = cache.scheme;
		} else if (
			colorCode[color.code][cache.reversedScheme] &&
			pref.allowDarkLight
		) {
			finalcolor = colorCode[color.code][cache.reversedScheme];
			finalScheme = cache.reversedScheme;
		} else {
			const correctionResult = colorCode[color.code][
				cache.reversedScheme
			].contrastCorrection(
				cache.scheme,
				pref.compatibilityMode ? false : pref.allowDarkLight,
				pref.minContrast_light,
				pref.minContrast_dark,
			);
			finalcolor = correctionResult.color;
			finalScheme = correctionResult.scheme;
			cache.meta[windowId].corrected = correctionResult.corrected;
		}
	} else {
		const correctionResult = color.contrastCorrection(
			cache.scheme,
			pref.compatibilityMode ? false : pref.allowDarkLight,
			pref.minContrast_light,
			pref.minContrast_dark,
		);
		finalcolor = correctionResult.color;
		finalScheme = correctionResult.scheme;
		cache.meta[windowId].corrected = correctionResult.corrected;
	}

	if (pref.compatibilityMode) {
		setTabThemecolor(tab, finalcolor);
	} else {
		applyTheme(windowId, finalcolor, finalScheme);
	}
}

async function setTabThemecolor(tab, color) {
	try {
		await browser.tabs.sendMessage(tab.id, {
			header: "SET_THEME_color",
			color: color.brightness(pref.tabbar).toRGBA(),
		});
	} catch (error) {
		console.warn("Could not apply theme color to tab:", tab.url);
	}
}

function applyTheme(windowId, color, colorScheme) {
	if (colorScheme === "light") {
		const theme = {
			colors: {
				button_background_active: color.brightness(-1.5 * pref.tabSelected).toRGBA(),
				frame: color.brightness(-1.5 * pref.tabbar).toRGBA(),
				frame_inactive: color.brightness(-1.5 * pref.tabbar).toRGBA(),
				ntp_background: colorCode.HOME[cache.scheme].toRGBA(),
				popup: color.brightness(-1.5 * pref.popup).toRGBA(),
				popup_border: color.brightness(-1.5 * (pref.popup + pref.popupBorder)).toRGBA(),
				sidebar: color.brightness(-1.5 * pref.sidebar).toRGBA(),
				sidebar_border: color.brightness(-1.5 * (pref.sidebar + pref.sidebarBorder)).toRGBA(),
				tab_line: color.brightness( -1.5 * (pref.tabSelectedBorder + pref.tabSelected),).toRGBA(),
				tab_selected: color.brightness(-1.5 * pref.tabSelected).toRGBA(),
				toolbar: color.brightness(-1.5 * pref.toolbar).toRGBA(),
				toolbar_bottom_separator: pref.toolbarBorder === 0 ? "transparent" : color.brightness( -1.5 * (pref.toolbarBorder + pref.toolbar), ).toRGBA(),
				toolbar_field: color.brightness(-1.5 * pref.toolbarField).toRGBA(),
				toolbar_field_border: color.brightness( -1.5 * (pref.toolbarFieldBorder + pref.toolbarField),).toRGBA(),
				toolbar_field_focus: color .brightness(-1.5 * pref.toolbarFieldOnFocus).toRGBA(),
				toolbar_top_separator: pref.tabbarBorder === 0 ? "transparent" : color.brightness(-1.5 * (pref.tabbarBorder + pref.tabbar),).toRGBA(),
				icons: "rgb(0, 0, 0)",
				ntp_text: "rgb(0, 0, 0)",
				popup_text: "rgb(0, 0, 0)",
				sidebar_text: "rgb(0, 0, 0)",
				tab_background_text: "rgb(0, 0, 0)",
				tab_text: "rgb(0, 0, 0)",
				toolbar_field_text: "rgb(0, 0, 0)",
				toolbar_text: "rgb(0, 0, 0)",
				button_background_hover: "rgba(0, 0, 0, 0.11)",
				toolbar_vertical_separator: "rgba(0, 0, 0, 0.11)",
				toolbar_field_border_focus: "AccentColor",
				popup_highlight: "AccentColor",
				sidebar_highlight: "AccentColor",
				icons_attention: "AccentColor",
			},
			properties: {
				color_scheme: "system",
				content_color_scheme: "system",
			},
		};
		browser.theme.update(windowId, theme);
	}
	if (colorScheme === "dark") {
		const theme = {
			colors: {
				button_background_active: color.brightness(pref.tabSelected).toRGBA(),
				frame: color.brightness(pref.tabbar).toRGBA(),
				frame_inactive: color.brightness(pref.tabbar).toRGBA(),
				ntp_background: colorCode.HOME[cache.scheme].toRGBA(),
				popup: color.brightness(pref.popup).toRGBA(),
				popup_border: color.brightness(pref.popup + pref.popupBorder).toRGBA(),
				sidebar: color.brightness(pref.sidebar).toRGBA(),
				sidebar_border: color.brightness(pref.sidebar + pref.sidebarBorder).toRGBA(),
				tab_line: color.brightness(pref.tabSelectedBorder + pref.tabSelected).toRGBA(),
				tab_selected: color.brightness(pref.tabSelected).toRGBA(),
				toolbar: color.brightness(pref.toolbar).toRGBA(),
				toolbar_bottom_separator: pref.toolbarBorder === 0 ? "transparent" : color.brightness(pref.toolbarBorder + pref.toolbar).toRGBA(),
				toolbar_field: color.brightness(pref.toolbarField).toRGBA(),
				toolbar_field_border: color.brightness(pref.toolbarFieldBorder + pref.toolbarField).toRGBA(),
				toolbar_field_focus: color.brightness(pref.toolbarFieldOnFocus).toRGBA(),
				toolbar_top_separator: pref.tabbarBorder === 0 ? "transparent" : color .brightness(pref.tabbarBorder + pref.tabbar) .toRGBA(),
				icons: "rgb(255, 255, 255)",
				ntp_text: "rgb(255, 255, 255)",
				popup_text: "rgb(255, 255, 255)",
				sidebar_text: "rgb(255, 255, 255)",
				tab_background_text: "rgb(255, 255, 255)",
				tab_text: "rgb(255, 255, 255)",
				toolbar_field_text: "rgb(255, 255, 255)",
				toolbar_text: "rgb(255, 255, 255)",
				button_background_hover: "rgba(255, 255, 255, 0.11)",
				toolbar_vertical_separator: "rgba(255, 255, 255, 0.11)",
				toolbar_field_border_focus: "AccentColor",
				popup_highlight: "AccentColor",
				sidebar_highlight: "AccentColor",
				icons_attention: "AccentColor",
			},
			properties: {
				color_scheme: "system",
				content_color_scheme: "system",
			},
		};
		browser.theme.update(windowId, theme);
	}
}

(async () => {
	await initialise();
	onSchemeChanged(update);
	browser.tabs.onUpdated.addListener(update, { properties: ["status"] });
	browser.tabs.onActivated.addListener(update);
	browser.tabs.onAttached.addListener(update);
	browser.windows.onFocusChanged.addListener(update);
	browser.browserSettings?.overrideContentColorScheme?.onChange?.addListener( update,);
	browser.runtime.onMessage.addListener(handleMessage);
})();
