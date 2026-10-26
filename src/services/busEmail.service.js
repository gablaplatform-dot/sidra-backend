import { sendMail } from "../emails/mailer.js";
import { busAnnouncement, busOperatorInvite, busTicket, qrUrl } from "../emails/templates.js";
import { ugx } from "../emails/kit.js";

// Every email the bus module sends: operator invitation, the ticket itself, and operator announcements.
// The look and wording live in src/emails; when email isn't configured these report { sent: false } instead
// of throwing, so a missing key never breaks a booking.

export { qrUrl, ugx };

export class BusEmailService {
  send({ to, email }) {
    return sendMail({ to, email });
  }

  sendOperatorInvitation({ to, companyName, link }) {
    return this.send({ to, email: busOperatorInvite({ companyName, link }) });
  }

  sendTicketEmail({ to, booking, trip, route, operator, tickets }) {
    return this.send({ to, email: busTicket({ booking, trip, route, operator, tickets }) });
  }

  sendAnnouncement({ to, operator, title, message, kind, trip, route }) {
    return this.send({ to, email: busAnnouncement({ operator, title, message, kind, trip, route }) });
  }
}
