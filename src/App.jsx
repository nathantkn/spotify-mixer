import { useState, useMemo } from 'react';

import FileUpload from './components/FileUpload';
import MusicLibrary from './components/MusicLibrary';
import MixingRecommendations from './components/MixingRecommends';
import InfoBox from './components/InfoBox';
import { findMixingRecommendations, sortTracks } from './utils/MixingUtils';
import './App.css';

const App = () => {
  const [fileData, setFileData] = useState([]);
  const [selectedSong, setSelectedSong] = useState(null);
  const [sortBy, setSortBy] = useState('');
  const [recommendations, setRecommendations] = useState([]);

  const sortedData = useMemo(() => {
    if (!fileData.length) return [];
    return sortTracks(fileData, sortBy);
  }, [fileData, sortBy]);

  const handleSongSelect = (song) => {
    setSelectedSong(song);
    const recs = findMixingRecommendations(song, fileData);
    setRecommendations(recs);
  };

  return (
    <div className="container">
      <div className="header">
        <h1 className="title">Spotify Playlist Mixing Tool</h1>
        <p className="subtitle">Upload your playlist CSV to get tempo sorting and key-compatible mixing recommendations</p>
      </div>

      {!fileData.length && (
        <>
          <FileUpload onDataLoaded={setFileData} />
          <InfoBox />
        </>
      )}

      {fileData.length > 0 && (
        <>
          <div class="mainGrid">
            <MusicLibrary
              songs={sortedData}
              sortBy={sortBy}
              onSortChange={setSortBy}
              selectedSong={selectedSong}
              onSongSelect={handleSongSelect}
            />

            <MixingRecommendations
              selectedSong={selectedSong}
              recommendations={recommendations}
            />
          </div>

          
        </>
      )}
    </div>
  );
};

export default App;