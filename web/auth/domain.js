export const domainPelanggan = Object.freeze(['gmail.com', 'unusa.ac.id', 'student.unusa.ac.id']);

export function emailPelangganValid(email) {
  const bagian = String(email).trim().toLowerCase().match(/^([^@\s]+)@([^@\s]+)$/u);
  return Boolean(bagian && domainPelanggan.includes(bagian[2]));
}
