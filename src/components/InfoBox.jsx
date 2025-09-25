import '../styles/InfoBox.css';

const InfoBox = () => {
  return (
    <div className="info-box">
      <h3 className="info-title">How it works:</h3>
      <div className="info-list">
        <p>• <strong>Key Matching:</strong> Uses Camelot Wheel system for harmonic mixing compatibility</p>
        <p>• <strong>Tempo Analysis:</strong> Finds tracks with similar or manageable BPM differences</p>
        <p>• <strong>Energy Matching:</strong> Considers energy levels for smooth transitions</p>
        <p>• <strong>Smart Scoring:</strong> Combines all factors to rank the best mixing options</p>
      </div>
    </div>
  );
};

export default InfoBox;