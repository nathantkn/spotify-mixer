import { Upload } from 'lucide-react';
import Papa from 'papaparse';
import { getCamelotKey } from '../utils/CamelotUtils';
import '../styles/FileUpload.css';

const FileUpload = ({ onDataLoaded }) => {
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      complete: (result) => {
        const processedData = result.data
          .filter(row => row['Track Name'] && row['Track Name'].trim() !== '')
          .map((row, index) => ({
            ...row,
            id: index,
            tempo: parseFloat(row['Tempo']) || 0,
            key: parseInt(row['Key']),
            mode: parseInt(row['Mode']),
            energy: parseFloat(row['Energy']) || 0,
            danceability: parseFloat(row['Danceability']) || 0,
            valence: parseFloat(row['Valence']) || 0,
            camelotKey: getCamelotKey(parseInt(row['Key']), parseInt(row['Mode']))
          }));
        
        onDataLoaded(processedData);
      },
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false
    });
  };

  return (
    <div className="upload-area">
      <Upload size={48} className="upload-icon" />
      <label className="clickable-label">
        <div className="upload-text">Upload your music CSV file</div>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="hidden-input"
        />
        <div className="upload-subtext">
          CSV files with track data including tempo, key, and energy information
        </div>
      </label>
    </div>
  );
};

export default FileUpload;