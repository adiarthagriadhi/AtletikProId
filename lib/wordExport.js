const { Document, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType, Packer } = require('docx');
const { CATEGORIES } = require('./categories');

function fmtDateID(str) {
  if (!str) return '-';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtClock(sec) {
  if (sec == null) return '-';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function sessionText(s) {
  const parts = [];
  if (s.mode === 'reps') {
    parts.push(`Zona ${s.zone} (${s.zoneLabel}) — ${s.reps} × ${s.repDist}m, target waktu/rep ${s.repTimeLabel}, istirahat ${s.restSec} detik, volume ${s.volume}m`);
  } else if (s.mode === 'duration') {
    parts.push(`Zona ${s.zone} (${s.zoneLabel}) — ${s.durMin} menit @ pace ${s.paceLabel}${s.estDistKm != null ? `, estimasi jarak ${s.estDistKm} km` : ''}`);
  } else if (s.mode === 'approach' || (s.reps != null && s.dist != null)) {
    parts.push(`${s.reps} × ${s.dist}m — target waktu ${s.timeLabel}, istirahat ${s.restMin}-${s.restMax} menit, volume ${s.volume}m`);
  } else if (s.mode === 'teknik') {
    parts.push(`${s.reps} repetisi drill teknik`);
  } else if (s.mode === 'kekuatan') {
    parts.push(`${s.sets} set × ${s.repsPerSet} repetisi`);
  } else if (s.durationMin != null) {
    parts.push(`Durasi: ${s.durationMin} menit`);
  }
  if (s.targetRPE != null) parts.push(`Target RPE (Borg CR10): ${s.targetRPE}`);
  return parts.join(' · ');
}

function heading(text, level) {
  return new Paragraph({ text, heading: level, spacing: { before: 200, after: 100 } });
}

function bulletList(items) {
  return items.map((text) => new Paragraph({ text, bullet: { level: 0 } }));
}

function cell(text, opts = {}) {
  return new TableCell({
    width: { size: opts.width || 2000, type: WidthType.DXA },
    shading: opts.header ? { type: ShadingType.CLEAR, fill: 'E2E5EA' } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text: String(text ?? '-'), bold: !!opts.header })] })],
  });
}

// Thresholds sama persis dengan acwrStatusInfo() di public/app.js (tab
// Monitoring) — dua tempat ini sengaja tidak disatukan lewat modul bersama
// karena app.js jalan di browser tanpa bundler (tidak bisa require() modul
// Node ini), jadi angka ambang batasnya dikomentari di kedua sisi supaya
// gampang dicek tetap sinkron kalau salah satunya berubah.
function acwrStatusText(info) {
  if (!info || !info.eligible || info.acwr == null) {
    const days = info ? info.daysOfHistory : 0;
    const remaining = Math.max(0, 14 - days);
    return {
      badge: 'Belum eligible',
      detail: days === 0
        ? 'Belum ada log monitoring.'
        : `Riwayat monitoring baru ${days} hari — butuh ${remaining} hari lagi (minimal 14 hari) sebelum status ACWR aktif.`,
    };
  }
  const v = info.acwr;
  if (v < 0.8) return { badge: 'Undertraining', detail: `ACWR ${v.toFixed(2)} — beban akut masih rendah dibanding kronik.` };
  if (v <= 1.3) return { badge: 'Sweet spot (Aman)', detail: `ACWR ${v.toFixed(2)} — rasio beban ideal, risiko cedera relatif rendah.` };
  if (v <= 1.5) return { badge: 'Waspada', detail: `ACWR ${v.toFixed(2)} — beban akut mulai tinggi, pantau pemulihan & jangan lonjakkan volume.` };
  return { badge: 'Risiko tinggi', detail: `ACWR ${v.toFixed(2)} > 1.5 — prioritaskan recovery & kurangi intensitas.` };
}

function monitoringLogsTable(logs) {
  const headers = ['Tanggal', 'RPE', 'Durasi', 'Load', 'Catatan'];
  const widths = [1600, 1000, 1400, 1400, 4200];
  const headerRow = new TableRow({ children: headers.map((h, i) => cell(h, { header: true, width: widths[i] })) });
  const dataRows = logs.map((m) => new TableRow({
    children: [
      cell(fmtDateID(m.date), { width: widths[0] }),
      cell(m.rpe != null ? String(m.rpe) : '-', { width: widths[1] }),
      cell(m.durationMin != null ? `${m.durationMin} mnt` : '-', { width: widths[2] }),
      cell(m.rpe != null && m.durationMin != null ? String(m.rpe * m.durationMin) : '-', { width: widths[3] }),
      cell(m.note || '-', { width: widths[4] }),
    ],
  }));
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...dataRows],
  });
}

function wellnessTable(logs) {
  const headers = ['Tanggal', 'Tidur', 'Kesiapan', 'Nyeri', 'Catatan'];
  const widths = [1600, 1400, 1400, 1800, 3400];
  const headerRow = new TableRow({ children: headers.map((h, i) => cell(h, { header: true, width: widths[i] })) });
  const dataRows = logs.map((w) => new TableRow({
    children: [
      cell(fmtDateID(w.date), { width: widths[0] }),
      cell(w.sleepQuality != null ? `${w.sleepQuality}/5` : '-', { width: widths[1] }),
      cell(w.readiness != null ? `${w.readiness}/10` : '-', { width: widths[2] }),
      cell(w.painScore != null ? `${w.painScore}/10${w.painLocation ? ' · ' + w.painLocation : ''}` : '-', { width: widths[3] }),
      cell(w.note || '-', { width: widths[4] }),
    ],
  }));
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...dataRows],
  });
}

function injuriesTable(injuries) {
  const headers = ['Tanggal', 'Lokasi', 'Skor', 'Status'];
  const widths = [1600, 3200, 1200, 2600];
  const headerRow = new TableRow({ children: headers.map((h, i) => cell(h, { header: true, width: widths[i] })) });
  const dataRows = injuries.map((i) => new TableRow({
    children: [
      cell(fmtDateID((i.onsetDate || i.createdAt || '').slice(0, 10)), { width: widths[0] }),
      cell(i.location || '-', { width: widths[1] }),
      cell(i.score != null ? `${i.score}/10` : '-', { width: widths[2] }),
      cell(i.status || '-', { width: widths[3] }),
    ],
  }));
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...dataRows],
  });
}

const MEAL_SLOT_LABEL = {
  breakfast: 'Sarapan',
  pre: 'Sebelum latihan',
  post: 'Setelah latihan',
  dinner: 'Makan malam',
};

function dayMenuTable(day) {
  const headers = ['Waktu Makan', 'Bahan', 'Gram', 'Kkal'];
  const widths = [2200, 3800, 1200, 1400];
  const headerRow = new TableRow({ children: headers.map((h, i) => cell(h, { header: true, width: widths[i] })) });
  const rows = [];
  (day.slots || []).forEach((slot) => {
    const label = MEAL_SLOT_LABEL[slot.key] || slot.label;
    (slot.items || []).forEach((it, idx) => {
      rows.push(new TableRow({
        children: [
          cell(idx === 0 ? label : '', { width: widths[0] }),
          cell(it.name, { width: widths[1] }),
          cell(`${it.grams} g`, { width: widths[2] }),
          cell(String(it.kcal), { width: widths[3] }),
        ],
      }));
    });
  });
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...rows],
  });
}

function testHistoryTable(protocol, tests) {
  let headers, widths, rowFor;

  if (protocol === 'time_trial') {
    headers = ['Tanggal', 'Label', 'Jarak TT', 'Waktu TT', 'VDOT'];
    widths = [1600, 2400, 1600, 1600, 1400];
    rowFor = (t) => [fmtDateID(t.date), t.label || '-', t.ttDistance != null ? `${t.ttDistance} m` : '-', fmtClock(t.ttTimeSec), t.vdot != null ? t.vdot.toFixed(1) : '-'];
  } else if (protocol === 'jump') {
    headers = ['Tanggal', 'Label', 'SLJ', 'Vertical Jump', 'Prestasi Lomba'];
    widths = [1600, 2400, 1600, 1800, 1800];
    rowFor = (t) => [fmtDateID(t.date), t.label || '-', t.sljDistance != null ? `${t.sljDistance} cm` : '-', t.vjHeight != null ? `${t.vjHeight} cm` : '-', t.compMark != null ? `${t.compMark} m` : '-'];
  } else {
    headers = ['Tanggal', 'Label', 'VO2', 'RAST Power', 'Fatigue Index'];
    widths = [1600, 2200, 1400, 2000, 2000];
    rowFor = (t) => [
      fmtDateID(t.date), t.label || '-', t.vo2max != null ? String(t.vo2max) : '-',
      t.rast ? `${t.rast.relPower.toFixed(1)} W/kg (${t.rast.relPowerTier || '-'})` : '-',
      t.rast ? `${t.rast.fatigueIndex.toFixed(1)} W/s (${t.rast.fatigueTier || '-'})` : '-',
    ];
  }

  const headerRow = new TableRow({ children: headers.map((h, i) => cell(h, { header: true, width: widths[i] })) });
  const dataRows = tests.map((t) => new TableRow({ children: rowFor(t).map((v, i) => cell(v, { width: widths[i] })) }));

  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...dataRows],
  });
}

/**
 * Susun "Laporan Lengkap" Word untuk satu atlet — dipakai sebagai rujukan
 * periodik (evaluasi berkala, dibagikan ke orang tua/wali, atau arsip
 * klub), jadi SEMUA modul yang sudah dicatat sistem disertakan, bukan cuma
 * potongan Program seperti versi sebelumnya:
 *   1. Profil & periodisasi          5. Riwayat Tes LENGKAP (bukan 8 terakhir)
 *   2. Prediksi waktu lomba          6. Monitoring & tren ACWR
 *   3. Personalisasi                 7. Nutrisi (target + menu minggu berjalan)
 *   4. Sesi latihan minggu ini       8. Feed & riwayat cedera/keluhan
 *      + bank kekuatan + checklist
 * `programData` = hasil lib/programAssembler.js, `tests` = riwayat tes
 * ter-hydrate (lib/testValidation.js hydrateTest, urut terbaru dulu),
 * `monitoring` = { logs, acwr } dari data.monitoringLogs + lib/acwr.js,
 * `nutritionPlan` = hasil lib/nutritionEngine.js computeNutritionPlan,
 * `weekMenu` = hasil lib/nutritionWeekPlan.js summarizeForClient,
 * `feedData` = { wellness, injuries } milik atlet (lihat routes/athletes.js
 * endpoint /:id/athlete-feed untuk sumber & urutan yang sama).
 */
function buildFullReportDocx({ athlete, programData, tests, monitoring, nutritionPlan, weekMenu, feedData }) {
  const catDef = CATEGORIES[athlete.profile.kategori];
  const catLabel = catDef ? catDef.label : athlete.profile.kategori;
  const protocol = catDef ? catDef.testProtocol : 'sprint';

  const children = [
    new Paragraph({ text: athlete.profile.nama, heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [new TextRun({ text: `${catLabel} ${athlete.profile.event} · ${fmtDateID(athlete.periodization.startDate)} → ${fmtDateID(athlete.periodization.compDate)}`, color: '6B7280' })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Laporan Lengkap · dibuat ${fmtDateID(new Date().toISOString().slice(0, 10))}`, color: '9CA3AF', size: 18 })],
      spacing: { after: 200 },
    }),
  ];

  children.push(heading('Fase Periodisasi Saat Ini', HeadingLevel.HEADING_1));
  if (programData.phase && programData.phase.phase) {
    children.push(new Paragraph({ text: programData.phase.label, spacing: { after: 60 } }));
    if (programData.phase.remainingWeeks != null) {
      children.push(new Paragraph({ text: `Sisa waktu ke kompetisi: ${programData.phase.remainingWeeks} minggu.`, spacing: { after: 60 } }));
    }
    if (programData.weekPlan) {
      children.push(new Paragraph({ text: `Kurva mingguan: ${programData.weekPlan.label} (faktor volume ×${programData.weekPlan.factor})`, spacing: { after: 100 } }));
    }
  } else {
    children.push(new Paragraph({ text: programData.note || 'Periodisasi belum lengkap.' }));
  }

  if (programData.racePrediction) {
    const rp = programData.racePrediction;
    children.push(heading('Prediksi Waktu Lomba', HeadingLevel.HEADING_1));
    children.push(new Paragraph({ text: `Dari VDOT ${rp.vdot.toFixed(1)}, estimasi waktu ${rp.event}: ${fmtClock(rp.predictedSec)}.`, spacing: { after: 100 } }));
  }

  if (programData.personalization) {
    const pz = programData.personalization;
    children.push(heading('Personalisasi', HeadingLevel.HEADING_1));
    children.push(new Paragraph({ text: `Level Prestasi: ×${pz.level.multiplier} (${pz.level.label || pz.level.note || 'belum ada data'})`, spacing: { after: 40 } }));
    children.push(new Paragraph({ text: `Risiko ACWR: ×${pz.risk.multiplier} (${pz.risk.note || 'tidak ada risiko terdeteksi'})`, spacing: { after: 40 } }));
    children.push(new Paragraph({ text: `Total Pengali Volume: ×${pz.multiplier.toFixed(2)}`, spacing: { after: 100 } }));
  }

  if (programData.sessions && programData.sessions.length) {
    children.push(heading('Sesi Latihan Minggu Ini', HeadingLevel.HEADING_1));
    programData.sessions.forEach((s) => {
      const title = `${s.label || 'Sesi'} — ${s.name || ''}`;
      const titleRuns = [new TextRun({ text: title, bold: true })];
      if (s.override && s.override.manual) {
        titleRuns.push(new TextRun({ text: '  [Manual / Override]', bold: true, color: 'B45309' }));
      }
      children.push(new Paragraph({ children: titleRuns, spacing: { before: 100 } }));
      if (s.day) children.push(new Paragraph({ text: String(s.day), spacing: { after: 20 } }));
      if (s.goal) children.push(new Paragraph({ text: s.goal, spacing: { after: 20 } }));
      if (s.override && s.override.note) {
        children.push(new Paragraph({ text: `Catatan pelatih: ${s.override.note}`, spacing: { after: 20 } }));
      }
      const detail = sessionText(s);
      if (detail) children.push(new Paragraph({ text: detail, spacing: { after: 20 } }));
      if (s.targetRPE != null) {
        children.push(new Paragraph({ text: `Target RPE: ${s.targetRPE}`, spacing: { after: 20 } }));
      }
      if (s.durationMin != null) {
        children.push(new Paragraph({ text: `Durasi: ${s.durationMin} menit`, spacing: { after: 20 } }));
      }
      if (s.volume != null) {
        children.push(new Paragraph({ text: `Volume: ${s.volume} m`, spacing: { after: 40 } }));
      }
    });
  }

  if (programData.strengthBank && programData.strengthBank.length) {
    children.push(heading('Bank Gerakan Kekuatan', HeadingLevel.HEADING_1));
    children.push(...bulletList(programData.strengthBank));
  }

  if (programData.techniqueChecklist && programData.techniqueChecklist.length) {
    children.push(heading('Checklist Teknik', HeadingLevel.HEADING_1));
    children.push(...bulletList(programData.techniqueChecklist));
  }

  if (tests && tests.length) {
    children.push(heading('Riwayat Tes Lengkap', HeadingLevel.HEADING_1));
    children.push(new Paragraph({ text: `${tests.length} entri tes tercatat, terbaru di atas.`, spacing: { after: 100 } }));
    children.push(testHistoryTable(protocol, tests));
  }

  // --- Monitoring & tren ACWR ---
  if (monitoring) {
    children.push(heading('Monitoring & Tren ACWR', HeadingLevel.HEADING_1));
    const status = acwrStatusText(monitoring.acwr);
    children.push(new Paragraph({
      children: [new TextRun({ text: `Status ACWR: ${status.badge}`, bold: true })],
      spacing: { after: 40 },
    }));
    children.push(new Paragraph({ text: status.detail, spacing: { after: 100 } }));
    if (monitoring.logs && monitoring.logs.length) {
      children.push(new Paragraph({ text: `${monitoring.logs.length} log monitoring pasca-latihan tercatat, terbaru di atas.`, spacing: { after: 100 } }));
      children.push(monitoringLogsTable(monitoring.logs));
    } else {
      children.push(new Paragraph({ text: 'Belum ada log monitoring pasca-latihan tercatat.', spacing: { after: 100 } }));
    }
  }

  // --- Nutrisi (target harian + menu minggu berjalan) ---
  if (nutritionPlan) {
    children.push(heading('Nutrisi', HeadingLevel.HEADING_1));
    if (!nutritionPlan.available) {
      children.push(new Paragraph({ text: nutritionPlan.reason || 'Rencana nutrisi belum bisa dihitung — profil atlet belum lengkap.', spacing: { after: 100 } }));
    } else {
      const t = nutritionPlan.targets || {};
      if (nutritionPlan.ringkasanSingkat) {
        children.push(new Paragraph({ children: [new TextRun({ text: nutritionPlan.ringkasanSingkat, bold: true })], spacing: { after: 60 } }));
      }
      const targetLine = [
        t.kaloriKcalPerHari != null ? `${Math.round(t.kaloriKcalPerHari)} kkal/hari` : null,
        t.karbohidratGramPerHari != null ? `Karbo ${t.karbohidratGramPerHari} g` : null,
        t.proteinGramPerHari != null ? `Protein ${t.proteinGramPerHari} g` : null,
        t.lemakPersenKalori != null ? `Lemak ${t.lemakPersenKalori}%` : null,
        t.airLiterPerHari != null ? `Air ${t.airLiterPerHari} L` : null,
      ].filter(Boolean).join(' · ');
      if (targetLine) children.push(new Paragraph({ text: targetLine, spacing: { after: 60 } }));
      if (nutritionPlan.peringatanKhusus && nutritionPlan.peringatanKhusus.length) {
        children.push(...nutritionPlan.peringatanKhusus.map((w) => new Paragraph({
          children: [new TextRun({ text: w, color: 'B45309' })], spacing: { after: 40 },
        })));
      }
      if (weekMenu && weekMenu.days && weekMenu.days.length) {
        children.push(new Paragraph({
          text: `Menu Minggu Ini (${fmtDateID(weekMenu.weekStart)} – ${fmtDateID(weekMenu.weekEnd)})`,
          heading: HeadingLevel.HEADING_2, spacing: { before: 120, after: 60 },
        }));
        if (weekMenu.injuryPackage) {
          children.push(new Paragraph({
            children: [new TextRun({ text: `Paket menu pemulihan cedera aktif s/d ${fmtDateID(weekMenu.injuryPackage.end)}${weekMenu.injuryPackage.location ? ` (${weekMenu.injuryPackage.location})` : ''}.`, color: 'B45309' })],
            spacing: { after: 80 },
          }));
        }
        weekMenu.days.forEach((day) => {
          if (!day.available) return;
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${fmtDateID(day.date)}${day.date === weekMenu.today ? ' (hari ini)' : ''}`, bold: true }),
              new TextRun({ text: `  ~${day.totals ? day.totals.kcal : '-'} kkal${day.mode === 'recovery' ? ' · mode pemulihan' : ''}`, color: '6B7280' }),
            ],
            spacing: { before: 80, after: 40 },
          }));
          children.push(dayMenuTable(day));
        });
      } else if (nutritionPlan.contohMenuHarian && nutritionPlan.contohMenuHarian.length) {
        // Fallback kalau menu minggu belum tersedia (mis. gagal disusun) —
        // tetap tampilkan contoh menu generik lama supaya laporan tidak kosong.
        children.push(new Paragraph({ text: 'Contoh menu harian', heading: HeadingLevel.HEADING_2, spacing: { before: 120, after: 60 } }));
        children.push(...nutritionPlan.contohMenuHarian.map((m) => new Paragraph({ text: m, spacing: { after: 20 } })));
      }
      if (nutritionPlan.sumberPedoman) {
        children.push(new Paragraph({ children: [new TextRun({ text: nutritionPlan.sumberPedoman, italics: true, color: '9CA3AF', size: 18 })], spacing: { before: 80 } }));
      }
    }
  }

  // --- Feed (input mandiri atlet) & riwayat cedera/keluhan ---
  if (feedData) {
    children.push(heading('Feed & Riwayat Cedera', HeadingLevel.HEADING_1));
    children.push(new Paragraph({ text: 'Check-in Mandiri Atlet', heading: HeadingLevel.HEADING_2, spacing: { before: 60, after: 60 } }));
    if (feedData.wellness && feedData.wellness.length) {
      children.push(new Paragraph({ text: `${feedData.wellness.length} check-in tercatat dari aplikasi atlet, terbaru di atas.`, spacing: { after: 80 } }));
      children.push(wellnessTable(feedData.wellness));
    } else {
      children.push(new Paragraph({ text: 'Atlet belum terhubung ke aplikasi, atau belum ada check-in.', spacing: { after: 100 } }));
    }
    children.push(new Paragraph({ text: 'Riwayat Keluhan / Cedera', heading: HeadingLevel.HEADING_2, spacing: { before: 120, after: 60 } }));
    if (feedData.injuries && feedData.injuries.length) {
      children.push(injuriesTable(feedData.injuries));
    } else {
      children.push(new Paragraph({ text: 'Tidak ada keluhan/cedera tercatat.' }));
    }
  }

  return new Document({
    sections: [{ properties: {}, children }],
  });
}

async function fullReportDocxBuffer(args) {
  const doc = buildFullReportDocx(args);
  return Packer.toBuffer(doc);
}

module.exports = { buildFullReportDocx, fullReportDocxBuffer };
