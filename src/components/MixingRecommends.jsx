import { Shuffle, Play } from 'lucide-react';
import SelectedTrackDisplay from './SelectedTrack';
import RecommendationItem from './RecommendItem';
import '../styles/MixingRecommends.css';

const MixingRecommends = ({ selectedSong, recommendations }) => {
  return (
    <div className="panel">
      <h2 className="panel-title">
        <Shuffle size={20} />
        Mixing Recommendations
      </h2>

      {selectedSong ? (
        <>
          <SelectedTrackDisplay song={selectedSong} />

          {recommendations.length > 0 ? (
            <div className="recommendations-list">
              {recommendations.map((rec, index) => (
                <RecommendationItem
                  key={rec.id}
                  recommendation={rec}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Shuffle size={32} className="empty-state-icon" />
              <p>No compatible tracks found for mixing</p>
              <p className="empty-state-text">Try selecting a different song</p>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <Play size={32} className="empty-state-icon" />
          <p>Select a song from your library</p>
          <p className="empty-state-text">to see mixing recommendations</p>
        </div>
      )}
    </div>
  );
};

export default MixingRecommends;