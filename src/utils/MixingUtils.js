import { getCompatibleKeys } from './CamelotUtils';

export const findMixingRecommendations = (selectedSong, csvData) => {
  if (!selectedSong || !csvData.length) return [];

  const compatibleKeys = getCompatibleKeys(selectedSong.camelotKey);
  const targetTempo = selectedSong.tempo;
  const tempoRange = targetTempo * 0.1; // 10% tempo range

  const recommendations = csvData
    .filter(track => track.id !== selectedSong.id)
    .map(track => {
      let score = 0;
      let reasons = [];

      // Key compatibility (highest priority)
      if (compatibleKeys.includes(track.camelotKey)) {
        if (track.camelotKey === selectedSong.camelotKey) {
          score += 50;
          reasons.push('Perfect key match');
        } else {
          score += 25;
          reasons.push('Compatible key');
        }
      }

      // Tempo compatibility
      const tempoDiff = Math.abs(track.tempo - targetTempo);
      if (track.tempo == targetTempo) {
        score += 50;
        reasons.push('Perfect tempo match');
      } else if (tempoDiff <= tempoRange) {
        score += 35;
        reasons.push('Similar tempo');
      } else if (tempoDiff <= tempoRange * 2) {
        score += 25;
        reasons.push('Manageable tempo difference');
      }

      // Energy level similarity
      const energyDiff = Math.abs(track.energy - selectedSong.energy);
      if (energyDiff <= 0.2) {
        score += 10;
        reasons.push('Similar energy');
      }

      // Danceability similarity
      const danceabilityDiff = Math.abs(track.danceability - selectedSong.danceability);
      if (danceabilityDiff <= 0.2) {
        score += 10;
        reasons.push('Similar danceability');
      }

      return {
        ...track,
        mixScore: score,
        mixReasons: reasons,
        tempoDiff: tempoDiff.toFixed(1)
      };
    })
    .filter(track => track.mixScore > 0)
    .sort((a, b) => b.mixScore - a.mixScore)
    .slice(0, 10);

  return recommendations;
};

export const sortTracks = (tracks, sortBy) => {
  return [...tracks].sort((a, b) => {
    switch (sortBy) {
      case 'tempo':
        return a.tempo - b.tempo;
      case 'energy':
        return b.energy - a.energy;
      case 'danceability':
        return b.danceability - a.danceability;
      case 'artist':
        return (a['Artist Name(s)'] || '').localeCompare(b['Artist Name(s)'] || '');
      case 'track':
        return (a['Track Name'] || '').localeCompare(b['Track Name'] || '');
      default:
        return a.id - b.id;
    }
  });
};