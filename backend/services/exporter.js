const { Parser } = require('json2csv');

/**
 * Export research data to CSV format
 */
function toCSV(data) {
  const rows = [];

  // Flatten cluster data into rows
  data.clusters.forEach((cluster) => {
    cluster.keywords.forEach((keyword) => {
      rows.push({
        cluster_id: cluster.id,
        pillar_topic: cluster.pillarTopic,
        keyword: keyword.keyword,
        search_volume: keyword.searchVolume,
        competition: keyword.competition,
        cpc_low: keyword.cpc,
        cpc_high: keyword.cpcHigh,
        cluster_value_score: cluster.clusterValueScore.toFixed(2),
        cluster_total_volume: cluster.totalSearchVolume,
      });
    });
  });

  const fields = [
    { label: 'Cluster ID', value: 'cluster_id' },
    { label: 'Pillar Topic', value: 'pillar_topic' },
    { label: 'Keyword', value: 'keyword' },
    { label: 'Search Volume', value: 'search_volume' },
    { label: 'Competition', value: 'competition' },
    { label: 'CPC Low', value: 'cpc_low' },
    { label: 'CPC High', value: 'cpc_high' },
    { label: 'Cluster Value Score', value: 'cluster_value_score' },
    { label: 'Cluster Total Volume', value: 'cluster_total_volume' },
  ];

  const parser = new Parser({ fields });
  return parser.parse(rows);
}

module.exports = {
  toCSV,
};
