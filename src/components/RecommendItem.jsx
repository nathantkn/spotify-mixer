import '../styles/RecommendItem.css';

const RecommendItem = ({ recommendation, index }) => {
  return (
    <div className="recommendation-item">
      <div className="recommendation-header">
        <div className="recommendation-info">
          <div>
            <span className="recommendation-rank">
              #{index + 1}
            </span>
            <span className="recommendation-title">
              {recommendation['Track Name']}
            </span>
          </div>
          <div className="recommendation-artist">{recommendation['Artist Name(s)']}</div>
          <div className="recommendation-tags">
            {recommendation.mixReasons.map((reason, i) => (
              <span key={i} className="recommendation-tag">
                {reason}
              </span>
            ))}
          </div>
        </div>
        <div className="recommendation-stats">
          <div>{recommendation.tempo.toFixed(0)} BPM</div>
          <div>{recommendation.camelotKey}</div>
          <div className="recommendation-score">Score: {recommendation.mixScore}</div>
        </div>
      </div>
    </div>
  );
};

export default RecommendItem;