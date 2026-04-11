/**
 * normalizePhoneForSend — Normaliza número para envio via Evolution API / Z-API.
 *
 * Regras:
 *  1. Remove tudo que não é dígito (incluindo + e espaços)
 *  2. Remove 0 inicial (formato local BR: 011..., 035... → 11..., 35...)
 *  3. Se 10 ou 11 dígitos (sem DDI) → presume Brasil e adiciona 55
 *  4. Se já começa com 55 e tem 12-13 dígitos → correto, mantém
 *  5. Demais casos → retorna como está (internacional)
 *
 * Exemplos:
 *   +035988361300  → 5535988361300
 *   +011944978828  → 5511944978828
 *   8198117531     → 558198117531
 *   5511987654321  → 5511987654321 (sem alteração)
 */
export function normalizePhoneForSend(phone: string): string {
  if (!phone) return phone
  let d = phone.replace(/\D/g, '')
  if (!d) return phone
  // Remove 0 inicial de formatos locais brasileiros (0DDD...)
  if (d.startsWith('0') && d.length >= 11) d = d.slice(1)
  // Número sem DDI (10 ou 11 dígitos com DDD) → adiciona 55
  if (d.length === 10 || d.length === 11) d = '55' + d
  return d
}

/**
 * brPhoneVariants — Gera variantes com/sem o 9º dígito para números brasileiros.
 *
 * A Evolution API (e Z-API) pode entregar o número com ou sem o 9 extra
 * dependendo da versão do protocolo. Essa função normaliza ambas as formas
 * para que lookups de leads e deduplicação funcionem corretamente.
 *
 * Exemplos:
 *   5511987654321  → ["5511987654321", "551187654321"]   (13 dígitos → remove 9)
 *   551187654321   → ["551187654321", "5511987654321"]   (12 dígitos → adiciona 9)
 *   outros         → [phone]
 */
export function brPhoneVariants(phone: string): string[] {
  if (!phone) return []
  // 55 + DDD (2) + 9 + número (8) = 13 dígitos
  if (phone.startsWith('55') && phone.length === 13 && phone[4] === '9') {
    return [phone, phone.slice(0, 4) + phone.slice(5)]
  }
  // 55 + DDD (2) + número sem 9 (8) = 12 dígitos
  if (phone.startsWith('55') && phone.length === 12) {
    return [phone, phone.slice(0, 4) + '9' + phone.slice(4)]
  }
  return [phone]
}
