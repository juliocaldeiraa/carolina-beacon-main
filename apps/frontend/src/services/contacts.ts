import { api } from './api'
import type { Contact, ContactDetail, UpdateContactPayload } from '@/types/contact'

export interface ContactListParams {
  search?:    string
  channelId?: string
  tag?:       string
  page?:      number
  limit?:     number
}

export interface ContactListResult {
  items: Contact[]
  total: number
  page:  number
  limit: number
}

export const contactsService = {
  list: (params?: ContactListParams) =>
    api.get<ContactListResult>('/contacts', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<ContactDetail>(`/contacts/${id}`).then((r) => r.data),

  update: (id: string, data: UpdateContactPayload) =>
    api.patch<Contact>(`/contacts/${id}`, data).then((r) => r.data),

  remove: (id: string) =>
    api.delete(`/contacts/${id}`),
}
