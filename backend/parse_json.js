const fs = require('fs'); const data = JSON.parse(fs.readFileSync('output.json', 'utf8')); console.log(data[0].question.substring(0, 500));
