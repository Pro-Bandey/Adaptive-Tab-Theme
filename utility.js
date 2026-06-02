"use strict";

const darkSchemeDetection = window.matchMedia("(prefers-color-scheme: dark)");

export function onSchemeChanged(listener) {
	darkSchemeDetection?.addEventListener("change", listener);
}

export function getSystemScheme() {
	return darkSchemeDetection?.matches ? "dark" : "light";
}

export async function getCurrentScheme() {
	try {
		const webAppearanceSetting = await browser.browserSettings?.overrideContentColorScheme?.get({});
		const webAppearance = webAppearanceSetting?.value;
		return webAppearance === "light" || webAppearance === "dark" ? webAppearance : getSystemScheme();
	} catch {
		return getSystemScheme();
	}
}

export function localise(webDocument) {
	webDocument.querySelectorAll("[data-text]").forEach((element) => {
		element.textContent = i18n(element.dataset.text);
	});
	webDocument.querySelectorAll("[data-title]").forEach((element) => {
		element.title = i18n(element.dataset.title);
	});
	webDocument.querySelectorAll("[data-placeholder]").forEach((element) => {
		element.placeholder = i18n(element.dataset.placeholder);
	});
}

export function i18n(handle) {
	const localisedMessage = browser.i18n.getMessage(handle);
	if (!localisedMessage) {
		return `i18n <${handle}>`;
	} else if (localisedMessage === "__EMPTY__") {
		return "";
	} else {
		return localisedMessage;
	}
}

let _supportsThemeAPI = null;

export function supportsThemeAPI() {
	if (_supportsThemeAPI === null) {
		_supportsThemeAPI =
			typeof browser.theme !== "undefined" &&
			typeof browser.theme.update === "function";
	}
	return _supportsThemeAPI;
}

export async function getAddonId(url) {
	const uuid = url.split(/\/|\?/)[2];
	const addonList = await browser.management.getAll();
	let addonId;
	for (const addon of addonList) {
		if (addon.type !== "extension" || !addon.hostPermissions) {
			continue;
		} else if (addonId) {
			break;
		} else {
			for (const host of addon.hostPermissions) {
				if (host.startsWith("moz-extension:") && uuid === host.split(/\/|\?/)[2]) {
					addonId = addon.id;
					break;
				}
			}
		}
	}
	return addonId;
}
