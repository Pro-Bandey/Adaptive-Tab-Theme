"use strict";

import color from "./color.js";

export function setupCheckbox(checkbox, onChange) {
	checkbox.onclick = () => {
		onChange(checkbox.dataset.pref, checkbox.checked);
	};
}

export function setCheckboxValue(checkbox, value) {
	checkbox.checked = value;
}

export function setupSlider(slider, onChange) {
	const minusButton = slider.querySelector("button:nth-of-type(1)");
	const plusButton = slider.querySelector("button:nth-of-type(2)");
	minusButton.addEventListener("mousedown", () => {
		if (+slider.dataset.value <= +slider.dataset.min) return;
		const value = +slider.dataset.value - +slider.dataset.step;
		setSliderValue(slider, value);
		onChange(slider.dataset.pref, value);
	});
	plusButton.addEventListener("mousedown", () => {
		if (+slider.dataset.value >= +slider.dataset.max) return;
		const value = +slider.dataset.value + +slider.dataset.step;
		setSliderValue(slider, value);
		onChange(slider.dataset.pref, value);
	});
}

export function setSliderValue(slider, value) {
	const sliderBody = slider.querySelector(".slider-body");
	const percentage = (value - +slider.dataset.min) / (+slider.dataset.max - +slider.dataset.min);
	const scale = slider.dataset.scale;
	slider.dataset.value = value;
	sliderBody.textContent = scale && value !== 0 ? `${value.toString().slice(0, -scale)}.${value.toString().slice(-scale)}` : value;
	sliderBody.style.setProperty( "--slider-position", `${100 * (1 - percentage)}%`, );
}

export function setupPolicyHeaderInput(
	policyHeaderInputWrapper,
	initialValue,
	onChange,
) {
	const policyHeaderInput = policyHeaderInputWrapper.querySelector(".policy-header-input",);
	policyHeaderInput.value = initialValue;
	policyHeaderInput.addEventListener("focus", () => policyHeaderInput.select(), );
	policyHeaderInput.addEventListener("input", () => onChange(policyHeaderInput.value.trim()), );
	policyHeaderInput.addEventListener("keydown", (event) => {
		if (event.key === "Enter") policyHeaderInput.blur();
	});
}

export function setPolicyHeaderInputValue(policyHeaderInputWrapper, value) {
	const policyHeaderInput = policyHeaderInputWrapper.querySelector( ".policy-header-input",);
	policyHeaderInput.value = value;
}

export function getPolicyHeaderInputValue(policyHeaderInputWrapper) {
	const policyHeaderInput = policyHeaderInputWrapper.querySelector( ".policy-header-input", );
	return policyHeaderInput.value;
}

export function setupcolorInput(colorInputWrapper, initialcolor, onChange) {
	const colorInput = colorInputWrapper.querySelector(".color-input");
	const colorPicker = colorInputWrapper.querySelector( ".color-picker-display", );
	const colorPickerInput = colorInputWrapper.querySelector( "input[type='color']", );
	colorInput.value = initialcolor;
	colorPicker.style.backgroundColor = initialcolor;
	colorPickerInput.value = initialcolor;
	colorInput.addEventListener("focus", () => colorInput.select());
	colorInput.addEventListener("blur", () => {
		const hex = new color(colorInput.value, false).toHex();
		colorInput.value = hex;
		colorPicker.style.backgroundColor = hex;
		colorPickerInput.value = hex;
		onChange(hex);
	});
	colorInput.addEventListener("keydown", (event) => {
		if (event.key === "Enter") colorInput.blur();
	});
	colorInput.addEventListener("input", () => {
		const hex = new color(colorInput.value, false).toHex();
		colorPicker.style.backgroundColor = hex;
		colorPickerInput.value = hex;
		onChange(hex);
	});
	colorPickerInput.addEventListener("input", () => {
		const color = colorPickerInput.value;
		colorPicker.style.backgroundColor = color;
		colorInput.value = color;
		onChange(color);
	});
}

export function setcolorInputValue(colorInputWrapper, value) {
	const colorInput = colorInputWrapper.querySelector(".color-input");
	const colorPicker = colorInputWrapper.querySelector( "input[type='color']", );
	const colorPickerDisplay = colorInputWrapper.querySelector( ".color-picker-display", );
	colorInput.value = value;
	colorPicker.value = value;
	colorPickerDisplay.style.backgroundColor = value;
}

export function getcolorInputValue(colorInputWrapper) {
	const colorPicker = colorInputWrapper.querySelector( "input[type='color']", );
	return colorPicker.value;
}

export function setupThemecolorSwitch(
	themecolorSwitchWrapper,
	initialSelection,
	onChange,
) {
	const useThemecolorRadioButton = themecolorSwitchWrapper.querySelector( "input[type='radio']:nth-of-type(1)", );
	const ignoreThemecolorRadioButton = themecolorSwitchWrapper.querySelector( "input[type='radio']:nth-of-type(2)", );
	if (initialSelection === false) ignoreThemecolorRadioButton.checked = true;
	useThemecolorRadioButton.addEventListener("change", () => {
		if (useThemecolorRadioButton.checked) onChange(true);
	});
	ignoreThemecolorRadioButton.addEventListener("change", () => {
		if (ignoreThemecolorRadioButton.checked) onChange(false);
	});
}

export function setThemecolorSwitchValue(themecolorSwitchWrapper, value) {
	const useThemecolorRadioButton = themecolorSwitchWrapper.querySelector( "input[type='radio']:nth-of-type(1)", );
	const ignoreThemecolorRadioButton = themecolorSwitchWrapper.querySelector( "input[type='radio']:nth-of-type(2)", );
	useThemecolorRadioButton.checked = value;
	ignoreThemecolorRadioButton.checked = !value;
}

export function getThemecolorSwitchValue(themecolorSwitchWrapper) {
	const useThemecolorRadioButton = themecolorSwitchWrapper.querySelector( "input[type='radio']:nth-of-type(1)", );
	return useThemecolorRadioButton.checked;
}

export function setupQuerySelectorInput(
	QuerySelectorInputWrapper,
	initialQuerySelector,
	onChange,
) {
	const QuerySelectorInput =
		QuerySelectorInputWrapper.querySelector("input[type='text']");
	QuerySelectorInput.value = initialQuerySelector;
	QuerySelectorInput.addEventListener("focus", () => QuerySelectorInput.select(), );
	QuerySelectorInput.addEventListener("input", () => onChange(QuerySelectorInput.value.trim()), );
	QuerySelectorInput.addEventListener("keydown", (event) => {
		if (event.key === "Enter") QuerySelectorInput.blur();
	});
}

export function setQuerySelectorInputValue(QuerySelectorInputWrapper, value) {
	const QuerySelectorInput = QuerySelectorInputWrapper.querySelector("input[type='text']");
	QuerySelectorInput.value = value;
}

export function getQuerySelectorInputValue(QuerySelectorInputWrapper) {
	const QuerySelectorInput = QuerySelectorInputWrapper.querySelector("input[type='text']");
	return QuerySelectorInput.value;
}

export function setcolorPolicySectionId(policySection, id) {
	policySection.dataset.id = id;
	policySection.querySelector(".color-picker-display").htmlFor = `color-picker-display-${id}`;
	policySection.querySelector("input[type='color']").id = `color-picker-display-${id}`;
}

export function setFlexiblePolicySectionId(policySection, id) {
	policySection.dataset.id = id;
	policySection.querySelector(".color-picker-display").htmlFor = `color-picker-display-${id}`;
	policySection.querySelector("input[type='color']").id = `color-picker-display-${id}`;
	policySection.querySelector("input.toggle-switch:nth-of-type(1)").name = `theme-color-${id}`;
	policySection.querySelector("input.toggle-switch:nth-of-type(1)").id = `use-theme-color-${id}`;
	policySection.querySelector("label.toggle-switch:nth-of-type(1)").htmlFor = `use-theme-color-${id}`;
	policySection.querySelector("input.toggle-switch:nth-of-type(2)").name = `theme-color-${id}`;
	policySection.querySelector("input.toggle-switch:nth-of-type(2)").id = `ignore-theme-color-${id}`;
	policySection.querySelector("label.toggle-switch:nth-of-type(2)").htmlFor = `ignore-theme-color-${id}`;
}
