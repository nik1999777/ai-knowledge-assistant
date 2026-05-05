const STOP_WORDS = new Set([
  "about",
  "also",
  "and",
  "are",
  "but",
  "for",
  "from",
  "how",
  "its",
  "that",
  "the",
  "this",
  "what",
  "with",
  "как",
  "какая",
  "какой",
  "какую",
  "когда",
  "кто",
  "ли",
  "мне",
  "можно",
  "на",
  "но",
  "о",
  "об",
  "по",
  "про",
  "с",
  "чем",
  "что",
  "это",
  "этой",
  "этот",
]);

export function tokenizeForSearch(value: string) {
  return [
    ...new Set(
      value
        .toLocaleLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3)
        .filter((token) => !STOP_WORDS.has(token)),
    ),
  ];
}
