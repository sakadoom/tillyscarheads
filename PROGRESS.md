# PROGRESS — Aplikasi Gantt Chart

Checklist fase dan acceptance dari blueprint. Item dicentang hanya setelah perintah
verifikasinya benar-benar dijalankan dan lolos. Semua hasil di bawah berasal dari sesi
pengembangan ini (bukan laporan lama).

## Fase

- [x] **Fase 0: Fondasi monorepo** — gate: `npm install` + `npm run typecheck` lolos.
- [x] **Fase 1: Mesin inti `shared`** — gate: `npm test -w shared` lolos (54 test, 7 file),
      termasuk seluruh vektor uji Bagian 6.11.
- [x] **Fase 2: Backend** — gate: `npm run typecheck -w server` + `npm test -w server` lolos
      (56 test, 8 file) dan `npm run db:seed` berhasil (17 tugas, 13 dependensi, 4 anggota, 2 libur).
- [x] **Fase 3: Frontend** — gate: typecheck, `npm test -w client` (20 test, 4 file), dan
      `npm run build -w client` lolos.
- [x] **Fase 4: Integrasi & verifikasi** — gate: `npm install`, `npm run typecheck`, `npm test`
      (130 test / 19 file), dan `npm run build` semuanya exit 0; `npm run dev` melayani
      `http://localhost:3001/api/health` (200) dan `http://localhost:5173` (200).
- [x] **Fase 5: Rapikan sebelum push** — README.md lengkap, `.gitignore` mengecualikan
      `node_modules`, `dist`, `coverage`, `.env*` (kecuali `.env.example`), `*.db`, `*.db-journal`,
      `*.log`, `.vite`; pemindaian rahasia bersih.
- [x] **Fase 6: Push ke GitHub** — commit awal `60941c8` pada branch `main` di
      <https://github.com/sakadoom/tillyscarheads.git> (113 berkas, tanpa `node_modules`, `.env`,
      database, atau artefak build); `git ls-remote` menunjukkan remote berada di commit yang sama.

## Acceptance checklist (Bagian 12)

Verifikasi lewat API (Supertest + curl ke `http://localhost:3001/api`) **dan** antarmuka
(Chrome headless dikendalikan lewat protokol DevTools: 30 pemeriksaan, 0 error konsol).

### Tugas

- [x] Tambah, ubah, dan hapus tugas berhasil — test Supertest (CRUD tugas, parent-child) dan
      lewat UI: dialog "Tambah tugas" membuat tugas (tersimpan di server), tombol "Ubah" mengganti
      nama, tombol hapus + konfirmasi menghapusnya, lalu jumlah tugas kembali 17.
- [x] Durasi, tanggal mulai, prioritas, dan warna tersimpan — PATCH lewat API dan dialog tugas
      mengembalikan nilai yang sama saat halaman dimuat ulang.
- [x] Sub-tugas (parent-child) bisa dibuat, dan induk menghitung rentang serta progres otomatis —
      test scheduler/summary; di seed, 5 tugas induk (Perencanaan 2026-10-19 → 2026-10-27, dst.)
      dihitung dari anaknya.

### Dependensi dan Gantt

- [x] Predecessor FS dan SS dengan lag mengubah posisi bar sesuai 6.4 dan vektor uji 6.11 —
      unit test `shared` untuk kelima vektor; jadwal seed cocok dengan vektor (2.1 SS lag 2 mulai
      2026-10-26, 4.1 SS lag 4 mulai 2026-11-10, 3.3 FS+SS mulai 2026-11-10).
- [x] Bar Gantt tampil, ada panah dependensi (FS dan SS), dan bar bisa di-drag serta di-resize —
      di browser: 12 bar daun + 5 bar induk, 13 panah (10 FS, 3 SS), drag menggeser jadwal
      terlihat (2026-11-10 → 2026-11-18) dan resize mengubah durasi (3 → 6 hari) dengan toast
      "Tanggal mulai tugas diperbarui" / "Durasi tugas diperbarui".
- [x] Dependensi yang membentuk siklus ditolak dengan pesan jelas — POST dependensi siklus
      membalas 422 `CYCLE_DETECTED` dengan pesan rantai tugasnya.

### Resource

- [x] Tambah anggota tim (nama, email, peran, gaji) dan alokasikan ke tugas — test Supertest
      resource + assignment; UI menampilkan 4 anggota seed beserta alokasinya.
- [x] Biaya dan peringatan over-alokasi muncul benar — total biaya seed Rp31.863.636 (sama di API
      dan halaman Analisis/Tim) dan peringatan "Budi Santoso teralokasi 150% pada 10 Nov 2026"
      (6 hari tumpang tindih 3.2 dan 3.3) tampil di halaman Tim.

### Kalender

- [x] Ubah akhir pekan dan tambah hari libur, lalu jadwal bergeser otomatis — menambah libur
      2026-10-26 lewat form halaman Kalender menggeser "Riset dan wireframe" 2026-10-26 → 2026-10-27
      dengan toast "Hari libur ditambahkan, jadwal diperbarui"; test Supertest kalender juga lolos.
- [x] Durasi tidak menghitung akhir pekan dan hari libur — unit test `shared` dan jadwal seed
      ("Skenario uji" 3 hari = 10, 12, 13 Nov karena 11 Nov libur).

### Analisis

- [x] Halaman Analisis menampilkan Critical Path dan diagram PERT, node kritis berwarna merah —
      halaman menampilkan 12 node dan 13 panah PERT, 9 dari 12 tugas daun kritis, jalur kritis
      9 tugas, dan 9 node bertanda kritis.

### Persistensi dan akun

- [x] Data tidak hilang saat halaman di-refresh (data berasal dari database) — refresh halaman
      Gantt/Analisis tetap menampilkan tugas dan diagram yang sama (data dari API).
- [x] Register, login, dan logout berfungsi, dan pengguna A tidak bisa melihat data pengguna B —
      login lewat form UI berhasil menyimpan token di `localStorage`; logout menghapus token dan
      mengembalikan ke `/login`; pengguna baru melihat 0 proyek dan akses ke proyek demo dibalas 404;
      rute terproteksi mengalihkan ke `/login` tanpa token.

### Repository

- [x] Ada folder `src` di tiap workspace, `package.json`, dan `README.md`.
- [x] `node_modules`, `.env`, dan file database tidak ikut ter-commit (lihat `.gitignore`;
      `.env.example`, `README.md`, dan `PROGRESS.md` tetap ikut).
- [x] `npm run typecheck`, `npm test`, dan `npm run build` lolos tanpa error
      (typecheck exit 0; 130 test lolos; build ketiga workspace exit 0).

## Temuan dan perbaikan

- **Bug ditemukan saat verifikasi UI**: drag bar memakai `startDate` (batas 'mulai paling awal')
  sebagai titik awal, bukan jadwal yang terlihat. Akibatnya bar tugas yang dibatasi dependensi
  tidak bergerak meski pengguna menggesernya. Diperbaiki di `client/src/components/gantt/drag.ts`
  (geseran dihitung dari `scheduledStart`, dalam hari kerja), dengan modul baru `drag.ts`
  mengikuti pola `timeline.ts`/`tree.ts`, plus 4 unit test regresi di `drag.test.ts`.
- **Catatan alat**: test komponen drag di jsdom tidak dapat memakai pointer event (jsdom belum
  menyediakan `PointerEvent`), jadi interaksi drag/resize diverifikasi di browser sungguhan
  lewat Chrome DevTools Protocol, dan matematikanya diuji sebagai fungsi murni.

## Catatan sesi

- Aplikasi dibangun di root folder kerja (bukan subfolder), sesuai instruksi
  "membangun aplikasi lengkap dari nol di folder kerja saat ini".
- Status git: branch `main` melacak `origin/main`, working tree bersih setelah push.
  Seluruh pekerjaan sudah ada di remote, bukan hanya lokal.
- `npm run db:seed` menghapus proyek contoh akun demo lalu membuatnya ulang, sehingga aman
  dijalankan berulang (diverifikasi dengan dua kali eksekusi berturut-turut).
