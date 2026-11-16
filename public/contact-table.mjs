export const tableHeader = 'Ad\tTelefon numaraları\n';

export function contactRow({ name, numbers }) {
  const cell = value => value.replace(/[\t\r\n]+/g, ' ');
  return cell(name || 'İsimsiz kişi') + '\t' + numbers.map(cell).join(', ') + '\n';
}

export function contactTable(contacts) {
  return tableHeader + contacts.map(contactRow).join('');
}
