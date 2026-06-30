const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.jsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('D:/RACHE_TA/source_code/frontend/src/pages');
files.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  let match = content.match(/<div className="text-sm text-muted font-medium mb-1">/g);
  if (match && match.length > 1) {
    console.log(path.basename(file) + ' has ' + match.length + ' breadcrumbs!');
  }
  
  // check for other breadcrumb styles
  let match2 = content.match(/<div className="text-sm text-muted mb-2 font-medium"/g);
  if (match2 && match2.length > 0) {
    console.log(path.basename(file) + ' has old breadcrumb syntax!');
  }
});
