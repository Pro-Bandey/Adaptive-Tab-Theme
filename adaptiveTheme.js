let query = null;

browser.runtime.onMessage.addListener((message, _, sendResponse) => {
	switch (message.header) {
		case "GET_color":
			query = message.query;
			message.dynamic ? enableDynamic() : disableDynamic();
			sendResponse(getcolor());
			break;
		case "SET_THEME_color":
			setThemecolor(message.color);
			break;
		default:
			break;
	}
});

function getcolor() {
	return {
		theme: getThemecolor(),
		page: getPagecolor(),
		query: getQuerycolor(),
	};
}

function getThemecolor() {
	const metaThemecolor = document.querySelector(`meta[name="theme-color"]:not([media])`,);
	const metaThemecolorLight = document.querySelector(`meta[name="theme-color"][media="(prefers-color-scheme: light)"]`,) ?? metaThemecolor;
	const metaThemecolorDark = document.querySelector(`meta[name="theme-color"][media="(prefers-color-scheme: dark)"]`,) ?? metaThemecolor;
	return {
		light: metaThemecolorLight?.content,
		dark: metaThemecolorDark?.content,
	};
}

function getPagecolor() {
	return document.elementsFromPoint(window.innerWidth / 2, 3).filter((element) => element.offsetWidth >= window.innerWidth * 0.9 && element.offsetHeight >= 20, ).map((element) => getElementcolor(element)).concat( getElementcolor(document.body), getElementcolor(document.documentElement),).filter((color) => color !== undefined);
}

function getQuerycolor() {
	try {
		return query ? getElementcolor(document.querySelector(query)) : undefined;
	} catch (error) { 
		return undefined;
	}
}

function getElementcolor(element) {
	if (element instanceof Element) {
		const style = getComputedStyle(element);
		return {
			color: style.backgroundColor,
			opacity: style.opacity,
			filter: style.filter,
		};
	}
}

const darkReaderObserver = new MutationObserver(sendcolor);
const metaThemecolorObserver = new MutationObserver(sendcolor);
const metaTagObserver = new MutationObserver((mutationList) =>
	mutationList.forEach((mutation) => {
		mutation.addedNodes.forEach((node) => {
			if (node.nodeName === "META" && node.name === "theme-color") {
				sendcolor();
				metaThemecolorObserver.observe(node, {
					attributes: true,
				});
			}
		});
	}),
);
const styleTagObserver = new MutationObserver((mutationList) => {
	if (
		mutationList.some((mutation) => [...mutation.addedNodes, ...mutation.removedNodes].some( 
			(node) => node.nodeName === "STYLE",),
		)
	) {
		sendcolor();
	}
});

function enableDynamic() {
	["click", "resize", "scroll", "visibilitychange"].forEach((event) => document.addEventListener(event, sendcolor),
	);
	[
		"transitionend",
		"transitioncancel",
		"animationend",
		"animationcancel",
	].forEach((transitionEvent) => document.addEventListener(transitionEvent, sendcolorRequiresFocus),
	);
	darkReaderObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-darkreader-mode"],
	});
	document.querySelectorAll("meta[name=theme-color]").forEach((metaTag) =>
			metaThemecolorObserver.observe(metaTag, { attributes: true }),
		);
	if (document.head)
		metaTagObserver.observe(document.head, { childList: true });
	styleTagObserver.observe(document.documentElement, { childList: true });
	if (document.head)
		styleTagObserver.observe(document.head, { childList: true });
}

function disableDynamic() {
	["click", "resize", "scroll", "visibilitychange"].forEach((event) => document.removeEventListener(event, sendcolor),
	);
	[
		"transitionend",
		"transitioncancel",
		"animationend",
		"animationcancel",
	].forEach((transitionEvent) =>
		document.removeEventListener(transitionEvent, sendcolorRequiresFocus),
	);
	darkReaderObserver.disconnect();
	metaThemecolorObserver.disconnect();
	metaTagObserver.disconnect();
	styleTagObserver.disconnect();
}

function setThemecolor(color) {
	const metaThemecolorList = document.querySelectorAll(
		`meta[name="theme-color"]`,
	);
	const newMetaThemecolor = document.createElement("meta");
	newMetaThemecolor.name = "theme-color";
	newMetaThemecolor.content = color;
	(document.head || document.documentElement).appendChild(newMetaThemecolor);
	metaThemecolorList.forEach((metaThemecolor) => metaThemecolor.remove());
}

let dispatchTimeout;
let lastSentAt = 0;
const throttleIntervalMs = 250;

async function sendcolor() {
	clearTimeout(dispatchTimeout);
	const remaining = throttleIntervalMs + lastSentAt - Date.now();
	const dispatch = async () => {
		if (document.visibilityState !== "visible") return;
		lastSentAt = Date.now();
		try {
			await browser.runtime.sendMessage({
				header: "UPDATE_color",
				color: getcolor(),
			});
		} catch (error) {
			console.warn("Failed to send color to Adaptive Theme background.");
		}
	};
	remaining <= 0 ? await dispatch() : (dispatchTimeout = setTimeout(dispatch, remaining));
}

async function sendcolorRequiresFocus() {
	if (document.hasFocus()) await sendcolor();
}

(async function sendMessageOnLoad(attempt = 0) {
	try {
		await browser.runtime.sendMessage({ header: "SCRIPT_READY" });
	} catch {
		attempt >= 3 ? console.error("Could not connect to Adaptive Theme background.") : console.warn("Failed to connect to Adaptive Theme background.");
		if (attempt < 60) setTimeout(() => sendMessageOnLoad(++attempt), 1000);
	}
})();
