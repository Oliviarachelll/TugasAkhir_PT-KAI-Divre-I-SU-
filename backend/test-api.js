async function test() {
  try {
    const res = await fetch('http://localhost:5000/api/laporan/11/barang', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_komoditi: 10,
        jml_ka: 1,
        volume: 100,
        pendapatan: 5000,
        volume_kumulatif: 200,
        volume_program: 500,
        volume_pencapaian: 40,
        pendapatan_kumulatif: 10000,
        pendapatan_program: 20000,
        pendapatan_pencapaian: 50
      })
    });
    const data = await res.json();
    console.log("Success:", data);
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
