const QUERY_BOILERPLATE_WORDS = new Set([
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
  "какие",
  "какой",
  "какую",
  "когда",
  "кто",
  "документ",
  "документе",
  "документа",
  "есть",
  "информация",
  "ли",
  "мне",
  "можно",
  "на",
  "но",
  "о",
  "об",
  "по",
  "про",
  "раздел",
  "разделе",
  "раздела",
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
        .filter((token) => !QUERY_BOILERPLATE_WORDS.has(token)),
    ),
  ];
}
