/** Not in the middle of a longer number such as "1,00,000" or "64990.50". */
const START = String.raw`(?<!\d|\d[,.])`;
const END = String.raw`(?!\d|[,.]\d)`;

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
/** 13 to 19 digits, optionally in groups split by a space or dash. */
const CARD = new RegExp(`${START}\\d(?:[ -]?\\d){12,18}${END}`, "g");
/** +91 98765 43210, 9876543210, 98765-43210, 987-654-3210. */
const PHONE = new RegExp(
  `${START}(?:\\+\\d{1,3}[ -]?)?(?:\\d{10}|\\d{5}[ -]\\d{5}|\\d{3}[ -]\\d{3}[ -]\\d{4})${END}`,
  "g",
);

/**
 * Mask personal data before a message is sent to the model or written to a
 * log: email addresses, card numbers and phone numbers.
 *
 * Prices are left alone ("under 100000 with 512 GB" is not a phone number):
 * a phone is ten digits in a row or in groups, and a card is 13 to 19 digits.
 */
export function maskSensitive(text: string): string {
  return text.replace(EMAIL, "[email]").replace(CARD, "[card]").replace(PHONE, "[phone]");
}
