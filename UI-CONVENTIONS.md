# UI Conventions — Atletik Pro Id

Dokumen ini adalah "buku aturan" untuk siapa pun (manusia atau AI) yang
mengedit `public/app.js`, `public/athlete.js`, `public/style.css`, atau
`public/athlete.css`. Tujuannya satu: **setiap kali ada perubahan UI, hasilnya
memakai pola yang sudah ada** — bukan menciptakan pola baru yang mirip tapi
sedikit beda.

> **Aturan #0, sebelum menulis satu baris CSS atau markup baru:**
> Cek dulu apakah komponen/token yang dibutuhkan sudah ada di dokumen ini.
> Kalau ada → pakai itu, jangan bikin varian baru. Kalau belum ada dan
> sungguh perlu → tambahkan ke dokumen ini di commit yang sama, supaya
> perubahan berikutnya bisa menemukan dan memakainya lagi.

---

## 1. Tiga permukaan UI aplikasi ini

| Permukaan | File | Device | Ditandai oleh |
|---|---|---|---|
| **Command Center** | `public/app.js` + `public/style.css` | PC / Laptop / Tablet | `html[data-ui="command"]` |
| **Mode Lapangan** | `public/app.js` + `public/style.css` | HP (pelatih) | `html[data-ui="field"]` |
| **Portal Atlet** | `public/athlete.js` + `public/athlete.css` | HP (atlet), satu-satunya versi | file terpisah, tidak ada cabang device |

Command Center dan Mode Lapangan berbagi **file JS & CSS yang sama**, tapi
render-nya adalah **dua pohon DOM yang terpisah total** (lihat
`renderApp()` di `app.js` — kalau `isCoachFieldMode()` true, fungsi
langsung `return renderCoachFieldMode()` dan tidak pernah menyentuh kode
Command Center). Ini **arsitektur yang benar** — jangan diubah jadi satu
markup responsif yang di-CSS-sembunyikan sebagian, karena itu justru bikin
dua mode saling mengganggu.

**Konsekuensi penting**: karena dua mode ini adalah pohon render terpisah,
**tidak ada mekanisme otomatis yang menjaga keduanya tetap sinkron**. Kalau
menambah fitur baru yang relevan untuk pelatih di lapangan, cek juga apakah
perlu ada padanannya di `renderCoachFieldMode()` dan turunannya
(`renderFieldHome`, `renderFieldAthlete`, `renderFieldWeek`,
`renderFieldLog`, `renderFieldTests`, `renderFieldMonitor`,
`renderFieldFeed`, `renderFieldMore`).

Deteksi device: `isMobileUi()` (media query `max-width: 640px`).
Pelatih bisa override manual lewat toggle yang menyimpan
`localStorage('coach-full-mobile')` — pengecekannya di
`isCoachFieldMode()`. Jangan buat mekanisme deteksi device baru di
tempat lain; selalu panggil `isMobileUi()` / `isCoachFieldMode()`.

---

## 2. Design tokens (CSS variables) — WAJIB dipakai, jangan hardcode

Semua warna, radius, dan shadow **harus** lewat variable di bawah ini.
**Jangan pernah menulis kode hex baru langsung di sebuah class**, kecuali
untuk warna sekali-pakai yang sungguh tidak representasional (jarang
terjadi).

```css
/* Brand */
--primary, --primary-dark, --primary-light, --on-primary

/* Neutrals */
--bg, --surface, --surface-2, --border, --text, --text-muted

/* Status (dipakai lintas konteks: alert, badge, dsb) */
--success, --success-bg, --warn, --warn-bg, --danger, --danger-bg

/* Fase periodisasi */
--umum, --umum-bg, --khusus, --khusus-bg, --puncak, --puncak-bg,
--transisi, --transisi-bg

/* Kategori atletik (badge, pill kalender) */
--cat-sprint, --cat-sprint-bg, --cat-menengah, --cat-menengah-bg,
--cat-jauh, --cat-jauh-bg, --cat-lompat, --cat-lompat-bg

/* Gauge ACWR */
--acwr-low, --acwr-safe, --acwr-caution, --acwr-risk

/* Radius & shadow */
--radius (10px), --radius-lg (16px), --shadow-sm, --shadow-md
```

Semua token di atas punya versi `dark theme` otomatis (lewat
`prefers-color-scheme` dan `[data-theme="dark"]`) — jangan pernah menulis
warna kondisional dark-mode manual di tempat lain, cukup pakai variable-nya
dan dark mode otomatis ikut benar.

### ⚠️ Utang teknis yang sudah ada — jangan ditambah, dan rapikan kalau sempat

`style.css` saat ini punya **dua set token radius/shadow yang bersaing**,
didefinisikan di dua blok `:root {}` terpisah (baris ~1 dan ~1712):

- Set lama: `--radius`, `--radius-lg`, `--shadow-sm`, `--shadow-md`
- Set baru (ditambahkan belakangan, bukan menyatu dengan yang lama):
  `--radius-xl` (20px), `--shadow-card`

Akibatnya `.card` didefinisikan **dua kali** (baris ~183 dan ~1966) dengan
radius/shadow berbeda — definisi kedua yang menang karena urutan CSS.
`.session-card` bahkan didefinisikan **tiga kali** dengan padding dan
border-radius yang tidak sama satu sama lain.

**Aturan ke depan**: jangan tambah token radius/shadow baru lagi.
Pakai `--radius-lg` + `--shadow-sm`/`--shadow-md` untuk kartu standar. Kalau
suatu saat dirapikan, gabungkan `--radius-xl`/`--shadow-card` ke dalam satu
skala saja dan hapus definisi `.card`/`.session-card` yang duplikat.

---

## 3. Komponen primitif JS yang harus dipakai ulang

Sebelum menulis `el('div', {...}, [...])` panjang untuk sesuatu yang
tampak seperti pola berulang, cek dulu apakah salah satu helper ini sudah
menutupinya:

| Helper | Fungsi | Lokasi |
|---|---|---|
| `el(tag, attrs, children)` | Pengganti `document.createElement` — **satu-satunya** cara bikin elemen di app ini | `app.js` |
| `icon(name, extraClass)` | Render ikon SVG inline dari katalog `ICON_SHAPES` — **jangan** tempel SVG mentah baru di tengah kode; tambahkan shape baru ke `ICON_SHAPES` kalau ikon belum ada | `app.js` |
| `iconBadge(name, tone)` | Ikon dibungkus badge lingkaran berwarna | `app.js` |
| `emptyIllustration(iconName)` | Ilustrasi empty-state, dibangun dari shape ikon yang sudah ada — jangan bikin ilustrasi/aset baru | `app.js` |
| `fieldNavCard(title, sub, ic, onClick)` | Kartu navigasi khusus Mode Lapangan | `app.js` |
| `renderFieldShell(title, bodyChildren, opts)` | Kerangka halaman Mode Lapangan (topbar + body) — semua `renderField*` harus dibungkus ini | `app.js` |
| `showToast(message, kind)` | Notifikasi sekali-tampil — jangan bikin sistem alert/toast baru | `app.js` |
| `tip(text)` | Tooltip via atribut `title` | `app.js` |
| `buildLineChart(...)` / `buildBarChart(...)` | Chart SVG — semua grafik tren di app ini harus lewat sini, jangan gambar SVG chart manual di tempat lain | `app.js` |
| `statTile({value, unit, label, sub, ic, variant, big})` | Kartu stat ikon+angka (dulu khusus Nutrisi sebagai `nutritionTargetTile`, kini dipakai lintas tab — Jadwal/Tes/Monitor/Feed/Nutrisi — supaya angka ringkasan selalu tampil konsisten). Bungkus beberapa dengan `class: 'portal-tiles'` untuk grid sejajar. Dulu tab-tab non-Nutrisi pakai `.info-chip` polos tanpa ikon/warna untuk hal ini — jangan tambah pemakaian `.info-chip` baru untuk angka ringkasan, pakai `statTile` | `app.js` |

Kalau kebutuhan UI baru "hampir mirip" salah satu di atas, **perluas
helper yang ada** (tambah parameter/opsi) daripada menyalin isinya jadi
fungsi baru dengan nama berbeda.

---

## 4. Konvensi penamaan class per permukaan

| Prefix | Area | Contoh |
|---|---|---|
| `field-*` | Mode Lapangan (semua halaman `renderField*`) | `field-shell`, `field-card`, `field-topbar` |
| `cmd-*` | Elemen yang secara eksplisit khusus tampilan Command Center | `cmd-identity-mobile` |
| `rail-*` | Navigasi kiri Command Center | `rail-item`, `rail-section-label` |
| `mod-*` | Panel modul di dalam detail atlet (form/grafik split) | `mod-chart-card`, `mod-h` |
| `sched-*` | Tab jadwal/kalender program | `sched-head-card`, `sched-timeline` |
| `portal-*` | **Dashboard HQ pelatih** (`renderCoachPortal()`) — bukan Portal Atlet, penamaan ini agak menjebak, jangan bingung dengan `athlete.js` | `portal-today`, `portal-near-comp` |
| `badge-*` | Badge status/kategori/fase — selalu pasangkan dengan token warna di §2 | `badge-risk`, `badge-cat-sprint` |
| `acwr-*` | Elemen gauge/status ACWR | `acwr-safe`, `acwr-risk` |
| `landing-*` | Halaman landing publik (sebelum login) | `landing-feature-card` |
| `plan-*` | Modal pemilihan paket/pembayaran | `plan-modal` |

**Kartu (card)**: dasarnya selalu class `.card`, ditambah SATU class
modifier spesifik konteks kalau perlu override kecil — pola yang benar:

```js
el('div', { class: 'card program-phase-card' }, [...])
```

**Jangan** membuat class `*-card` baru yang mendefinisikan ulang
`background`/`border`/`radius`/`shadow` dari nol (lihat utang teknis di
§2 — `.session-card` dan `.stat-card` adalah contoh yang seharusnya
dihindari ke depannya, walau saat ini sudah terlanjur begitu).

**Tombol**: dasarnya elemen `<button>` polos (sudah distyle global) +
modifier: `.secondary`, `.danger`, `.link`, `.icon-btn`, `.pill-btn`.
Jangan bikin class tombol baru untuk warna/variant yang sudah ada di
daftar ini.

**Badge**: dasarnya `.badge` + satu modifier warna (`.badge-umum`,
`.badge-risk`, `.badge-cat-sprint`, dst). Kalau butuh warna status baru,
tambah variable token dulu di §2, baru buat class `.badge-<nama>` yang
memetakan ke token itu — jangan tempel warna langsung di `.badge-<nama>`.

---

## 5. Checklist sebelum submit perubahan UI

1. [ ] Tidak ada hex warna baru yang ditempel langsung — semua lewat CSS variable di §2.
2. [ ] Tidak ada shape SVG mentah ditempel di JS — ikon baru ditambahkan ke `ICON_SHAPES`.
3. [ ] Kartu baru pakai `class="card <modifier>"`, bukan definisi CSS dari nol.
4. [ ] Class baru mengikuti prefix area yang relevan di §4.
5. [ ] Kalau fitur ini relevan untuk pelatih di lapangan: sudah dicek/ditambahkan padanannya di `renderCoachFieldMode()`.
6. [ ] Kalau menambah komponen berulang (dipakai >1 tempat): dibuat sebagai fungsi helper baru di §3, bukan disalin-tempel.
7. [ ] Dokumen ini diperbarui kalau menambah token/prefix/helper baru.
