// Kunci tanggal berbasis KOMPONEN TANGGAL LOKAL (getFullYear/getMonth/getDate),
// BUKAN toISOString().slice(0,10) — toISOString() mengonversi ke UTC, yang
// menggeser tanggal mundur satu hari untuk timezone UTC+X (WIB/WITA/WIT)
// setiap kali jam lokal lebih pagi dari offset-nya (mis. sebelum jam 8 pagi
// WITA/UTC+8). Bug ini sebelumnya ada di lib/acwr.js & lib/calendarBuilder.js
// — dampaknya salah hari pada perhitungan ACWR & penempatan sesi di kalender.
function localDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = { localDateKey };
