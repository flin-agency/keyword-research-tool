const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getLanguageMetadata } = require('../utils/language');

let genAI = null;

function resolveLanguageOptions(languageInput) {
  if (!languageInput) {
    return { code: 'en', label: null };
  }

  if (typeof languageInput === 'string') {
    return { code: languageInput.trim().toLowerCase() || 'en', label: null };
  }

  if (typeof languageInput === 'object') {
    const code = (languageInput.code || languageInput.language || 'en').toString().trim().toLowerCase();
    const label = languageInput.label || languageInput.name || null;
    return { code, label };
  }

  return { code: 'en', label: null };
}

function buildLanguageContext(languageInput) {
  const { code, label } = resolveLanguageOptions(languageInput);
  const metadata = getLanguageMetadata(code);
  const trimmedLabel = typeof label === 'string' ? label.trim() : '';
  const primary = trimmedLabel || metadata.nativeName || metadata.englishName || 'English';
  const englishName = metadata.englishName || primary || 'English';
  const displayName = englishName && englishName !== primary ? `${primary} (${englishName})` : primary;

  return {
    code: code || 'en',
    primary,
    englishName,
    displayName,
  };
}

/**
 * Initialize Gemini AI
 */
function initializeGemini() {
  if (genAI) return genAI;

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('Gemini API key not configured - AI clustering disabled');
    return null;
  }

  genAI = new GoogleGenerativeAI(apiKey);
  return genAI;
}

/**
 * Use Gemini to extract marketing-relevant keywords from scraped content
 * Thinks like a marketing person to identify business-relevant terms
 */
async function extractKeywordsWithAI(scrapedContent, maxKeywords = 150, languageCode = null) {
  try {
    const ai = initializeGemini();
    if (!ai) return null; // Will fall back to traditional extraction

    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const { displayName: targetLanguage, primary: primaryLanguage } = buildLanguageContext(languageCode);

    // Prepare content summary for Gemini
    const contentSummary = scrapedContent.pages.slice(0, 5).map(page => ({
      title: page.title,
      metaDescription: page.metaDescription,
      h1: page.headings.h1.slice(0, 5),
      h2: page.headings.h2.slice(0, 10),
      h3: page.headings.h3.slice(0, 10),
      firstParagraphs: page.paragraphs.slice(0, 5)
    }));

    const prompt = `You are a marketing strategist and SEO expert analyzing a website to identify valuable keywords.

Website Content Summary:
${JSON.stringify(contentSummary, null, 2)}

Your Task:
Analyze this website content from a MARKETING PERSPECTIVE and extract ${maxKeywords} highly relevant keywords that:
1. Represent the core business, products, and services
2. Are what potential customers would search for
3. Focus on SHORT keywords (1-3 words preferred)
4. Avoid generic web terms (click, page, here, more, learn, etc.)
5. Include industry-specific terms and product names
6. Focus on commercial intent keywords
7. Include both broad and specific terms
8. IMPORTANT: Extract keywords in ${primaryLanguage} language

Think like a marketing person would think:
- What is this business selling?
- What problems do they solve?
- What would customers search for to find them?
- What are the key differentiators?

Output ONLY a JSON array of keyword strings in ${targetLanguage}, ordered by marketing relevance (most important first):
["keyword1", "keyword2", "keyword3", ...]

Maximum ${maxKeywords} keywords. Focus on QUALITY over quantity.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Extract JSON array from response
    const jsonMatch = response.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      const keywords = JSON.parse(jsonMatch[0]);
      console.log(`✨ Gemini extracted ${keywords.length} marketing-focused keywords`);
      return keywords.slice(0, maxKeywords);
    }

    return null;
  } catch (error) {
    console.warn('Gemini keyword extraction failed:', error.message);
    return null; // Will fall back to traditional extraction
  }
}

/**
 * Use Gemini to improve cluster naming and grouping
 */
async function enhanceClusterWithAI(cluster, websiteContext, languageCode = 'en') {
  try {
    const ai = initializeGemini();
    if (!ai) return cluster; // Return unchanged if no API key

    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const { displayName: languageName, primary: primaryLanguage } = buildLanguageContext(languageCode);

    const prompt = `You are an SEO and content marketing expert analyzing keyword clusters for a website. Your response must be in ${languageName}.

Website Context: ${websiteContext.url}
Website Description: ${websiteContext.description || 'Not provided'}

Current Cluster:
- Pillar Topic: ${cluster.pillarTopic}
- Keywords: ${cluster.keywords.slice(0, 20).map((k) => k.keyword).join(', ')}
- Total Keywords: ${cluster.keywords.length}
- Total Search Volume: ${cluster.totalSearchVolume}
- Competition: ${cluster.avgCompetition}

Task: Analyze this keyword cluster and provide the following in ${primaryLanguage}:
1. A better, more descriptive pillar topic name (3-5 words max)
2. A brief description of what this cluster represents (1 sentence)
3. A content strategy recommendation (1-2 sentences)

Respond in JSON format only, with keys in English:
{
  "pillarTopic": "improved topic name in ${primaryLanguage}",
  "description": "what this cluster represents in ${primaryLanguage}",
  "contentStrategy": "recommendation for content in ${primaryLanguage}"
}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    console.log(`[Gemini] Raw response for pillar "${cluster.pillarTopic}" in ${languageName}:`, response);

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const aiSuggestions = JSON.parse(jsonMatch[0]);
      console.log(`[Gemini] Parsed AI suggestions for pillar "${cluster.pillarTopic}" in ${languageName}:`, aiSuggestions);
      const enhancedCluster = {
        ...cluster,
        pillarTopic: aiSuggestions.pillarTopic || cluster.pillarTopic,
        aiDescription: aiSuggestions.description,
        aiContentStrategy: aiSuggestions.contentStrategy,
        aiEnhanced: true,
      };
      
      console.log(`[Gemini] ✓ Enhanced cluster "${enhancedCluster.pillarTopic}" with:`, {
        hasDescription: !!enhancedCluster.aiDescription,
        hasStrategy: !!enhancedCluster.aiContentStrategy
      });
      
      return enhancedCluster;
    }

    console.log(`[Gemini] ✗ No JSON match found for "${cluster.pillarTopic}"`);
    return cluster;
  } catch (error) {
    console.warn('Gemini enhancement failed:', error.message);
    return cluster; // Return unchanged on error
  }
}

/**
 * Use Gemini to analyze all clusters and suggest regrouping
 */
async function analyzeAndRegroupClusters(clusters, websiteContext, allKeywords, languageCode = 'en') {
  try {
    const ai = initializeGemini();
    if (!ai) return clusters; // Return unchanged if no API key

    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const { displayName: languageName, primary: primaryLanguage } = buildLanguageContext(languageCode);

    // Create a summary of all clusters
    const clustersSummary = clusters
      .map(
        (c, i) =>
          `${i + 1}. ${c.pillarTopic} (${c.keywords.length} keywords, ${c.totalSearchVolume} vol)`
      )
      .join('\n');

    const prompt = `You are an SEO strategist analyzing keyword clusters for a website. Your response must be in ${languageName}.

Website: ${websiteContext.url}
Total Keywords: ${allKeywords.length}

Current Clusters:
${clustersSummary}

Sample keywords from each cluster:
${clusters
  .map(
    (c, i) =>
      `Cluster ${i + 1}: ${c.keywords.slice(0, 5).map((k) => k.keyword).join(', ')}...`
  )
  .join('\n')}

Task: Analyze these clusters and provide the following in ${primaryLanguage}:
1. Identify if any clusters should be merged (too similar themes)
2. Identify if any clusters should be split (mixed themes)
3. Suggest better topic names for each cluster
4. Recommend which clusters are highest priority for content creation

Respond in JSON format only, with keys in English:
{
  "mergeSuggestions": [{"clusters": [1, 2], "reason": "why merge in ${primaryLanguage}"}],
  "splitSuggestions": [{"cluster": 3, "reason": "why split in ${primaryLanguage}"}],
  "priorityClusters": [1, 5, 7],
  "improvedNames": {"1": "new name for cluster 1 in ${primaryLanguage}", "2": "new name for cluster 2 in ${primaryLanguage}"}
}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);

      // Apply improved names
      const enhancedClusters = clusters.map((cluster, index) => {
        const newName = analysis.improvedNames?.[index + 1];
        const isPriority = analysis.priorityClusters?.includes(index + 1);

        return {
          ...cluster,
          pillarTopic: newName || cluster.pillarTopic,
          aiPriority: isPriority,
          aiEnhanced: true,
        };
      });

      return enhancedClusters;
    }

    return clusters;
  } catch (error) {
    console.warn('Gemini cluster analysis failed:', error.message);
    return clusters; // Return unchanged on error
  }
}

/**
 * Get AI-powered content brief for a cluster
 */
async function generateContentBrief(cluster, websiteContext, languageCode = 'en') {
  try {
    const ai = initializeGemini();
    if (!ai) return null;

    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const { displayName: languageName, primary: primaryLanguage } = buildLanguageContext(languageCode);

    const topKeywords = cluster.keywords.slice(0, 15).map((k) => ({
      keyword: k.keyword,
      volume: k.searchVolume,
      competition: k.competition,
    }));

    const prompt = `You are a content strategist creating a content brief in ${languageName}.

Website: ${websiteContext.url}
Topic Cluster: ${cluster.pillarTopic}
Description: ${cluster.aiDescription || 'Not available'}

Top Keywords:
${topKeywords.map((k) => `- ${k.keyword} (${k.volume} searches, ${k.competition} comp)`).join('\n')}

Create a detailed content brief in ${primaryLanguage} including:
1. Recommended article title (SEO-optimized)
2. Target word count
3. Article outline (H2/H3 headings)
4. Keywords to target
5. Internal linking opportunities
6. Call-to-action suggestions

Format as markdown.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.warn('Content brief generation failed:', error.message);
    return null;
  }
}

module.exports = {
  initializeGemini,
  extractKeywordsWithAI,
  enhanceClusterWithAI,
  analyzeAndRegroupClusters,
  generateContentBrief,
};
