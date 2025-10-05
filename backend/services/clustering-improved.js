const natural = require('natural');
const { kmeans } = require('ml-kmeans');
const { DBSCAN } = require('density-clustering');
const gemini = require('./gemini');

const TfIdf = natural.TfIdf;
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

// Configuration
const MIN_CLUSTER_SIZE = 3;
const MAX_CLUSTERS = 20;
const MIN_CLUSTERS = 3;

/**
 * Enhanced clustering with multiple algorithms and semantic similarity
 */
async function clusterKeywords(keywordData, websiteContext = {}, options = {}) {
  const {
    algorithm = 'hybrid', // 'kmeans', 'dbscan', 'semantic', 'hybrid'
    minClusterSize = MIN_CLUSTER_SIZE,
    useAI = true,
  } = options;

  // Validate input
  if (!keywordData || keywordData.length === 0) {
    return [];
  }

  if (keywordData.length < minClusterSize) {
    // Too few keywords for clustering
    return [{
      id: 1,
      pillarTopic: keywordData[0]?.keyword || 'Main Topic',
      keywords: keywordData,
      totalSearchVolume: calculateTotalVolume(keywordData),
      avgCompetition: calculateAvgCompetition(keywordData),
      clusterValueScore: calculateClusterValue(keywordData),
      algorithm: 'single',
    }];
  }

  console.log(`[Clustering] Processing ${keywordData.length} keywords with ${algorithm} algorithm`);

  let clusters;

  try {
    switch (algorithm) {
      case 'kmeans':
        clusters = await clusterWithKMeans(keywordData);
        break;
      case 'dbscan':
        clusters = await clusterWithDBSCAN(keywordData);
        break;
      case 'semantic':
        clusters = await clusterWithSemantic(keywordData);
        break;
      case 'hybrid':
      default:
        clusters = await clusterWithHybrid(keywordData);
        break;
    }

    // Filter out small clusters
    clusters = clusters.filter(c => c.keywords.length >= minClusterSize);

    // If too few clusters, re-cluster with adjusted parameters
    if (clusters.length < MIN_CLUSTERS && keywordData.length > 20) {
      console.log('[Clustering] Too few clusters, adjusting parameters...');
      clusters = await clusterWithKMeans(keywordData, { forceNumClusters: MIN_CLUSTERS });
    }

    // Sort clusters by value score
    clusters = sortAndRankClusters(clusters);

    // Enhance with AI if available
    if (useAI && process.env.GEMINI_API_KEY) {
      try {
        console.log('[Clustering] Enhancing with Gemini AI...');

        // First, analyze and regroup
        clusters = await gemini.analyzeAndRegroupClusters(clusters, websiteContext, keywordData);

        // Then enhance top clusters with detailed analysis
        const topClustersToEnhance = Math.min(5, clusters.length);
        for (let i = 0; i < topClustersToEnhance; i++) {
          clusters[i] = await gemini.enhanceClusterWithAI(clusters[i], websiteContext);
        }

        console.log('[Clustering] AI enhancement complete');
      } catch (error) {
        console.warn('[Clustering] AI enhancement failed:', error.message);
      }
    }

    return clusters;

  } catch (error) {
    console.error('[Clustering] Error:', error);
    // Fallback to simple grouping
    return fallbackClustering(keywordData);
  }
}

/**
 * K-Means clustering with improved vectorization
 */
async function clusterWithKMeans(keywordData, options = {}) {
  const { forceNumClusters } = options;

  // Determine optimal number of clusters
  const numClusters = forceNumClusters || calculateOptimalClusters(keywordData.length);

  // Create enhanced vectors
  const vectors = createEnhancedVectors(keywordData);

  // Perform k-means
  const result = kmeans(vectors, numClusters, {
    initialization: 'kmeans++',
    maxIterations: 100,
    tolerance: 0.0001,
  });

  // Group keywords by cluster
  const clusterMap = new Map();

  keywordData.forEach((keyword, idx) => {
    const clusterId = result.clusters[idx];
    if (!clusterMap.has(clusterId)) {
      clusterMap.set(clusterId, []);
    }
    clusterMap.get(clusterId).push(keyword);
  });

  // Convert to cluster objects
  const clusters = [];
  let clusterId = 1;

  for (const [_, keywords] of clusterMap) {
    if (keywords.length > 0) {
      clusters.push(createClusterObject(clusterId++, keywords, 'kmeans'));
    }
  }

  return clusters;
}

/**
 * DBSCAN density-based clustering
 */
async function clusterWithDBSCAN(keywordData) {
  // Create similarity matrix
  const distanceMatrix = createDistanceMatrix(keywordData);

  // Parameters for DBSCAN
  const epsilon = 0.3; // Maximum distance between points in same cluster
  const minPoints = 2; // Minimum points to form a cluster

  const dbscan = new DBSCAN();
  const clusters = dbscan.run(distanceMatrix, epsilon, minPoints);

  // Convert to cluster objects
  const clusterObjects = [];
  let clusterId = 1;

  clusters.forEach(clusterIndices => {
    const keywords = clusterIndices.map(idx => keywordData[idx]);
    if (keywords.length > 0) {
      clusterObjects.push(createClusterObject(clusterId++, keywords, 'dbscan'));
    }
  });

  // Handle noise points (unclustered keywords)
  const clusteredIndices = new Set(clusters.flat());
  const noiseKeywords = keywordData.filter((_, idx) => !clusteredIndices.has(idx));

  if (noiseKeywords.length > 0) {
    // Try to assign noise points to nearest cluster or create new cluster
    const assignedNoise = assignNoisePoints(noiseKeywords, clusterObjects);
    if (assignedNoise.length > 0) {
      clusterObjects.push(createClusterObject(clusterId++, assignedNoise, 'dbscan-noise'));
    }
  }

  return clusterObjects;
}

/**
 * Semantic clustering based on meaning similarity
 */
async function clusterWithSemantic(keywordData) {
  const clusters = [];
  const used = new Set();
  let clusterId = 1;

  // Sort by search volume to prioritize high-volume keywords as cluster centers
  const sortedKeywords = [...keywordData].sort((a, b) => b.searchVolume - a.searchVolume);

  for (const centerKeyword of sortedKeywords) {
    if (used.has(centerKeyword.keyword)) continue;

    const cluster = [centerKeyword];
    used.add(centerKeyword.keyword);

    // Find semantically similar keywords
    for (const candidate of keywordData) {
      if (used.has(candidate.keyword)) continue;

      const similarity = calculateSemanticSimilarity(
        centerKeyword.keyword,
        candidate.keyword
      );

      if (similarity > 0.4) { // Threshold for semantic similarity
        cluster.push(candidate);
        used.add(candidate.keyword);
      }
    }

    if (cluster.length >= MIN_CLUSTER_SIZE) {
      clusters.push(createClusterObject(clusterId++, cluster, 'semantic'));
    } else {
      // Return unused keywords to pool
      cluster.forEach(k => used.delete(k.keyword));
    }
  }

  // Handle remaining keywords
  const remaining = keywordData.filter(k => !used.has(k.keyword));
  if (remaining.length >= MIN_CLUSTER_SIZE) {
    clusters.push(createClusterObject(clusterId++, remaining, 'semantic-misc'));
  } else if (remaining.length > 0 && clusters.length > 0) {
    // Add to most relevant existing cluster
    remaining.forEach(keyword => {
      const bestCluster = findBestClusterForKeyword(keyword, clusters);
      if (bestCluster) {
        bestCluster.keywords.push(keyword);
      }
    });
  }

  return clusters;
}

/**
 * Hybrid clustering combining multiple approaches
 */
async function clusterWithHybrid(keywordData) {
  // Step 1: Initial clustering with k-means
  let clusters = await clusterWithKMeans(keywordData);

  // Step 2: Refine with semantic similarity
  clusters = refineWithSemantics(clusters);

  // Step 3: Merge similar clusters
  clusters = mergeSimilarClusters(clusters);

  // Step 4: Split large mixed clusters
  clusters = splitMixedClusters(clusters);

  return clusters;
}

/**
 * Create enhanced vectors for clustering
 */
function createEnhancedVectors(keywordData) {
  const tfidf = new TfIdf();

  // Add documents with stemming
  keywordData.forEach(kw => {
    const stemmedWords = tokenizer.tokenize(kw.keyword.toLowerCase())
      .map(word => stemmer.stem(word))
      .join(' ');
    tfidf.addDocument(stemmedWords);
  });

  // Get all unique terms
  const allTerms = new Set();
  keywordData.forEach((_, docIndex) => {
    tfidf.listTerms(docIndex).forEach(item => {
      allTerms.add(item.term);
    });
  });

  const termList = Array.from(allTerms);

  // Create vectors with additional features
  const vectors = keywordData.map((keyword, docIndex) => {
    const vector = new Array(termList.length).fill(0);

    // TF-IDF features
    tfidf.listTerms(docIndex).forEach(item => {
      const termIndex = termList.indexOf(item.term);
      if (termIndex !== -1) {
        vector[termIndex] = item.tfidf;
      }
    });

    // Add normalized features
    const features = [
      Math.log(keyword.searchVolume + 1) / 10, // Log-normalized search volume
      keyword.competition === 'low' ? 1 : keyword.competition === 'medium' ? 0.5 : 0,
      keyword.keyword.split(' ').length / 5, // Normalized word count
      keyword.cpc ? Math.log(keyword.cpc + 1) / 5 : 0, // Log-normalized CPC
    ];

    return [...vector, ...features];
  });

  return vectors;
}

/**
 * Create distance matrix for DBSCAN
 */
function createDistanceMatrix(keywordData) {
  const n = keywordData.length;
  const matrix = [];

  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        row.push(0);
      } else {
        const distance = calculateDistance(keywordData[i], keywordData[j]);
        row.push(distance);
      }
    }
    matrix.push(row);
  }

  return matrix;
}

/**
 * Calculate distance between two keywords
 */
function calculateDistance(keyword1, keyword2) {
  const similarity = calculateSemanticSimilarity(keyword1.keyword, keyword2.keyword);

  // Consider search volume difference
  const volumeDiff = Math.abs(Math.log(keyword1.searchVolume + 1) - Math.log(keyword2.searchVolume + 1)) / 10;

  // Convert similarity to distance
  return (1 - similarity) + (volumeDiff * 0.2);
}

/**
 * Calculate semantic similarity between keywords
 */
function calculateSemanticSimilarity(text1, text2) {
  const tokens1 = new Set(tokenizer.tokenize(text1.toLowerCase()).map(t => stemmer.stem(t)));
  const tokens2 = new Set(tokenizer.tokenize(text2.toLowerCase()).map(t => stemmer.stem(t)));

  // Jaccard similarity
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  const jaccardSim = union.size > 0 ? intersection.size / union.size : 0;

  // Check for substring containment
  const lower1 = text1.toLowerCase();
  const lower2 = text2.toLowerCase();
  const substringBonus = (lower1.includes(lower2) || lower2.includes(lower1)) ? 0.3 : 0;

  // Check for common patterns (e.g., both end with same word)
  const words1 = lower1.split(' ');
  const words2 = lower2.split(' ');
  const patternBonus =
    (words1[words1.length - 1] === words2[words2.length - 1] && words1.length > 1 && words2.length > 1) ? 0.2 :
    (words1[0] === words2[0] && words1.length > 1 && words2.length > 1) ? 0.15 : 0;

  return Math.min(1, jaccardSim + substringBonus + patternBonus);
}

/**
 * Calculate optimal number of clusters
 */
function calculateOptimalClusters(numKeywords) {
  // Use elbow method approximation
  const sqrtClusters = Math.floor(Math.sqrt(numKeywords / 2));
  return Math.min(MAX_CLUSTERS, Math.max(MIN_CLUSTERS, sqrtClusters));
}

/**
 * Create cluster object
 */
function createClusterObject(id, keywords, algorithm) {
  // Sort keywords by search volume
  const sortedKeywords = [...keywords].sort((a, b) => b.searchVolume - a.searchVolume);

  // Select pillar topic (highest volume or most representative)
  const pillarTopic = selectPillarTopic(sortedKeywords);

  return {
    id,
    pillarTopic,
    keywords: sortedKeywords,
    totalSearchVolume: calculateTotalVolume(sortedKeywords),
    avgSearchVolume: Math.round(calculateTotalVolume(sortedKeywords) / sortedKeywords.length),
    avgCompetition: calculateAvgCompetition(sortedKeywords),
    clusterValueScore: calculateClusterValue(sortedKeywords),
    algorithm,
    keywordCount: sortedKeywords.length,
  };
}

/**
 * Select the best pillar topic for a cluster
 */
function selectPillarTopic(keywords) {
  if (keywords.length === 0) return 'Unknown Topic';

  // Find the keyword that best represents the cluster
  // Prioritize: high volume, medium length, contains common terms

  const scores = keywords.map(keyword => {
    let score = Math.log(keyword.searchVolume + 1);

    // Prefer 2-3 word phrases
    const wordCount = keyword.keyword.split(' ').length;
    if (wordCount === 2 || wordCount === 3) score *= 1.2;
    if (wordCount === 1) score *= 0.8;
    if (wordCount > 4) score *= 0.7;

    // Check how many other keywords contain this one
    const containmentCount = keywords.filter(k =>
      k.keyword !== keyword.keyword &&
      k.keyword.toLowerCase().includes(keyword.keyword.toLowerCase())
    ).length;
    score += containmentCount * 0.5;

    return { keyword: keyword.keyword, score };
  });

  scores.sort((a, b) => b.score - a.score);
  return scores[0].keyword;
}

/**
 * Refine clusters with semantic analysis
 */
function refineWithSemantics(clusters) {
  const refined = [];

  clusters.forEach(cluster => {
    // Check cluster coherence
    const coherence = calculateClusterCoherence(cluster.keywords);

    if (coherence < 0.3 && cluster.keywords.length > 10) {
      // Split incoherent cluster
      const subClusters = splitCluster(cluster);
      refined.push(...subClusters);
    } else {
      refined.push(cluster);
    }
  });

  return refined;
}

/**
 * Merge similar clusters
 */
function mergeSimilarClusters(clusters) {
  const merged = [];
  const used = new Set();

  for (let i = 0; i < clusters.length; i++) {
    if (used.has(i)) continue;

    let currentCluster = { ...clusters[i] };
    used.add(i);

    for (let j = i + 1; j < clusters.length; j++) {
      if (used.has(j)) continue;

      const similarity = calculateClusterSimilarity(currentCluster, clusters[j]);

      if (similarity > 0.6) {
        // Merge clusters
        currentCluster.keywords.push(...clusters[j].keywords);
        currentCluster.totalSearchVolume += clusters[j].totalSearchVolume;
        used.add(j);
      }
    }

    // Recalculate cluster properties
    currentCluster = createClusterObject(
      currentCluster.id,
      currentCluster.keywords,
      'hybrid-merged'
    );

    merged.push(currentCluster);
  }

  return merged;
}

/**
 * Split mixed clusters
 */
function splitMixedClusters(clusters) {
  const result = [];

  clusters.forEach(cluster => {
    if (cluster.keywords.length > 30) {
      // Large cluster, try to split
      const subClusters = splitCluster(cluster);
      result.push(...subClusters);
    } else {
      result.push(cluster);
    }
  });

  return result;
}

/**
 * Split a cluster into sub-clusters
 */
function splitCluster(cluster) {
  if (cluster.keywords.length < 6) return [cluster];

  const numSubClusters = Math.min(3, Math.floor(cluster.keywords.length / 5));
  const vectors = createEnhancedVectors(cluster.keywords);

  const result = kmeans(vectors, numSubClusters, {
    initialization: 'kmeans++',
    maxIterations: 50,
  });

  const subClusters = [];
  const subClusterMap = new Map();

  cluster.keywords.forEach((keyword, idx) => {
    const subClusterId = result.clusters[idx];
    if (!subClusterMap.has(subClusterId)) {
      subClusterMap.set(subClusterId, []);
    }
    subClusterMap.get(subClusterId).push(keyword);
  });

  let id = cluster.id * 10; // Sub-cluster IDs
  for (const [_, keywords] of subClusterMap) {
    if (keywords.length >= MIN_CLUSTER_SIZE) {
      subClusters.push(createClusterObject(id++, keywords, 'hybrid-split'));
    }
  }

  return subClusters.length > 0 ? subClusters : [cluster];
}

/**
 * Calculate cluster coherence
 */
function calculateClusterCoherence(keywords) {
  if (keywords.length < 2) return 1;

  let totalSimilarity = 0;
  let pairs = 0;

  for (let i = 0; i < Math.min(keywords.length, 10); i++) {
    for (let j = i + 1; j < Math.min(keywords.length, 10); j++) {
      totalSimilarity += calculateSemanticSimilarity(
        keywords[i].keyword,
        keywords[j].keyword
      );
      pairs++;
    }
  }

  return pairs > 0 ? totalSimilarity / pairs : 0;
}

/**
 * Calculate similarity between clusters
 */
function calculateClusterSimilarity(cluster1, cluster2) {
  // Compare pillar topics
  const topicSimilarity = calculateSemanticSimilarity(
    cluster1.pillarTopic,
    cluster2.pillarTopic
  );

  // Compare top keywords
  const topKeywords1 = cluster1.keywords.slice(0, 5).map(k => k.keyword);
  const topKeywords2 = cluster2.keywords.slice(0, 5).map(k => k.keyword);

  let keywordSimilarity = 0;
  let comparisons = 0;

  topKeywords1.forEach(kw1 => {
    topKeywords2.forEach(kw2 => {
      keywordSimilarity += calculateSemanticSimilarity(kw1, kw2);
      comparisons++;
    });
  });

  if (comparisons > 0) {
    keywordSimilarity /= comparisons;
  }

  return (topicSimilarity * 0.4) + (keywordSimilarity * 0.6);
}

/**
 * Assign noise points to nearest cluster
 */
function assignNoisePoints(noiseKeywords, clusters) {
  const unassigned = [];

  noiseKeywords.forEach(keyword => {
    const bestCluster = findBestClusterForKeyword(keyword, clusters);

    if (bestCluster) {
      bestCluster.keywords.push(keyword);
    } else {
      unassigned.push(keyword);
    }
  });

  return unassigned;
}

/**
 * Find best cluster for a keyword
 */
function findBestClusterForKeyword(keyword, clusters) {
  let bestCluster = null;
  let bestScore = 0;

  clusters.forEach(cluster => {
    const topKeywords = cluster.keywords.slice(0, 5);
    let totalSimilarity = 0;

    topKeywords.forEach(clusterKeyword => {
      totalSimilarity += calculateSemanticSimilarity(
        keyword.keyword,
        clusterKeyword.keyword
      );
    });

    const avgSimilarity = totalSimilarity / topKeywords.length;

    if (avgSimilarity > bestScore && avgSimilarity > 0.3) {
      bestScore = avgSimilarity;
      bestCluster = cluster;
    }
  });

  return bestCluster;
}

/**
 * Sort and rank clusters
 */
function sortAndRankClusters(clusters) {
  return clusters.sort((a, b) => {
    // Primary: Total search volume (60% weight)
    const volumeDiff = (b.totalSearchVolume - a.totalSearchVolume) * 0.6;

    // Secondary: Cluster value score (30% weight)
    const scoreDiff = (b.clusterValueScore - a.clusterValueScore) * 0.3;

    // Tertiary: Number of keywords (10% weight)
    const sizeDiff = (b.keywords.length - a.keywords.length) * 0.1;

    return volumeDiff + scoreDiff + sizeDiff;
  });
}

/**
 * Fallback clustering for error cases
 */
function fallbackClustering(keywordData) {
  // Simple grouping by first word or length
  const groups = new Map();

  keywordData.forEach(keyword => {
    const firstWord = keyword.keyword.split(' ')[0].toLowerCase();
    if (!groups.has(firstWord)) {
      groups.set(firstWord, []);
    }
    groups.get(firstWord).push(keyword);
  });

  const clusters = [];
  let id = 1;

  for (const [_, keywords] of groups) {
    if (keywords.length >= MIN_CLUSTER_SIZE) {
      clusters.push(createClusterObject(id++, keywords, 'fallback'));
    }
  }

  // Handle remaining keywords
  const used = new Set(clusters.flatMap(c => c.keywords.map(k => k.keyword)));
  const remaining = keywordData.filter(k => !used.has(k.keyword));

  if (remaining.length > 0) {
    clusters.push(createClusterObject(id++, remaining, 'fallback-misc'));
  }

  return clusters;
}

/**
 * Calculate total search volume
 */
function calculateTotalVolume(keywords) {
  return keywords.reduce((sum, k) => sum + (k.searchVolume || 0), 0);
}

/**
 * Calculate average competition
 */
function calculateAvgCompetition(keywords) {
  if (keywords.length === 0) return 'unknown';

  const competitionValues = {
    low: 1,
    medium: 2,
    high: 3,
    unknown: 2,
    unspecified: 2,
  };

  const avgValue = keywords.reduce((sum, k) =>
    sum + (competitionValues[k.competition] || 2), 0
  ) / keywords.length;

  if (avgValue < 1.5) return 'low';
  if (avgValue < 2.5) return 'medium';
  return 'high';
}

/**
 * Calculate cluster value score
 */
function calculateClusterValue(keywords) {
  if (keywords.length === 0) return 0;

  const totalVolume = calculateTotalVolume(keywords);
  const avgVolume = totalVolume / keywords.length;

  const competitionValues = {
    low: 3,
    medium: 2,
    high: 1,
    unknown: 2,
    unspecified: 2,
  };

  const avgCompetitionValue = keywords.reduce((sum, k) =>
    sum + (competitionValues[k.competition] || 2), 0
  ) / keywords.length;

  // Volume score (60% weight)
  const volumeScore = Math.min(60, Math.log(avgVolume + 1) * 15);

  // Competition score (25% weight)
  const competitionScore = avgCompetitionValue * 12.5;

  // Size bonus (15% weight)
  const sizeBonus = Math.min(15, keywords.length * 1.5);

  return Math.round(Math.min(100, volumeScore + competitionScore + sizeBonus));
}

module.exports = {
  clusterKeywords,
  calculateSemanticSimilarity,
  calculateAvgCompetition,
  calculateClusterValue,
  createClusterObject,
};