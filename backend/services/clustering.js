const natural = require('natural');
const { kmeans } = require('ml-kmeans');
const gemini = require('./gemini');

const TfIdf = natural.TfIdf;
const tokenizer = new natural.WordTokenizer();

/**
 * Cluster keywords into topic groups (with optional Gemini enhancement)
 */
async function clusterKeywords(keywordData, websiteContext = {}) {
  if (keywordData.length < 5) {
    // Too few keywords, return single cluster
    return [
      {
        id: 1,
        pillarTopic: keywordData[0].keyword,
        keywords: keywordData,
        totalSearchVolume: keywordData.reduce((sum, k) => sum + k.searchVolume, 0),
        avgCompetition: calculateAvgCompetition(keywordData),
        clusterValueScore: calculateClusterValue(keywordData),
      },
    ];
  }

  // Calculate optimal number of clusters (5-15)
  const numClusters = Math.min(15, Math.max(5, Math.floor(keywordData.length / 20)));

  // Vectorize keywords
  const vectors = vectorizeKeywords(keywordData);

  // Perform k-means clustering
  const result = kmeans(vectors, numClusters, {
    initialization: 'kmeans++',
    maxIterations: 100,
  });

  // Group keywords by cluster
  const clusters = [];
  for (let i = 0; i < numClusters; i++) {
    const clusterKeywords = keywordData.filter((_, idx) => result.clusters[idx] === i);

    if (clusterKeywords.length === 0) continue;

    // Sort by search volume to find pillar topic
    const sorted = [...clusterKeywords].sort((a, b) => b.searchVolume - a.searchVolume);
    const pillarTopic = sorted[0].keyword;

    clusters.push({
      id: i + 1,
      pillarTopic,
      keywords: clusterKeywords.sort((a, b) => b.searchVolume - a.searchVolume),
      totalSearchVolume: clusterKeywords.reduce((sum, k) => sum + k.searchVolume, 0),
      avgCompetition: calculateAvgCompetition(clusterKeywords),
      clusterValueScore: calculateClusterValue(clusterKeywords),
    });
  }

  // Sort clusters prioritizing high search volume topics
  let sortedClusters = clusters.sort((a, b) => {
    // Primary: Total search volume (weighted heavily)
    const volumeDiff = b.totalSearchVolume - a.totalSearchVolume;

    // Secondary: Cluster value score
    const scoreDiff = b.clusterValueScore - a.clusterValueScore;

    // Prioritize volume with 70% weight, score with 30% weight
    return (volumeDiff * 0.7) + (scoreDiff * 0.3);
  });

  // Enhance with Gemini AI if API key available
  try {
    if (process.env.GEMINI_API_KEY) {
      console.log('[Clustering] Enhancing clusters with Gemini AI...');

      // Analyze and regroup clusters
      sortedClusters = await gemini.analyzeAndRegroupClusters(
        sortedClusters,
        websiteContext,
        keywordData
      );

      // Enhance top 5 clusters with detailed AI analysis
      for (let i = 0; i < Math.min(5, sortedClusters.length); i++) {
        sortedClusters[i] = await gemini.enhanceClusterWithAI(
          sortedClusters[i],
          websiteContext
        );
      }

      console.log('[Clustering] Gemini enhancement complete');
    }
  } catch (error) {
    console.warn('[Clustering] Gemini enhancement failed:', error.message);
    // Continue with non-enhanced clusters
  }

  return sortedClusters;
}

/**
 * Vectorize keywords using TF-IDF
 */
function vectorizeKeywords(keywordData) {
  const tfidf = new TfIdf();

  // Add all keywords as documents
  keywordData.forEach((kw) => {
    tfidf.addDocument(kw.keyword);
  });

  // Get all unique terms
  const allTerms = new Set();
  keywordData.forEach((_, docIndex) => {
    tfidf.listTerms(docIndex).forEach((item) => {
      allTerms.add(item.term);
    });
  });

  const termList = Array.from(allTerms);

  // Create vectors
  const vectors = keywordData.map((_, docIndex) => {
    const vector = new Array(termList.length).fill(0);

    tfidf.listTerms(docIndex).forEach((item) => {
      const termIndex = termList.indexOf(item.term);
      if (termIndex !== -1) {
        vector[termIndex] = item.tfidf;
      }
    });

    return vector;
  });

  return vectors;
}

/**
 * Calculate average competition level
 */
function calculateAvgCompetition(keywords) {
  const competitionValues = {
    low: 1,
    medium: 2,
    high: 3,
    unknown: 2,
  };

  const avgValue =
    keywords.reduce((sum, k) => sum + competitionValues[k.competition], 0) / keywords.length;

  if (avgValue < 1.5) return 'low';
  if (avgValue < 2.5) return 'medium';
  return 'high';
}

/**
 * Calculate cluster value score (0-100)
 * Higher score = better opportunity (prioritizes high volume heavily)
 */
function calculateClusterValue(keywords) {
  const totalVolume = keywords.reduce((sum, k) => sum + k.searchVolume, 0);
  const avgVolume = totalVolume / keywords.length;

  const competitionValues = {
    low: 3,
    medium: 2,
    high: 1,
    unknown: 2,
  };

  const avgCompetitionValue =
    keywords.reduce((sum, k) => sum + competitionValues[k.competition], 0) / keywords.length;

  // Heavily prioritize search volume (60% weight)
  const volumeScore = Math.min(60, Math.log(avgVolume + 1) * 15);

  // Competition score (25% weight)
  const competitionScore = avgCompetitionValue * 12.5;

  // Size bonus - more keywords = more comprehensive (15% weight)
  const sizeBonus = Math.min(15, keywords.length * 1.5);

  return Math.min(100, volumeScore + competitionScore + sizeBonus);
}

/**
 * Calculate semantic similarity between two keywords
 */
function calculateSimilarity(keyword1, keyword2) {
  const tokens1 = new Set(tokenizer.tokenize(keyword1.toLowerCase()));
  const tokens2 = new Set(tokenizer.tokenize(keyword2.toLowerCase()));

  const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

module.exports = {
  clusterKeywords,
  vectorizeKeywords,
  calculateAvgCompetition,
  calculateClusterValue,
  calculateSimilarity,
};
