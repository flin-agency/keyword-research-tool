/**
 * Lightweight text processing utilities that replace the "natural" package.
 * The goal is to provide the minimal functionality needed by the clustering
 * service (tokenization, basic stemming, and TF-IDF scoring) without pulling
 * in large external dependencies that may not be available in restricted
 * environments.
 */

const WORD_REGEX = /[\p{L}\p{N}]+/gu;

/**
 * Tokenize text into lower-cased alphanumeric words.
 * @param {string} text
 * @returns {string[]}
 */
function tokenizeText(text) {
  if (!text) {
    return [];
  }

  return (text.match(WORD_REGEX) || [])
    .map(token => token.toLowerCase());
}

/**
 * Basic rule-based stemmer that handles the most common English suffixes. It is
 * intentionally simple but works well enough for grouping similar keywords.
 * @param {string} word
 * @returns {string}
 */
function stemWord(word) {
  if (!word) {
    return '';
  }

  let stem = word.toLowerCase();

  const suffixRules = [
    [/ies$/, 'y'],
    [/(sses|shes|ches|xes|zes)$/, match => match.slice(0, -2)],
    [/([aeiouy].*)ing$/, '$1'],
    [/([aeiouy].*)ed$/, '$1'],
    [/([b-df-hj-np-tv-z])\1$/, '$1'],
    [/s$/, ''],
  ];

  for (const [pattern, replacement] of suffixRules) {
    if (pattern.test(stem)) {
      stem = stem.replace(pattern, replacement);
    }
  }

  return stem;
}

/**
 * Minimal TF-IDF implementation inspired by the API used in the "natural"
 * package. Only the methods required by clustering-improved.js are provided.
 */
class SimpleTfIdf {
  constructor() {
    this.documents = [];
    this.termDocumentCounts = new Map();
  }

  addDocument(text) {
    const tokens = tokenizeText(text);
    const counts = new Map();

    tokens.forEach(token => {
      counts.set(token, (counts.get(token) || 0) + 1);
    });

    this.documents.push({ counts, length: tokens.length });

    const uniqueTokens = new Set(tokens);
    uniqueTokens.forEach(token => {
      this.termDocumentCounts.set(token, (this.termDocumentCounts.get(token) || 0) + 1);
    });
  }

  listTerms(docIndex) {
    const doc = this.documents[docIndex];
    if (!doc) {
      return [];
    }

    const totalDocs = this.documents.length;
    const terms = [];

    doc.counts.forEach((termCount, term) => {
      const tf = doc.length > 0 ? termCount / doc.length : 0;
      const idf = Math.log((totalDocs + 1) / ((this.termDocumentCounts.get(term) || 0) + 1)) + 1;
      terms.push({ term, tfidf: tf * idf });
    });

    terms.sort((a, b) => b.tfidf - a.tfidf);
    return terms;
  }
}

module.exports = {
  SimpleTfIdf,
  tokenizeText,
  stemWord,
};

