import { extractErrorMessage } from 'wellcrafted/error';
import { tryAsync } from 'wellcrafted/result';
import { type TextService, TextServiceErr } from './types';

export function createTextServiceExtension(): TextService {
	return {
		readFromClipboard: () =>
			tryAsync({
				try: async () => {
					const text = await navigator.clipboard.readText();
					return text || null;
				},
				catch: (error) =>
					TextServiceErr({
						message: `无法从剪贴板读取:${extractErrorMessage(error)}`,
					}),
			}),

		copyToClipboard: (text) =>
			tryAsync({
				try: () => navigator.clipboard.writeText(text),
				catch: (error) =>
					TextServiceErr({
						message: `无法复制到剪贴板:${extractErrorMessage(error)}`,
					}),
			}),

		writeToCursor: (text) =>
			tryAsync({
				try: async () => {
					// Copy to clipboard and insert at cursor
					await navigator.clipboard.writeText(text);
					return writeTextToCursor(text);
				},
				catch: (error) =>
					TextServiceErr({
						message: `无法在光标位置写入文本:${extractErrorMessage(error)}`,
					}),
			}),

		simulateEnterKeystroke: async () =>
			TextServiceErr({
				message:
					'出于安全原因,浏览器扩展不支持模拟按键。',
			}),
	};
}

/**
 * Insert the provided text at the cursor position in the currently active input element or append it
 * to the non-input active element.
 *
 * @param text - The text to be inserted.
 */
function writeTextToCursor(text: string): void {
	const activeElement = document.activeElement;
	if (!isHTMLElement(activeElement)) return;

	if (isInputOrTextareaElement(activeElement)) {
		insertTextInInputElement(activeElement, text);
	} else if (activeElement.isContentEditable) {
		appendTextToContentEditableElement(activeElement, text);
	}
}

function isHTMLElement(element: unknown): element is HTMLElement {
	return element instanceof HTMLElement;
}

function isInputOrTextareaElement(
	element: HTMLElement,
): element is HTMLInputElement | HTMLTextAreaElement {
	return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA';
}

/**
 * Handle the insertion of text for input and textarea elements.
 *
 * @param inputElement - The input element.
 * @param text - The text to be inserted.
 */
function insertTextInInputElement(
	inputElement: HTMLInputElement | HTMLTextAreaElement,
	text: string,
): void {
	const startPos = inputElement.selectionStart ?? 0;
	const endPos = inputElement.selectionEnd ?? 0;

	inputElement.focus();
	inputElement.setSelectionRange(startPos, endPos);

	// Use document.execCommand to insert the text, so it gets added to the undo stack
	document.execCommand('insertText', false, text);

	inputElement.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Handle the appending of text for non-input and non-textarea elements.
 *
 * @param element - The non-input element.
 * @param text - The text to be appended.
 */
function appendTextToContentEditableElement(
	element: HTMLElement,
	text: string,
): void {
	element.innerHTML += text;
}
