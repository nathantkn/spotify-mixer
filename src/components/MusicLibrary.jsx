import { Music } from 'lucide-react';
import SongItem from './SongItem';
import '../styles/MusicLibrary.css';

const MusicLibrary = ({ songs, sortBy, onSortChange, selectedSong, onSongSelect }) => {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">
          <Music size={20} />
          Music Library ({songs.length} tracks)
        </h2>
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className="select"
        >
            <option value="default">Sort by Default</option>
            <option value="tempo">Sort by Tempo</option>
            <option value="energy">Sort by Energy</option>
            <option value="danceability">Sort by Danceability</option>
            <option value="artist">Sort by Artist</option>
            <option value="track">Sort by Track Name</option>
        </select>
      </div>

      <div className="song-list">
        {songs.map((song) => (
          <SongItem
            key={song.id}
            song={song}
            isSelected={selectedSong?.id === song.id}
            onSelect={onSongSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default MusicLibrary;