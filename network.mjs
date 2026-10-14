import { isIP } from 'node:net';

export function isPrivateIPv4(address) {
  if (isIP(address) !== 4) return false;
  const [a,b] = address.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

export function bindAddresses(networkHost, interfaces) {
  if (networkHost === undefined) return ['127.0.0.1'];
  if (!isPrivateIPv4(networkHost)) throw new Error('Bitte eine konkrete private IPv4-Adresse oder VPN-Adresse (100.64.0.0/10) angeben.');
  const local = Object.values(interfaces).flat().some(item => item?.address === networkHost && !item.internal);
  if (!local) throw new Error(`Die Adresse ${networkHost} ist diesem Rechner nicht zugeordnet. Bitte zuerst das VPN verbinden oder die Heimnetzadresse wählen.`);
  return ['127.0.0.1', networkHost];
}

export function allowedHosts(addresses, port) {
  return new Set(['localhost', ...addresses].map(host => `${host}:${port}`));
}
