export type SupportTicketStatus = "open" | "answered" | "closed";
export type SupportSender = "user" | "admin";
export type SupportAttachmentKind = "image" | "video" | "file";

export interface SupportAttachment {
  url: string;
  name: string;
  type: string;
  kind: SupportAttachmentKind;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  sender: SupportSender;
  body: string;
  attachments: SupportAttachment[];
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  messages: SupportMessage[];
}

export interface AdminSupportTicket extends SupportTicket {
  userEmail: string | null;
  userName: string | null;
}
