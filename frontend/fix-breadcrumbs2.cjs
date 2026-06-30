const fs = require('fs');

// 1. Fix InputLaporan.jsx
let inputContent = fs.readFileSync('D:/RACHE_TA/source_code/frontend/src/pages/laporan/InputLaporan.jsx', 'utf8');
const oldBreadcrumb = /<div className="text-sm text-muted mb-2 font-medium">[\s\S]*?<\/div>\s*<div className="page-header/g;
if (oldBreadcrumb.test(inputContent)) {
  inputContent = inputContent.replace(oldBreadcrumb, '<div className="page-header');
  fs.writeFileSync('D:/RACHE_TA/source_code/frontend/src/pages/laporan/InputLaporan.jsx', inputContent, 'utf8');
  console.log('Fixed InputLaporan.jsx');
} else {
  // Try another regex if it didn't match
  const altBreadcrumb = /<div className="text-sm text-muted mb-2 font-medium">[\s\S]*?<\/div>\s*<div/g;
  if (altBreadcrumb.test(inputContent)) {
    inputContent = inputContent.replace(altBreadcrumb, '<div');
    fs.writeFileSync('D:/RACHE_TA/source_code/frontend/src/pages/laporan/InputLaporan.jsx', inputContent, 'utf8');
    console.log('Fixed InputLaporan.jsx (alt regex)');
  }
}

// 2. Remove breadcrumbs from Dashboards
const dashboards = ['DashboardAdmin.jsx', 'DashboardUserUnit.jsx', 'DashboardIT.jsx'];
dashboards.forEach(file => {
  const p = `D:/RACHE_TA/source_code/frontend/src/pages/dashboard/${file}`;
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    const newBreadcrumbRegex = /<div className="text-sm text-muted font-medium mb-1">Dashboard <span className="mx-1">&gt;<\/span> <span className="text-primary">.*?<\/span><\/div>/g;
    
    if (newBreadcrumbRegex.test(content)) {
      content = content.replace(newBreadcrumbRegex, '<h2 className="page-title">Dashboard</h2>');
      fs.writeFileSync(p, content, 'utf8');
      console.log(`Removed breadcrumb from ${file} and restored title`);
    }
  }
});
