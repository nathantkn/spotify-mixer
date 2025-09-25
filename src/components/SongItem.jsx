import { formatDuration } from '../utils/CamelotUtils';
import '../styles/SongItem.css';

const SongItem = ({ song, isSelected, onSelect }) => {
  return (
    <div
      onClick={() => onSelect(song)}
      className={`song-item ${isSelected ? 'selected' : ''}`}
    >
      <div className="song-info">
        <div className="song-title">
          {song['Track Name'] || 'Unknown Track'}
        </div>
        <div className="song-artist">
          {song['Artist Name(s)'] || 'Unknown Artist'}
        </div>
      </div>
      <div className="song-stats">
        <div>{song.tempo.toFixed(0)} BPM</div>
        <div>{song.camelotKey}</div>
        <div>{formatDuration(parseInt(song['Duration (ms)']))}</div>
      </div>
    </div>
  );
};

export default SongItem;