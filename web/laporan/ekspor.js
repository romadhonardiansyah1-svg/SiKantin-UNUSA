import { strToU8, zipSync } from '../vendor/fflate-0.8.3.js';
import { aspek } from '../publik/katalog.js';

const xmlEscape = value => String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
  .replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
const awalan = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const excel = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const relasi = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const paket = 'http://schemas.openxmlformats.org/package/2006/';

export function buatXlsx(laporan, periode, waktu) {
  const s = laporan.statistik;
  const rows = [
    ['Laporan Evaluasi SiKantin UNUSA'],
    ['Periode', periode], ['Dicetak (WIB)', waktu],
    ['Jumlah ulasan', s.jumlah], ['Skor rerata', s.nilai],
    ['Aspek', 'Skor'], ...aspek.map((nama,i) => [nama,s.aspek[i]]), [],
    ['Tenant','Kampus','Kode stan','Pemilik',...aspek,'Skor rerata','Jumlah ulasan'],
    ...laporan.per_tenant.map(t => [t.nama,t.kampus,t.kode_stand,t.pemilik,
      ...t.statistik.aspek,t.statistik.nilai,t.statistik.jumlah]), [],
    ['Menu','Tenant','Jumlah ulasan','Skor rerata'],
    ...laporan.menu.map(m => [m.nama,m.tenant,m.jumlah,m.nilai]), [],
    ['Ulasan terbaru','Waktu (WIB)','Status pengunjung','Skor','Komentar'],
    ...laporan.ulasan.map(u => [u.tenant, new Date(u.waktu).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }), u.status,u.nilai,u.komentar])
  ];
  const cell = (value, alamat) => {
    if (value == null) return '<c r="' + alamat + '"/>';
    if (typeof value === 'number') return '<c r="' + alamat + '"><v>' + value + '</v></c>';
    return '<c r="' + alamat + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEscape(value) + '</t></is></c>';
  };
  const sheet = rows.map((r,i) => '<row r="' + (i + 1) + '">' +
    r.map((v,j) => cell(v,String.fromCharCode(65 + j) + (i + 1))).join('') + '</row>').join('');
  const documents = {
    '[Content_Types].xml': '<Types xmlns="' + paket + 'content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="' + paket + 'relationships"><Relationship Id="rId1" Type="' + relasi +
      '/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<workbook xmlns="' + excel + '" xmlns:r="' + relasi + '">' +
      '<sheets><sheet name="Evaluasi" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="' + paket + 'relationships"><Relationship Id="rId1" Type="' +
      relasi + '/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': '<worksheet xmlns="' + excel + '"><sheetData>' + sheet + '</sheetData></worksheet>'
  };
  return zipSync(Object.fromEntries(Object.entries(documents).map(([path,xml]) => [path,strToU8(awalan + xml)])));
}
