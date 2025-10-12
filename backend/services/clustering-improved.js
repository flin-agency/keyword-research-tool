const { kmeans } = require('ml-kmeans');
const { DBSCAN } = require('density-clustering');
const gemini = require('./gemini');

let TfIdf;
let tokenizer;
let stemmer;

try {
  const natural = require('natural');
  TfIdf = natural.TfIdf;
  tokenizer = new natural.WordTokenizer();
  stemmer = natural.PorterStemmer;
} catch (error) {
  console.warn(
    '[Clustering] Optional dependency "natural" could not be loaded. Falling back to a simplified NLP toolkit:',
    error.message
  );
  ({ TfIdf, tokenizer, stemmer } = createFallbackNlpToolkit());
}

function createFallbackNlpToolkit() {
  class SimpleTokenizer {
    tokenize(text) {
      if (!text) {
        return [];
      }

      const normalized = text
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9\s]+/giu, ' ');

      return normalized.split(/\s+/u).filter(Boolean);
    }
  }

  const simpleStemmer = {
    stem(word) {
      if (!word) {
        return '';
      }

      let stem = word.toString().toLowerCase();

      const rules = [
        [/([aeiouy])ies$/, '$1y'],
        [/([aeiouy])ves$/, '$1f'],
        [/(?:([bcdfghjklmnpqrstvwxyz]))\1es$/, '$1'],
        [/([sxz])es$/, '$1'],
        [/([aeiouy][^aeiouy])ed$/, '$1'],
        [/([aeiouy][^aeiouy])ing$/, '$1'],
        [/ment$/, ''],
        [/ness$/, ''],
        [/ers?$/, ''],
        [/ly$/, ''],
        [/s$/, ''],
      ];

      for (const [pattern, replacement] of rules) {
        if (stem.length > 4 && pattern.test(stem)) {
          stem = stem.replace(pattern, replacement);
          break;
        }
      }

      return stem;
    },
  };

  const fallbackTokenizer = new SimpleTokenizer();

  class SimpleTfIdf {
    constructor() {
      this.documents = [];
      this.termDocumentFrequency = new Map();
    }

    addDocument(text) {
      const tokens = fallbackTokenizer.tokenize(text);
      const counts = new Map();

      tokens.forEach(token => {
        counts.set(token, (counts.get(token) || 0) + 1);
      });

      this.documents.push({ tokens, counts });

      const uniqueTokens = new Set(tokens);
      uniqueTokens.forEach(token => {
        this.termDocumentFrequency.set(token, (this.termDocumentFrequency.get(token) || 0) + 1);
      });
    }

    listTerms(docIndex) {
      const doc = this.documents[docIndex];
      if (!doc) {
        return [];
      }

      const totalTerms = doc.tokens.length || 1;
      const numDocs = this.documents.length;

      const terms = [];
      doc.counts.forEach((count, term) => {
        const termFrequency = count / totalTerms;
        const docFrequency = this.termDocumentFrequency.get(term) || 1;
        const inverseDocFrequency = Math.log((numDocs + 1) / (docFrequency + 1)) + 1;
        terms.push({ term, tfidf: termFrequency * inverseDocFrequency });
      });

      return terms.sort((a, b) => b.tfidf - a.tfidf);
    }
  }

  return {
    TfIdf: SimpleTfIdf,
    tokenizer: fallbackTokenizer,
    stemmer: simpleStemmer,
  };
}

// Configuration
const MIN_CLUSTER_SIZE = 3;
const MAX_CLUSTERS = 20;
const MIN_CLUSTERS = 3;

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'when', 'what',
  'best', 'how', 'are', 'was', 'you', 'why', 'can', 'will', 'use', 'using',
  'into', 'have', 'has', 'had', 'their', 'them', 'they', 'about', 'want', 'need',
  'idea', 'ideas', 'tips', 'guide', 'guides', 'info', 'information', 'to', 'in',
  'on', 'of', 'a', 'an', 'is', 'it', 'be', 'by', 'or', 'as'
]);
const STEMMED_STOP_WORDS = new Set([...STOP_WORDS].map(word => stemmer.stem(word)));

const DEFAULT_RELEVANCE_SCORE = 0.65;
const CLEAR_KEYWORD_RELEVANCE_THRESHOLD = 0.01;

/**
 * Enhanced clustering with multiple algorithms and semantic similarity
 */
async function clusterKeywords(keywordData, websiteContext = {}, options = {}) {
  const {
    algorithm = 'hybrid', // 'kmeans', 'dbscan', 'semantic', 'hybrid'
    minClusterSize = MIN_CLUSTER_SIZE,
    useAI = true,
    language: languageCode = 'en',
    languageLabel = null,
  } = options;

  const languageOptions = {
    code: languageCode,
    label: languageLabel,
  };

  // Validate input
  if (!keywordData || keywordData.length === 0) {
    return [];
  }

  if (keywordData.length < minClusterSize) {
    // Too few keywords for clustering
    const singleCluster = createClusterObject(1, keywordData, 'single');
    const relevanceResult = applyRelevanceScores([singleCluster], websiteContext, { allowRemoval: true });
    return relevanceResult.clusters.length > 0 ? relevanceResult.clusters : [singleCluster];
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
      clusters = clusters.filter(c => c.keywords.length >= minClusterSize);
    }

    // Ensure each keyword only belongs to one cluster before AI review
    clusters = ensureUniqueKeywords(clusters);
    clusters = clusters.filter(c => c.keywords.length >= minClusterSize);

    const relevanceResult = applyRelevanceScores(clusters, websiteContext, { allowRemoval: true });
    clusters = relevanceResult.clusters;

    if (relevanceResult.contextAvailable) {
      if (relevanceResult.removedClusters > 0) {
        console.log(
          `[Clustering] Removed ${relevanceResult.removedClusters} clusters that were irrelevant to the page context.`
        );
      }
      if (relevanceResult.removedKeywords > 0) {
        console.log(
          `[Clustering] Filtered ${relevanceResult.removedKeywords} keywords that clearly did not match the page intent.`
        );
      }
    }

    if (clusters.length === 0) {
      console.warn('[Clustering] No relevant clusters remained after relevance filtering.');
      return [];
    }

    // Sort clusters by value score
    clusters = sortAndRankClusters(clusters);

    // Enhance with AI if available
    if (useAI && process.env.GEMINI_API_KEY) {
      try {
        console.log(`[Clustering] Enhancing with Gemini AI in ${languageCode || 'en'}...`);

        // First, analyze and regroup
        clusters = await gemini.analyzeAndRegroupClusters(
          clusters,
          websiteContext,
          keywordData,
          languageOptions
        );

        // Let Gemini audit the topical boundaries and keyword placement
        clusters = await gemini.scrutinizeClusterTopics(
          clusters,
          keywordData,
          websiteContext,
          languageOptions
        );

        // Then enhance ALL clusters with detailed analysis
        console.log(`[Clustering] Enhancing all ${clusters.length} clusters with AI descriptions and content strategy...`);
        for (let i = 0; i < clusters.length; i++) {
          try {
            clusters[i] = await gemini.enhanceClusterWithAI(clusters[i], websiteContext, languageOptions);
            console.log(`[Clustering] Enhanced cluster ${i + 1}/${clusters.length}: "${clusters[i].pillarTopic}"`);
          } catch (error) {
            console.warn(`[Clustering] Failed to enhance cluster ${i + 1} ("${clusters[i].pillarTopic}"):`, error.message);
          }
        }
        console.log('[Clustering] AI enhancement complete');
        
        // Verify AI content is present
        const enhancedCount = clusters.filter(c => c.aiDescription || c.aiContentStrategy).length;
        console.log(`[Clustering] ${enhancedCount}/${clusters.length} clusters have AI-generated content`);
        clusters.slice(0, 3).forEach((c, i) => {
          console.log(`[Clustering] Cluster ${i + 1} "${c.pillarTopic}":`, {
            hasAiDescription: !!c.aiDescription,
            hasAiContentStrategy: !!c.aiContentStrategy
          });
        });
      } catch (error) {
        console.warn('[Clustering] AI enhancement failed:', error.message);
      }
    }

    // Final safety pass to guarantee keyword uniqueness
    clusters = ensureUniqueKeywords(clusters);

    const postAiRelevance = applyRelevanceScores(clusters, websiteContext, { allowRemoval: false });
    clusters = sortAndRankClusters(postAiRelevance.clusters);

    // Ensure every cluster ships with human-readable insights even without AI
    return applyClusterNarratives(clusters, websiteContext);

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

  for (const keywords of clusterMap.values()) {
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
  for (const keywords of subClusterMap.values()) {
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
 * Ensure clusters cover distinct intents and do not share semantically overlapping keywords
 */
function ensureUniqueKeywords(clusters) {
  if (!Array.isArray(clusters) || clusters.length === 0) {
    return [];
  }

  const normalizedClusters = clusters.map(cluster => ({
    ...cluster,
    keywords: [],
  }));

  const keywordOwners = new Map();

  clusters.forEach((cluster, clusterIndex) => {
    if (!cluster || !Array.isArray(cluster.keywords)) return;

    cluster.keywords.forEach(keyword => {
      if (!keyword || typeof keyword.keyword !== 'string') {
        return;
      }

      const normalized = keyword.keyword.trim().toLowerCase();
      if (!normalized) return;

      const affinity = calculateSemanticSimilarity(keyword.keyword, cluster.pillarTopic || '');
      const currentOwner = keywordOwners.get(normalized);

      if (!currentOwner || affinity > currentOwner.affinity + 0.02) {
        if (currentOwner) {
          const ownerCluster = normalizedClusters[currentOwner.clusterIndex];
          ownerCluster.keywords = ownerCluster.keywords.filter(
            existingKeyword => existingKeyword.keyword.trim().toLowerCase() !== normalized
          );
        }

        normalizedClusters[clusterIndex].keywords.push(keyword);
        keywordOwners.set(normalized, { clusterIndex, affinity });
      }
    });
  });

  const orphanKeywords = [];
  const resultClusters = [];

  normalizedClusters.forEach(cluster => {
    if (!cluster) return;

    if (cluster.keywords.length >= MIN_CLUSTER_SIZE) {
      const baseCluster = createClusterObject(
        resultClusters.length + 1,
        cluster.keywords,
        cluster.algorithm || 'hybrid'
      );

      const mergedCluster = {
        ...baseCluster,
        pillarTopic: cluster.pillarTopic || baseCluster.pillarTopic,
      };

      Object.keys(cluster || {})
        .filter(key => key.startsWith('ai') && typeof cluster[key] === 'string' && cluster[key].trim())
        .forEach(key => {
          mergedCluster[key] = cluster[key];
        });

      if (cluster.aiEnhanced) {
        mergedCluster.aiEnhanced = cluster.aiEnhanced;
      }

      resultClusters.push(mergedCluster);
    } else {
      orphanKeywords.push(...cluster.keywords);
    }
  });

  if (orphanKeywords.length > 0 && resultClusters.length > 0) {
    orphanKeywords.forEach(keyword => {
      const bestCluster = findBestClusterForKeyword(keyword, resultClusters);
      if (
        bestCluster &&
        !bestCluster.keywords.some(existing => existing.keyword.trim().toLowerCase() === keyword.keyword.trim().toLowerCase())
      ) {
        bestCluster.keywords.push(keyword);
      }
    });
  }

  return resultClusters;
}

function extractTopKeywordPhrases(cluster, limit = 5) {
  if (!cluster || !Array.isArray(cluster.keywords)) {
    return [];
  }

  return cluster.keywords
    .map(keyword => (typeof keyword?.keyword === 'string' ? keyword.keyword.trim() : ''))
    .filter(Boolean)
    .slice(0, limit);
}

function formatKeywordList(keywords) {
  const unique = Array.from(new Set(keywords.filter(Boolean)));

  if (unique.length === 0) {
    return '';
  }

  if (unique.length === 1) {
    return unique[0];
  }

  if (unique.length === 2) {
    return `${unique[0]} and ${unique[1]}`;
  }

  const initial = unique.slice(0, -1).join(', ');
  return `${initial}, and ${unique[unique.length - 1]}`;
}

function summarizeWebsiteContext(websiteContext = {}) {
  const { title, description, url } = websiteContext || {};
  const candidates = [title, description, url]
    .map(value => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);

  if (candidates.length === 0) {
    return '';
  }

  const summary = candidates[0];
  return summary.length > 140 ? `${summary.slice(0, 137)}...` : summary;
}

function buildFallbackClusterDescription(cluster, websiteContext = {}) {
  const baseTopic = typeof cluster?.pillarTopic === 'string' && cluster.pillarTopic.trim()
    ? cluster.pillarTopic.trim()
    : 'this topic';

  const topKeywords = extractTopKeywordPhrases(cluster, 4);
  const primaryKeyword = topKeywords[0] || baseTopic;
  const supportingKeywords = topKeywords
    .slice(1)
    .filter(keyword => keyword.toLowerCase() !== primaryKeyword.toLowerCase());

  let description = `This cluster groups searches about ${primaryKeyword}.`;
  const supportingText = formatKeywordList(supportingKeywords);

  if (supportingText) {
    description += ` Related queries include ${supportingText}.`;
  }

  const siteSummary = summarizeWebsiteContext(websiteContext);
  if (siteSummary) {
    description += ` Align your coverage with what people expect from ${siteSummary}.`;
  } else {
    description += ' Emphasize clear explanations and practical examples to satisfy search intent.';
  }

  return description;
}

function buildFallbackClusterStrategy(cluster, websiteContext = {}) {
  const baseTopic = typeof cluster?.pillarTopic === 'string' && cluster.pillarTopic.trim()
    ? cluster.pillarTopic.trim()
    : 'the main topic';

  const topKeywords = extractTopKeywordPhrases(cluster, 5);
  const primaryKeyword = topKeywords[0] || baseTopic;
  const supportingKeywords = topKeywords
    .slice(1, 4)
    .filter(keyword => keyword.toLowerCase() !== primaryKeyword.toLowerCase());

  const supportingText = formatKeywordList(supportingKeywords);

  const strategyParts = [
    `Create an authoritative piece focused on ${primaryKeyword}.`,
  ];

  if (supportingText) {
    strategyParts.push(`Structure the content to answer related searches like ${supportingText}.`);
  }

  const siteSummary = summarizeWebsiteContext(websiteContext);
  if (siteSummary) {
    strategyParts.push(`Demonstrate how ${siteSummary} solves the reader's problem and include proof of expertise.`);
  } else {
    strategyParts.push('Incorporate real examples, data, or case studies from your brand to build authority.');
  }

  return strategyParts.join(' ');
}

function applyClusterNarratives(clusters, websiteContext = {}) {
  if (!Array.isArray(clusters)) {
    return [];
  }

  return clusters.map(cluster => {
    if (!cluster) {
      return cluster;
    }

    const enrichedCluster = { ...cluster };

    if (!enrichedCluster.aiDescription || !enrichedCluster.aiDescription.trim()) {
      enrichedCluster.aiDescription = buildFallbackClusterDescription(enrichedCluster, websiteContext);
    }

    if (!enrichedCluster.aiContentStrategy || !enrichedCluster.aiContentStrategy.trim()) {
      enrichedCluster.aiContentStrategy = buildFallbackClusterStrategy(enrichedCluster, websiteContext);
    }

    return enrichedCluster;
  });
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
 * Apply relevance scoring to clusters and optionally filter irrelevant entries
 */
function applyRelevanceScores(clusters, websiteContext = {}, options = {}) {
  const { allowRemoval = true } = options || {};

  if (!Array.isArray(clusters) || clusters.length === 0) {
    return {
      clusters: [],
      removedClusters: 0,
      removedKeywords: 0,
      contextAvailable: false,
    };
  }

  const contextInfo = buildRelevanceContext(websiteContext);
  const hasContext = contextInfo.tokens.size > 0;
  const processed = [];
  let removedClusters = 0;
  let removedKeywords = 0;

  clusters.forEach(cluster => {
    if (!cluster) {
      return;
    }

    const enriched = enrichClusterWithRelevance(cluster, contextInfo, {
      allowRemoval,
      hasContext,
    });

    if (!enriched) {
      removedClusters += 1;
      return;
    }

    if (allowRemoval) {
      removedKeywords += enriched.removedKeywords || 0;
    }

    const meetsSizeRequirement = allowRemoval
      ? enriched.keywordCount >= MIN_CLUSTER_SIZE
      : enriched.keywordCount > 0;

    if (!meetsSizeRequirement) {
      removedClusters += 1;
      return;
    }

    processed.push(enriched);
  });

  return {
    clusters: processed,
    removedClusters,
    removedKeywords,
    contextAvailable: hasContext,
  };
}

function enrichClusterWithRelevance(cluster, contextInfo, { allowRemoval, hasContext }) {
  const keywords = Array.isArray(cluster?.keywords) ? [...cluster.keywords] : [];

  if (keywords.length === 0) {
    if (allowRemoval && hasContext) {
      return null;
    }

    const fallbackRelevance = typeof cluster?.relevanceScore === 'number'
      ? Math.max(0, Math.min(1, cluster.relevanceScore))
      : DEFAULT_RELEVANCE_SCORE;

    return {
      ...cluster,
      keywords: [],
      keywordCount: 0,
      totalSearchVolume: 0,
      avgSearchVolume: 0,
      avgCompetition: 'unknown',
      relevanceScore: Math.round(fallbackRelevance * 100) / 100,
      clusterValueScore: calculateClusterValue([], { relevanceScore: fallbackRelevance }),
      removedKeywords: allowRemoval ? (cluster?.keywordCount || 0) : (cluster?.removedKeywords || 0),
    };
  }

  const allScores = [];
  const allWeights = [];
  const keptKeywords = [];
  const keptScores = [];
  const keptWeights = [];
  let removedKeywords = 0;

  keywords.forEach(keywordObj => {
    const keywordText = typeof keywordObj?.keyword === 'string' ? keywordObj.keyword : '';
    const keywordTokens = keywordText ? tokenizeForRelevance(keywordText) : new Set();
    const keywordScore = hasContext && keywordText
      ? scoreKeywordRelevance(keywordText, contextInfo, keywordTokens)
      : (keywordText ? DEFAULT_RELEVANCE_SCORE : 0);
    const keywordWeight = Math.max(1, Math.log10((keywordObj?.searchVolume || 0) + 10));

    allScores.push(keywordScore);
    allWeights.push(keywordWeight);

    const shouldKeep = !allowRemoval
      || !hasContext
      || keywordScore > CLEAR_KEYWORD_RELEVANCE_THRESHOLD
      || keywordTokens.size === 0;

    if (shouldKeep) {
      keptKeywords.push(keywordObj);
      keptScores.push(keywordScore);
      keptWeights.push(keywordWeight);
    } else {
      removedKeywords += 1;
    }
  });

  const workingKeywords = allowRemoval ? keptKeywords : keywords;
  const workingScores = allowRemoval ? keptScores : allScores;
  const workingWeights = allowRemoval ? keptWeights : allWeights;

  if (workingKeywords.length === 0) {
    if (hasContext) {
      return null;
    }

    const fallbackRelevance = typeof cluster?.relevanceScore === 'number'
      ? Math.max(0, Math.min(1, cluster.relevanceScore))
      : DEFAULT_RELEVANCE_SCORE;

    return {
      ...cluster,
      keywords: [],
      keywordCount: 0,
      totalSearchVolume: 0,
      avgSearchVolume: 0,
      avgCompetition: 'unknown',
      relevanceScore: Math.round(fallbackRelevance * 100) / 100,
      clusterValueScore: calculateClusterValue([], { relevanceScore: fallbackRelevance }),
      removedKeywords: allowRemoval ? removedKeywords : (cluster?.removedKeywords || 0),
    };
  }

  const sortedKeywords = [...workingKeywords].sort((a, b) => (b?.searchVolume || 0) - (a?.searchVolume || 0));
  const totalSearchVolume = calculateTotalVolume(sortedKeywords);
  const keywordCount = sortedKeywords.length;
  const avgSearchVolume = keywordCount > 0 ? Math.round(totalSearchVolume / keywordCount) : 0;
  const avgCompetition = calculateAvgCompetition(sortedKeywords);

  let relevanceScore;
  if (!hasContext) {
    const existing = typeof cluster?.relevanceScore === 'number'
      ? cluster.relevanceScore
      : DEFAULT_RELEVANCE_SCORE;
    relevanceScore = Math.max(0, Math.min(1, existing || DEFAULT_RELEVANCE_SCORE));
  } else if (workingScores.length === 0) {
    relevanceScore = 0;
  } else {
    const totalWeight = workingWeights.reduce((sum, weight) => sum + weight, 0) || workingScores.length;
    const weightedScore = workingScores.reduce(
      (sum, score, index) => sum + (score * (workingWeights[index] || 1)),
      0
    );
    const averageScore = weightedScore / totalWeight;
    const bestScore = Math.max(...workingScores);
    relevanceScore = Math.min(1, (averageScore * 0.7) + (bestScore * 0.3));
  }

  const normalizedRelevance = Math.max(0, Math.min(1, relevanceScore));
  const clusterValueScore = calculateClusterValue(sortedKeywords, { relevanceScore: normalizedRelevance });

  const pillarTopic = sortedKeywords.length > 0
    ? selectPillarTopic(sortedKeywords)
    : cluster.pillarTopic;

  return {
    ...cluster,
    pillarTopic,
    keywords: sortedKeywords,
    keywordCount,
    totalSearchVolume,
    avgSearchVolume,
    avgCompetition,
    relevanceScore: Math.round(normalizedRelevance * 100) / 100,
    clusterValueScore,
    removedKeywords: allowRemoval ? removedKeywords : (cluster?.removedKeywords || 0),
  };
}

function buildRelevanceContext(websiteContext = {}) {
  if (!websiteContext || typeof websiteContext !== 'object') {
    return { normalizedText: '', tokens: new Set() };
  }

  const contextParts = [];
  const directFields = [
    'title',
    'description',
    'url',
    'businessName',
    'brand',
    'topic',
    'category',
    'industry',
  ];

  directFields.forEach(field => {
    const value = websiteContext[field];
    if (typeof value === 'string' && value.trim()) {
      contextParts.push(value);
    }
  });

  const listFields = [
    'focusKeywords',
    'primaryKeywords',
    'topics',
    'targetKeywords',
    'keywords',
    'labels',
    'tags',
  ];

  listFields.forEach(field => {
    const value = websiteContext[field];
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (typeof item === 'string' && item.trim()) {
          contextParts.push(item);
        }
      });
    } else if (typeof value === 'string' && value.trim()) {
      contextParts.push(value);
    }
  });

  if (Array.isArray(websiteContext.pages)) {
    websiteContext.pages.forEach(page => {
      if (!page || typeof page !== 'object') return;
      if (typeof page.title === 'string' && page.title.trim()) {
        contextParts.push(page.title);
      }
      if (typeof page.metaDescription === 'string' && page.metaDescription.trim()) {
        contextParts.push(page.metaDescription);
      }
      if (typeof page.url === 'string' && page.url.trim()) {
        contextParts.push(page.url);
      }
    });
  }

  const normalizedText = contextParts
    .map(part => part && part.toString ? part.toString() : '')
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return {
    normalizedText,
    tokens: tokenizeForRelevance(normalizedText),
  };
}

function tokenizeForRelevance(text) {
  if (!text || typeof text !== 'string') {
    return new Set();
  }

  const normalized = text
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/giu, ' ');

  const rawTokens = normalized.split(/\s+/u).filter(Boolean);
  const tokens = new Set();

  rawTokens.forEach(token => {
    if (!token || STOP_WORDS.has(token)) {
      return;
    }

    const stemmed = stemmer.stem(token);
    if (!stemmed || stemmed.length <= 1) {
      return;
    }

    if (STEMMED_STOP_WORDS.has(stemmed)) {
      return;
    }

    tokens.add(stemmed);
  });

  return tokens;
}

function scoreKeywordRelevance(keyword, contextInfo, keywordTokens = null) {
  if (!contextInfo || !(contextInfo.tokens instanceof Set)) {
    return 0;
  }

  const normalizedKeyword = typeof keyword === 'string' ? keyword.toLowerCase() : '';
  const tokens = keywordTokens || tokenizeForRelevance(normalizedKeyword);

  if (!tokens || tokens.size === 0) {
    return 0;
  }

  const matches = [...tokens].filter(token => contextInfo.tokens.has(token));
  if (matches.length === 0) {
    return 0;
  }

  const matchRatio = matches.length / tokens.size;
  const unionSize = new Set([...tokens, ...contextInfo.tokens]).size || tokens.size;
  const jaccard = unionSize > 0 ? matches.length / unionSize : matchRatio;

  let score = (matchRatio * 0.7) + (jaccard * 0.3);

  if (contextInfo.normalizedText && normalizedKeyword && contextInfo.normalizedText.includes(normalizedKeyword)) {
    score = Math.max(score, 0.9);
  } else if (matchRatio >= 0.6 && tokens.size <= 3) {
    score = Math.max(score, 0.75);
  }

  return Math.min(1, score);
}

/**
 * Sort and rank clusters
 */
function sortAndRankClusters(clusters) {
  if (!Array.isArray(clusters)) {
    return [];
  }

  const sorted = [...clusters].sort((a, b) => {
    const scoreDiff = (b?.clusterValueScore || 0) - (a?.clusterValueScore || 0);
    if (Math.abs(scoreDiff) > 0.0001) {
      return scoreDiff;
    }

    const relevanceDiff = (b?.relevanceScore || 0) - (a?.relevanceScore || 0);
    if (Math.abs(relevanceDiff) > 0.0001) {
      return relevanceDiff;
    }

    const volumeDiff = (b?.totalSearchVolume || 0) - (a?.totalSearchVolume || 0);
    if (volumeDiff !== 0) {
      return volumeDiff;
    }

    return ((b?.keywords?.length || 0) - (a?.keywords?.length || 0));
  });

  return sorted.map((cluster, index) => ({
    ...cluster,
    rank: index + 1,
  }));
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

  for (const keywords of groups.values()) {
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
function calculateClusterValue(keywords, { relevanceScore = DEFAULT_RELEVANCE_SCORE } = {}) {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return 0;
  }

  const totalVolume = calculateTotalVolume(keywords);
  const avgVolume = keywords.length > 0 ? totalVolume / keywords.length : 0;

  const totalVolumeScore = Math.min(40, Math.log10(totalVolume + 1) * 20);
  const avgVolumeScore = Math.min(25, Math.log(avgVolume + 1) * 10);

  const competitionValues = {
    low: 1,
    medium: 2,
    high: 3,
    unknown: 2,
    unspecified: 2,
  };

  const avgCompetitionValue = keywords.reduce((sum, keyword) => (
    sum + (competitionValues[keyword?.competition] || 2)
  ), 0) / keywords.length;

  const competitionNormalized = 1 - Math.min(1, Math.max(0, (avgCompetitionValue - 1) / 2));
  const competitionScore = Math.max(0, Math.min(20, competitionNormalized * 20));

  const sizeScore = Math.min(10, Math.log1p(keywords.length) * 4);

  const normalizedRelevance = Math.max(
    0,
    Math.min(1, Number.isFinite(relevanceScore) ? relevanceScore : DEFAULT_RELEVANCE_SCORE)
  );
  const relevanceComponent = normalizedRelevance * 25;

  const combinedScore = totalVolumeScore + avgVolumeScore + competitionScore + sizeScore + relevanceComponent;

  return Math.round(Math.min(100, Math.max(0, combinedScore)));
}

module.exports = {
  clusterKeywords,
  calculateSemanticSimilarity,
  calculateAvgCompetition,
  calculateClusterValue,
  createClusterObject,
};