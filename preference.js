"use strict";

import {
	addonVersion,
	default_homeBackground_light,
	default_homeBackground_dark,
	default_fallbackcolor_light,
	default_fallbackcolor_dark,
	default_compatibilityMode,
	defaultPreference,
} from "./constants.js";
import color from "./color.js";
import { supportsThemeAPI } from "./utility.js";

export default class preference {
	#content = {
		tabbar: 0,
		tabbarBorder: 0,
		tabSelected: 10,
		tabSelectedBorder: 0,
		toolbar: 0,
		toolbarBorder: 0,
		toolbarField: 5,
		toolbarFieldBorder: 5,
		toolbarFieldOnFocus: 5,
		sidebar: 5,
		sidebarBorder: 5,
		popup: 5,
		popupBorder: 5,
		minContrast_light: 90,
		minContrast_dark: 45,
		allowDarkLight: true,
		dynamic: true,
		noThemecolor: true,
		compatibilityMode: default_compatibilityMode,
		homeBackground_light: default_homeBackground_light,
		homeBackground_dark: default_homeBackground_dark,
		fallbackcolor_light: default_fallbackcolor_light,
		fallbackcolor_dark: default_fallbackcolor_dark,
		siteList: {},
		version: addonVersion,
	};
	async load() {
		this.#content = await browser.storage.local.get();
	}
	async save() {
		await browser.storage.local.set(this.#content);
	}
	valid() {
		if (Object.keys(this.#content).length !== Object.keys(defaultPreference).length)
			return false;
		for (const key in defaultPreference) {
			if (typeof this.#content[key] !== typeof defaultPreference[key])
				return false;
		}
		return true;
	}
	reset(key = undefined) {
		if (key in defaultPreference) {
			this.#content[key] = defaultPreference[key];
		} else {
			this.#content = {};
			for (const key in defaultPreference) {
				this.#content[key] = defaultPreference[key];
			}
		}
	}
	async normalise() {
		if (!this.#content.version || this.#isOlderThan([2, 0]) || JSON.stringify(this.#content.version) === "[2,2,1]") {
			this.reset();
			await this.save();
			return;
		}
		const oldContent = Object.assign({}, this.#content);
		this.#content = {};
		for (const key in defaultPreference) {
			this.#content[key] = typeof oldContent[key] === typeof defaultPreference[key] ? oldContent[key] : defaultPreference[key];
		}
		if (this.#isOlderThan([2, 2])) {
			this.#content.allowDarkLight = true;
			this.#content.dynamic = true;
			this.#content.noThemecolor = true;
			// Re-formatting site list
			const newSiteList = {};
			let id = 1;
			for (const site in this.#content.siteList) {
				const legacyPolicy = this.#content.siteList[site];
				if (typeof legacyPolicy !== "string") {
					continue;
				} else if (legacyPolicy === "IGNORE_THEME") {
					newSiteList[id++] = {
						headerType: "URL",
						header: site,
						type: "THEME_color",
						value: false,
					};
				} else if (legacyPolicy === "UN_IGNORE_THEME") {
					newSiteList[id++] = {
						headerType: "URL",
						header: site,
						type: "THEME_color",
						value: true,
					};
				} else if (legacyPolicy.startsWith("QS_")) {
					newSiteList[id++] = {
						headerType: "URL",
						header: site,
						type: "QUERY_SELECTOR",
						value: legacyPolicy.replace("QS_", ""),
					};
				} else if (site.startsWith("Add-on ID: ")) {
					newSiteList[id++] = {
						headerType: "ADDON_ID",
						header: site.replace("Add-on ID: ", ""),
						type: "color",
						value: new color(legacyPolicy).toHex(),
					};
				} else {
					newSiteList[id++] = {
						headerType: "URL",
						header: site,
						type: "color",
						value: new color(legacyPolicy).toHex(),
					};
				}
			}
			this.#content.siteList = newSiteList;
		}
		if (this.#isOlderThan([2, 4])) {
			browser.theme.reset();
			if (this.#content.minContrast_light === 165)
				this.#content.minContrast_light = 90;
		}
		[
			"tabbar",
			"tabbarBorder",
			"tabSelected",
			"tabSelectedBorder",
			"toolbar",
			"toolbarBorder",
			"toolbarField",
			"toolbarFieldBorder",
			"toolbarFieldOnFocus",
			"sidebar",
			"sidebarBorder",
			"popup",
			"popupBorder",
		].forEach((key) => {
			this.#content[key] = this.#validateNumericPref(this.#content[key], {
				min: -50,
				max: 50,
				step: 5,
			});
		});
		["minContrast_light", "minContrast_dark"].forEach((key) => {
			this.#content[key] = this.#validateNumericPref(this.#content[key], {
				min: 0,
				max: 210,
				step: 15,
			});
		});
		if (!supportsThemeAPI()) {
			this.#content.compatibilityMode = true;
		}
		this.#content.version = addonVersion;
	}
	#isOlderThan(version) {
		const currentVersion = this.#content.version || [];
		for (let i = 0; i < Math.max(currentVersion.length, version.length); i++) {
			if ((currentVersion[i] || 0) !== (version[i] || 0))
				return (currentVersion[i] || 0) < (version[i] || 0);
		}
		return false;
	}
	prefToJSON() {
		return JSON.stringify(this.#content);
	}
	async JSONToPref(JSONString) {
		try {
			const parsedJSON = JSON.parse(JSONString);
			if (typeof parsedJSON !== "object" || parsedJSON === null)
				return false;
			this.#content = parsedJSON;
			await this.normalise();
			return true;
		} catch (error) {
			return false;
		}
	}
	addPolicy(policy) {
		let id = 1;
		while (id in this.#content.siteList) id++;
		this.#content.siteList[id] = policy;
		return id;
	}
	setPolicy(id, policy) {
		this.#content.siteList[id] = policy;
	}
	removePolicy(id) {
		this.#content.siteList[id] = null;
	}
	getPolicy(input) {
		let matchedId = 0;
		let matchedPolicy;
		if (typeof input !== "string")
			return { id: matchedId, policy: matchedPolicy };
		for (const id in this.#content.siteList) {
			const policy = this.#content.siteList[id];
			if (!policy || typeof policy.header !== "string") continue;
			const normalisedInput = input.replace(/\/$/, "");
			const normalisedHeader = policy.header.replace(/\/$/, "");
			const isMatch =
				(policy.headerType === "ADDON_ID" && policy.header === input) ||
				(policy.headerType === "URL" &&
					(normalisedInput === normalisedHeader ||
						this.#testRegex(normalisedInput, normalisedHeader) ||
						this.#testWildcard(normalisedInput, normalisedHeader) ||
						this.#testHostname(normalisedInput, normalisedHeader)));
			if (isMatch) {
				matchedId = +id;
				matchedPolicy = policy;
			}
		}
		return { id: matchedId, policy: matchedPolicy };
	}
	#testRegex(url, regex) {
		try {
			return new RegExp(`^${regex}$`, "i").test(url);
		} catch (error) {
			return false;
		}
	}
	#testWildcard(url, wildcard) {
		if (wildcard.includes("*") || wildcard.includes("?")) {
			try {
				const wildcardPattern = wildcard.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "::WILDCARD_MATCH_ALL::").replace(/\*/g, "[^/.:]*").replace(/\?/g, ".").replace(/::WILDCARD_MATCH_ALL::/g, ".*").replace(/^([a-z]+:\/\/)/i, "$1").replace(/^((?![a-z]+:\/\/).)/i, "(?:[a-z]+:\\/\\/)?$1");
				return new RegExp(`^${wildcardPattern}/?$`, "i").test(url);
			} catch (error) {
				return false;
			}
		} else {
			return false;
		}
	}
	#testHostname(url, hostname) {
		try {
			const { hostname: urlHost, pathname } = new URL(url);
			const hostPart = hostname.split("/")[0];
			if (urlHost !== hostPart && !urlHost.endsWith(`.${hostPart}`))
				return false;
			const urlPath = hostPart + pathname;
			return urlPath === hostname || urlPath.startsWith(`${hostname}/`);
		} catch (error) {
			return false;
		}
	}

	#validateNumericPref(num, { min, max, step }) {
		if (-1 < num && num < 1) num = Math.round(num * 100);
		num = Math.max(min, Math.min(max, num));
		const remainder = (num - min) % step;
		if (remainder !== 0)
			num =
				remainder >= step / 2
					? num + (step - remainder)
					: num - remainder;
		return Math.round(num);
	}
	get allowDarkLight() {
		return this.#content.allowDarkLight;
	}

	set allowDarkLight(value) {
		this.#content.allowDarkLight = value;
	}

	get dynamic() {
		return this.#content.dynamic;
	}

	set dynamic(value) {
		this.#content.dynamic = value;
	}

	get noThemecolor() {
		return this.#content.noThemecolor;
	}

	set noThemecolor(value) {
		this.#content.noThemecolor = value;
	}

	get compatibilityMode() {
		return this.#content.compatibilityMode;
	}

	set compatibilityMode(value) {
		this.#content.compatibilityMode = value;
	}

	get tabbar() {
		return this.#content.tabbar;
	}

	set tabbar(value) {
		this.#content.tabbar = value;
	}

	get tabbarBorder() {
		return this.#content.tabbarBorder;
	}

	set tabbarBorder(value) {
		this.#content.tabbarBorder = value;
	}

	get tabSelected() {
		return this.#content.tabSelected;
	}

	set tabSelected(value) {
		this.#content.tabSelected = value;
	}

	get tabSelectedBorder() {
		return this.#content.tabSelectedBorder;
	}

	set tabSelectedBorder(value) {
		this.#content.tabSelectedBorder = value;
	}

	get toolbar() {
		return this.#content.toolbar;
	}

	set toolbar(value) {
		this.#content.toolbar = value;
	}

	get toolbarBorder() {
		return this.#content.toolbarBorder;
	}

	set toolbarBorder(value) {
		this.#content.toolbarBorder = value;
	}

	get toolbarField() {
		return this.#content.toolbarField;
	}

	set toolbarField(value) {
		this.#content.toolbarField = value;
	}

	get toolbarFieldBorder() {
		return this.#content.toolbarFieldBorder;
	}

	set toolbarFieldBorder(value) {
		this.#content.toolbarFieldBorder = value;
	}

	get toolbarFieldOnFocus() {
		return this.#content.toolbarFieldOnFocus;
	}

	set toolbarFieldOnFocus(value) {
		this.#content.toolbarFieldOnFocus = value;
	}

	get sidebar() {
		return this.#content.sidebar;
	}

	set sidebar(value) {
		this.#content.sidebar = value;
	}

	get sidebarBorder() {
		return this.#content.sidebarBorder;
	}

	set sidebarBorder(value) {
		this.#content.sidebarBorder = value;
	}

	get popup() {
		return this.#content.popup;
	}

	set popup(value) {
		this.#content.popup = value;
	}

	get popupBorder() {
		return this.#content.popupBorder;
	}

	set popupBorder(value) {
		this.#content.popupBorder = value;
	}

	get minContrast_light() {
		return this.#content.minContrast_light;
	}

	set minContrast_light(value) {
		this.#content.minContrast_light = value;
	}

	get minContrast_dark() {
		return this.#content.minContrast_dark;
	}

	set minContrast_dark(value) {
		this.#content.minContrast_dark = value;
	}

	get homeBackground_light() {
		return this.#content.homeBackground_light;
	}

	set homeBackground_light(value) {
		this.#content.homeBackground_light = value;
	}

	get homeBackground_dark() {
		return this.#content.homeBackground_dark;
	}

	set homeBackground_dark(value) {
		this.#content.homeBackground_dark = value;
	}

	get fallbackcolor_light() {
		return this.#content.fallbackcolor_light;
	}

	set fallbackcolor_light(value) {
		this.#content.fallbackcolor_light = value;
	}

	get fallbackcolor_dark() {
		return this.#content.fallbackcolor_dark;
	}

	set fallbackcolor_dark(value) {
		this.#content.fallbackcolor_dark = value;
	}

	get siteList() {
		return this.#content.siteList;
	}

	set siteList(value) {
		this.#content.siteList = value;
	}

	get version() {
		return this.#content.version;
	}

	set version(value) {
		this.#content.version = value;
	}
}
