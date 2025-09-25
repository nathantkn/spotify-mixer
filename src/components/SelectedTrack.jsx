import "../styles/SelectedTrack.css";

const SelectedTrack = ({ song }) => {

  return (
    <div className="selectedTrack">
      <div className="selectedTrackTitle">Selected Track:</div>
      <div className="selectedTrackName">{song['Track Name']}</div>
      <div className="selectedTrackArtist">{song['Artist Name(s)']}</div>
      <div className="selectedTrackStats">
        <span>{song.tempo.toFixed(0)} BPM </span>
        <span className="selectedTrackKey">Key: {song.camelotKey} </span>
        <span className="selectedTrackEnergy">Energy: {(song.energy * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
};

export default SelectedTrack;