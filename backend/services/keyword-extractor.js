const natural = require('natural');
const { removeStopwords } = require('stopword');
const compromise = require('compromise');
const gemini = require('./gemini');

const TfIdf = natural.TfIdf;
const tokenizer = new natural.WordTokenizer();

/**
 * Extract keywords from scraped content
 * Uses Gemini AI for marketing-focused extraction, falls back to NLP if unavailable
 */
async function extractKeywords(scrapedContent, languageCode = null) {
  // Try Gemini AI extraction first (marketing-focused)
  console.log(`Attempting AI-powered keyword extraction${languageCode ? ` in ${languageCode}` : ''}...`);
  const aiKeywords = await gemini.extractKeywordsWithAI(scrapedContent, 150, languageCode);

  if (aiKeywords && aiKeywords.length > 0) {
    console.log(`✅ Using ${aiKeywords.length} AI-extracted keywords`);
    return aiKeywords;
  }

  // Fallback to traditional NLP extraction
  console.log('Falling back to traditional NLP extraction...');
  return extractKeywordsTraditional(scrapedContent);
}

/**
 * Traditional NLP-based keyword extraction (fallback)
 * Focus on business-relevant, shorter keywords
 */
function extractKeywordsTraditional(scrapedContent) {
  const allTexts = [];
  const keywords = new Map();

  // Prioritize important content sections (weighted)
  const prioritySections = [];
  const normalSections = [];

  scrapedContent.pages.forEach((page) => {
    // High priority: titles, H1s, meta descriptions
    prioritySections.push(
      page.title,
      page.metaDescription,
      ...page.headings.h1
    );

    // Medium priority: H2s, H3s
    normalSections.push(
      ...page.headings.h2,
      ...page.headings.h3,
      ...page.links.slice(0, 20) // Limit links
    );

    // Lower priority: first few paragraphs only
    normalSections.push(...page.paragraphs.slice(0, 10));
  });

  allTexts.push(...prioritySections.filter((t) => t && t.trim().length > 0));
  allTexts.push(...normalSections.filter((t) => t && t.trim().length > 0));

  // Extract single keywords (focus on shorter, business terms)
  const singleKeywords = extractSingleKeywords(allTexts, true);
  singleKeywords.forEach((kw) => keywords.set(kw.keyword, kw));

  // Extract phrases (focus on 2-3 word phrases, not 4)
  const phrases = extractPhrases(allTexts, true);
  phrases.forEach((kw) => keywords.set(kw.keyword, kw));

  // Calculate TF-IDF scores
  const tfidf = new TfIdf();
  allTexts.forEach((text) => tfidf.addDocument(text));

  // Update relevance scores with TF-IDF
  keywords.forEach((kw) => {
    let maxTfidf = 0;
    tfidf.tfidfs(kw.keyword, (i, measure) => {
      if (measure > maxTfidf) maxTfidf = measure;
    });
    kw.tfidfScore = maxTfidf;
    kw.relevanceScore = calculateRelevanceScore(kw);
  });

  // Filter and prioritize business-relevant keywords
  const filteredKeywords = Array.from(keywords.values())
    .filter((kw) => {
      // Remove very generic/common words
      const genericWords = ['click', 'page', 'here', 'more', 'learn', 'read', 'view', 'see'];
      if (genericWords.includes(kw.keyword.toLowerCase())) return false;

      // Prioritize shorter keywords (1-3 words preferred)
      if (kw.wordCount > 3) return kw.frequency >= 3; // Require higher frequency for longer phrases

      return true;
    })
    .sort((a, b) => {
      // Boost shorter keywords
      const lengthPenalty = (a.wordCount - 1) * 0.1;
      const lengthBonus = (3 - b.wordCount) * 0.1;
      return (b.relevanceScore + lengthBonus) - (a.relevanceScore - lengthPenalty);
    })
    .slice(0, 150); // Reduced from 200 to focus on quality

  return filteredKeywords.map((kw) => kw.keyword);
}

/**
 * Extract single keywords (nouns, verbs, adjectives)
 * Focus on business-relevant terms
 */
function extractSingleKeywords(texts, businessFocus = false) {
  const wordFrequency = new Map();

  texts.forEach((text) => {
    if (!text) return;

    // Tokenize and clean
    const words = tokenizer.tokenize(text.toLowerCase());
    const cleanWords = removeStopwords(words);

    // Use compromise for POS tagging
    const doc = compromise(text);
    const nouns = doc.nouns().out('array');
    const verbs = doc.verbs().out('array');
    const adjectives = doc.adjectives().out('array');

    const importantWords = [
      ...nouns.map((w) => w.toLowerCase()),
      ...verbs.map((w) => w.toLowerCase()),
      ...adjectives.map((w) => w.toLowerCase()),
    ];

    importantWords.forEach((word) => {
      if (word.length >= 3) {
        // Only words with 3+ characters
        wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
      }
    });
  });

  return Array.from(wordFrequency.entries())
    .filter(([word, freq]) => freq >= 2) // Appear at least twice
    .map(([word, freq]) => ({
      keyword: word,
      frequency: freq,
      wordCount: 1,
    }));
}

/**
 * Extract multi-word phrases
 * Focus on shorter, business-relevant phrases
 */
function extractPhrases(texts, businessFocus = false) {
  const phraseFrequency = new Map();

  texts.forEach((text) => {
    if (!text) return;

    // Extract 2-3 word phrases (reduced from 2-4)
    const words = tokenizer.tokenize(text.toLowerCase());

    const maxLength = businessFocus ? 3 : 4;
    for (let n = 2; n <= maxLength; n++) {
      for (let i = 0; i <= words.length - n; i++) {
        const phrase = words.slice(i, i + n).join(' ');

        // Filter out phrases with too many stop words
        const phraseWords = phrase.split(' ');
        const withoutStops = removeStopwords(phraseWords);

        if (withoutStops.length >= Math.ceil(n / 2)) {
          // At least half should be content words
          phraseFrequency.set(phrase, (phraseFrequency.get(phrase) || 0) + 1);
        }
      }
    }
  });

  return Array.from(phraseFrequency.entries())
    .filter(([phrase, freq]) => freq >= 2) // Appear at least twice
    .map(([phrase, freq]) => ({
      keyword: phrase,
      frequency: freq,
      wordCount: phrase.split(' ').length,
    }));
}

/**
 * Calculate relevance score
 */
function calculateRelevanceScore(keyword) {
  const { frequency, wordCount, tfidfScore = 0 } = keyword;

  // Weight factors
  const frequencyWeight = 0.3;
  const tfidfWeight = 0.5;
  const lengthWeight = 0.2;

  // Normalize scores
  const normalizedFrequency = Math.log(frequency + 1) / 10;
  const normalizedTfidf = tfidfScore;
  const lengthBonus = wordCount > 1 ? 1.2 : 1.0; // Bonus for phrases

  return (
    (frequencyWeight * normalizedFrequency + tfidfWeight * normalizedTfidf) *
    lengthBonus +
    lengthWeight
  );
}

module.exports = {
  extractKeywords,
  extractSingleKeywords,
  extractPhrases,
  calculateRelevanceScore,
};
