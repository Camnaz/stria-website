const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8');
const results = JSON.parse(input);
let critical = 0, high = 0, medium = 0;
let highByType = {}, mediumByType = {};
let highByPage = {}, mediumByPage = {};
results.forEach(r => {
  r.issues.forEach(i => {
    if (i.severity === 'critical') critical++;
    else if (i.severity === 'high') { high++; highByType[i.type] = (highByType[i.type] || 0) + 1; highByPage[r.page] = (highByPage[r.page] || 0) + 1; }
    else if (i.severity === 'medium') { medium++; mediumByType[i.type] = (mediumByType[i.type] || 0) + 1; mediumByPage[r.page] = (mediumByPage[r.page] || 0) + 1; }
  });
});
console.log('Critical:', critical);
console.log('High:', high);
console.log('Medium:', medium);
console.log('High by type:', JSON.stringify(highByType, null, 2));
console.log('Medium by type:', JSON.stringify(mediumByType, null, 2));
console.log('High by page:', JSON.stringify(highByPage, null, 2));
console.log('Medium by page:', JSON.stringify(mediumByPage, null, 2));