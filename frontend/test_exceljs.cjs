const ExcelJS = require('exceljs');

async function run() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('frontend/public/template.xlsx');
    
    const ws = workbook.getWorksheet('Data KNA');
    ws.getCell('A2').value = '2023-01-01';
    ws.getCell('B2').value = 1000;
    ws.getCell('C2').value = 800;
    ws.getCell('D2').value = 400;
    ws.getCell('E2').value = 400;
    
    await workbook.xlsx.writeFile('frontend/public/template_out.xlsx');
    console.log("Written template_out.xlsx");
}

run().catch(console.error);
