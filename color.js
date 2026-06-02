"use strict";

const colorCodes = [
	"HOME",
	"FALLBACK",
	"PLAINTEXT",
	"SYSTEM",
	"ADDON",
	"PDFVIEWER",
	"IMAGEVIEWER",
	"JSONVIEWER",
	"DEFAULT",
];

export default class color {
	#r = 0;
	#g = 0;
	#b = 0;
	#a = 0;
	#code = undefined;

	constructor(initialiser = undefined, acceptCode = true) {
		if (acceptCode && colorCodes.includes(initialiser)) {
			this.#code = initialiser;
		} else if (typeof initialiser === "string") {
			const canvas = document.createElement("canvas");
			canvas.width = 1;
			canvas.height = 1;
			const canvasContext = canvas.getContext("2d");
			canvasContext.fillStyle = initialiser;
			const parsedcolor = canvasContext.fillStyle;
			canvas.remove();
			if (parsedcolor.startsWith("#")) {
				this.rgba( parseInt(parsedcolor.slice(1, 3), 16), parseInt(parsedcolor.slice(3, 5), 16), parseInt(parsedcolor.slice(5, 7), 16), 1, );
			} else {
				this.rgba(...parsedcolor.match(/[.?\d]+/g).map(Number));
			}
		} else if (initialiser instanceof color) {
			if (initialiser.code) this.#code = initialiser.code;
			else
				this.rgba( initialiser.r, initialiser.g, initialiser.b, initialiser.a, );
		}
	}
	rgba(r, g, b, a) {
		this.#code = undefined;
		this.r = r;
		this.g = g;
		this.b = b;
		this.a = a;
		return this;
	}
	opacity(opacity) {
		this.#noCode();
		this.#a *= Math.max(0, Math.min(1, opacity));
		return this;
	}
	brightness(percentage) {
		this.#noCode();
		const cent = percentage / 100;
		if (1 < cent) {
			return new this.constructor().rgba(255, 255, 255, this.#a);
		} else if (0 < cent && cent <= 1) {
			return new this.constructor().rgba( cent * 255 + (1 - cent) * this.#r, cent * 255 + (1 - cent) * this.#g, cent * 255 + (1 - cent) * this.#b, this.#a, );
		} else if (cent === 0) {
			return this;
		} else if (-1 <= cent && cent < 0) {
			return new this.constructor().rgba( (cent + 1) * this.#r, (cent + 1) * this.#g, (cent + 1) * this.#b, this.#a, );
		} else if (cent < -1) {
			return new this.constructor().rgba(0, 0, 0, this.#a);
		}
	}
	mix(color) {
		this.#noCode();
		const a = this.#a + color.a * (1 - this.#a);
		return a === 0 ? new this.constructor() : new this.constructor().rgba( (this.#a * this.#r + color.a * (1 - this.#a) * color.r) / a, (this.#a * this.#g + color.a * (1 - this.#a) * color.g) / a, (this.#a * this.#b + color.a * (1 - this.#a) * color.b) / a, a, );
	}
	contrastCorrection( preferredScheme, allowDarkLight, minContrastLightX10, minContrastDarkX10, contrastcolorLight = new this.constructor().rgba(0, 0, 0, 1), contrastcolorDark = new this.constructor().rgba(255, 255, 255, 1), )
	{
		this.#noCode();
		const contrastRatioLight = this.#contrastRatio(contrastcolorLight);
		const contrastRatioDark = this.#contrastRatio(contrastcolorDark);
		const eligibilityLight = contrastRatioLight > minContrastLightX10 / 10;
		const eligibilityDark = contrastRatioDark > minContrastDarkX10 / 10;
		if ( eligibilityLight && (preferredScheme === "light" || (preferredScheme === "dark" && allowDarkLight)) )
			{
				return { color: this, scheme: "light", corrected: false };
			} else if ( eligibilityDark && (preferredScheme === "dark" || (preferredScheme === "light" && allowDarkLight)) )
				{
			return { color: this, scheme: "dark", corrected: false };
		} else if (preferredScheme === "light") {
			const dim = (100 * ((minContrastLightX10 / (10 * contrastRatioLight) - 1) * (this.#luminanceX255() + 12.75))) / (255 - this.#luminanceX255());
			return {
				color: this.brightness(dim),
				scheme: "light",
				corrected: true,
			};
		} else if (preferredScheme === "dark") {
			const dim = (100 * (10 * contrastRatioDark)) / minContrastDarkX10 - 100;
			return {
				color: this.brightness(dim),
				scheme: "dark",
				corrected: true,
			};
		} else {
			throw new Error("Cannot process color correction");
		}
	}
	#contrastRatio(color) {
		const luminance1X255 = this.#luminanceX255();
		const luminance2X255 = color.#luminanceX255();
		return luminance1X255 > luminance2X255 ? (luminance1X255 + 12.75) / (luminance2X255 + 12.75) : (luminance2X255 + 12.75) / (luminance1X255 + 12.75);
	}
	#luminanceX255() {
		return ( 0.2126 * this.#channelLuminance(this.#r) + 0.7152 * this.#channelLuminance(this.#g) + 0.0722 * this.#channelLuminance(this.#b) );
	}
	#channelLuminance(value) {
		if (value < 0) {
			return 0;
		} else if (value < 32) {
			return 0.1151 * value;
		} else if (value < 64) {
			return 0.2935 * value - 5.7074;
		} else if (value < 96) {
			return 0.5236 * value - 20.4339;
		} else if (value < 128) {
			return 0.788 * value - 45.8232;
		} else if (value < 160) {
			return 1.0811 * value - 83.3411;
		} else if (value < 192) {
			return 1.3992 * value - 134.2269;
		} else if (value < 224) {
			return 1.7395 * value - 199.5679;
		} else if (value < 256) {
			return 2.1001 * value - 280.341;
		} else {
			return 255;
		}
	}
	toString() {
		if (this.#code) return this.#code;
		else return this.toRGBA();
	}
	toRGB() {
		this.#noCode();
		return `rgb(${this.#r}, ${this.#g}, ${this.#b})`;
	}
	toRGBA() {
		this.#noCode();
		return `rgba(${this.#r}, ${this.#g}, ${this.#b}, ${this.#a})`;
	}
	toHex() {
		this.#noCode();
		const hexR = Math.round(this.#r).toString(16).padStart(2, "0");
		const hexG = Math.round(this.#g).toString(16).padStart(2, "0");
		const hexB = Math.round(this.#b).toString(16).padStart(2, "0");
		return `#${hexR}${hexG}${hexB}`;
	}
	toHexa() {
		this.#noCode();
		const hexR = Math.round(this.#r).toString(16).padStart(2, "0");
		const hexG = Math.round(this.#g).toString(16).padStart(2, "0");
		const hexB = Math.round(this.#b).toString(16).padStart(2, "0");
		const hexA = Math.round(255 * this.#a)
			.toString(16)
			.padStart(2, "0");
		return `#${hexR}${hexG}${hexB}${hexA}`;
	}
	isOpaque() {
		return this.#code || this.#a === 1;
	}
	#noCode() {
		if (this.#code)
			throw new Error("The color is defined by a color code");
	}
	get r() {
		this.#noCode();
		return this.#r;
	}
	set r(value) {
		this.#noCode();
		const num = Number(value);
		if (isNaN(num)) throw new Error("Invalid value for r");
		this.#r = Math.max(0, Math.min(255, num));
	}
	get g() {
		this.#noCode();
		return this.#g;
	}
	set g(value) {
		this.#noCode();
		const num = Number(value);
		if (isNaN(num)) throw new Error("Invalid value for g");
		this.#g = Math.max(0, Math.min(255, num));
	}
	get b() {
		this.#noCode();
		return this.#b;
	}
	set b(value) {
		this.#noCode();
		const num = Number(value);
		if (isNaN(num)) throw new Error("Invalid value for b");
		this.#b = Math.max(0, Math.min(255, num));
	}
	get a() {
		this.#noCode();
		return this.#a;
	}
	set a(value) {
		this.#noCode();
		const num = Number(value);
		if (isNaN(num)) throw new Error("Invalid value for a");
		this.#a = Math.max(0, Math.min(1, num));
	}
	get code() {
		return this.#code;
	}
	set code(value) {
		if (colorCodes.includes(value)) this.#code = value;
		else throw new Error("Invalid color code");
	}
}
