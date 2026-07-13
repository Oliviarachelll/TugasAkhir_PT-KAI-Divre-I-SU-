import xlsxwriter

workbook = xlsxwriter.Workbook('frontend/public/template.xlsx')

def create_sheet(name, cols, series_list):
    ws = workbook.add_worksheet(name)
    # Write headers
    for i, col in enumerate(cols):
        ws.write(0, i, col)
        
    chart = workbook.add_chart({'type': 'column'})
    
    # We will assume data goes from row 2 to 100
    for s in series_list:
        chart.add_series({
            'name':       f"='{name}'!${s['col_letter']}$1",
            'categories': f"='{name}'!$A$2:$A$100",
            'values':     f"='{name}'!${s['col_letter']}$2:${s['col_letter']}$100",
        })
        
    ws.insert_chart('G2', chart, {'x_scale': 1.5, 'y_scale': 1.5})

# KNA
create_sheet('Data KNA', 
    ['Tanggal', 'Target RKAD', 'Realisasi RKAD', 'Nilai ROW', 'Nilai Non-ROW'],
    [
        {'col_letter': 'B'},
        {'col_letter': 'C'}
    ])

# Keuangan
create_sheet('Data Keuangan', 
    ['Tanggal', 'Target RKAD', 'Realisasi RKAD', 'Pendapatan', 'Pengeluaran'],
    [
        {'col_letter': 'B'},
        {'col_letter': 'C'},
        {'col_letter': 'D'},
        {'col_letter': 'E'}
    ])

# Barang
create_sheet('Data Barang', 
    ['Tanggal', 'Pendapatan Barang', 'Volume Barang'],
    [
        {'col_letter': 'B'},
        {'col_letter': 'C'}
    ])

# Penumpang
create_sheet('Data Penumpang', 
    ['Tanggal', 'Pendapatan Penumpang', 'Volume Penumpang'],
    [
        {'col_letter': 'B'},
        {'col_letter': 'C'}
    ])

workbook.close()
print("Template created successfully.")
