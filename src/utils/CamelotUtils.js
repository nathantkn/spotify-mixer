export const camelotWheelMajor = {
  0: '8A', 1: '3B', 2: '10B', 3: '5B', 4: '12B', 5: '7B',
  6: '2B', 7: '9B', 8: '4B', 9: '11B', 10: '6B', 11: '1B'
};

export const camelotWheelMinor = {
  0: '5A', 1: '12A', 2: '7A', 3: '2A', 4: '9A', 5: '4A',
  6: '11A', 7: '6A', 8: '1A', 9: '8A', 10: '3A', 11: '10A'
};

export const getCamelotKey = (key, mode) => {
  if (key === null || key === undefined || mode === null || mode === undefined) {
    return 'Unknown';
  }
  const keyNum = parseInt(key);
  const modeNum = parseInt(mode);
  
  if (modeNum === 1) {
    return camelotWheelMajor[keyNum] || 'Unknown';
  } else {
    return camelotWheelMinor[keyNum] || 'Unknown';
  }
};

export const getCompatibleKeys = (camelotKey) => {
  if (camelotKey === 'Unknown') return [];
  
  const number = camelotKey.slice(0, -1);
  const letter = camelotKey.slice(-1);
  const num = parseInt(number);
  
  const compatible = [];
  
  // Same key
  compatible.push(camelotKey);
  
  // Adjacent keys (+1/-1)
  const nextNum = num === 12 ? 1 : num + 1;
  const prevNum = num === 1 ? 12 : num - 1;
  compatible.push(`${nextNum}${letter}`);
  compatible.push(`${prevNum}${letter}`);
  
  // Same number, opposite mode
  const oppositeLetter = letter === 'A' ? 'B' : 'A';
  compatible.push(`${num}${oppositeLetter}`);
  
  return compatible;
};

export const formatDuration = (ms) => {
  if (!ms) return 'Unknown';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};