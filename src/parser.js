const koreanNumbers = {
  '일': 1, '이': 2, '삼': 3, '사': 4, '오': 5,
  '육': 6, '칠': 7, '팔': 8, '구': 9, '십': 10,
  '영': 0, '공': 0,
};

function koreanToNumber(str) {
  str = str.trim();

  // Already a number
  if (/^\d+$/.test(str)) return parseInt(str, 10);

  let result = 0;
  let current = 0;
  let hasKorean = false;

  for (const ch of str) {
    if (ch === '백') {
      hasKorean = true;
      result += (current || 1) * 100;
      current = 0;
    } else if (ch === '십') {
      hasKorean = true;
      result += (current || 1) * 10;
      current = 0;
    } else if (koreanNumbers[ch] !== undefined) {
      hasKorean = true;
      current = koreanNumbers[ch];
    }
  }
  result += current;

  return hasKorean ? result : null;
}

function replaceKoreanNumbers(text) {
  // Only replace Korean numbers that are standalone tokens (separated by spaces)
  // This prevents "케이블" from becoming "케2블"
  return text.split(' ').map(token => {
    // Only convert if the entire token is Korean number characters
    // (optionally followed by 회/kg/킬로 etc.)
    const m = token.match(/^([일이삼사오육칠팔구십백천영공]+)(회|킬로|kg)?$/);
    if (m) {
      const num = koreanToNumber(m[1]);
      if (num !== null) {
        return String(num) + (m[2] || '');
      }
    }
    return token;
  }).join(' ');
}

function parseWorkoutInput(rawText) {
  let text = rawText.trim();

  // Replace Korean numbers with digits
  text = replaceKoreanNumbers(text);

  // Normalize: remove extra spaces
  text = text.replace(/\s+/g, ' ').trim();

  let exerciseName = null;
  let weight = null;
  let reps = null;

  // Split into tokens
  const tokens = text.split(' ');

  if (tokens.length === 0) {
    return { exerciseName: null, weight: null, reps: null, rawText };
  }

  // 1. Extract reps from the end
  const lastToken = tokens[tokens.length - 1];
  const repsMatch = lastToken.match(/^(\d+)\s*회?$/);
  if (repsMatch) {
    reps = parseInt(repsMatch[1], 10);
    tokens.pop();
  }

  // 2. Extract weight/intensity from remaining tokens (after exercise name)
  // Exercise name is the first non-numeric token(s)
  // Weight is the remaining token(s) between exercise name and reps

  if (tokens.length === 0) {
    return { exerciseName: null, weight: null, reps, rawText };
  }

  // Find where exercise name ends and weight begins
  // Exercise name: leading text tokens (non-numeric)
  // Weight: anything after exercise name
  const nameTokens = [];
  const weightTokens = [];
  let foundNumeric = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    // Check if token looks like a number/weight
    if (!foundNumeric && /^\d/.test(token)) {
      foundNumeric = true;
    }
    // Check for intensity words like 중강도, 고강도, 저강도
    if (!foundNumeric && /강도$/.test(token)) {
      foundNumeric = true;
    }

    if (foundNumeric) {
      weightTokens.push(token);
    } else {
      nameTokens.push(token);
    }
  }

  exerciseName = nameTokens.join(' ') || null;
  weight = weightTokens.join(' ') || null;

  return { exerciseName, weight, reps, rawText };
}

module.exports = { parseWorkoutInput, koreanToNumber, replaceKoreanNumbers };
