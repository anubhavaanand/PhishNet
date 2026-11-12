/**
 * Shared email fixtures.
 *
 * `PHISH` and `HAM` are the labelled mini-corpus used by the quality gates in
 * corpus.test.js. They are intentionally small and hand-checked: each item has
 * one unambiguous reason it should be phish or ham.
 */

/** Labelled phishing samples. */
const PHISH = [
  { subject: 'Verify your account now', from: 'security@paypa1-support.tk', body: 'Your account is suspended. Confirm your password immediately at http://bit.ly/9xZ' },
  { subject: 'Unusual sign-in attempt', from: 'no-reply@microsoft-security-check.net', body: 'We detected unauthorized activity. Update your information here http://login-micros0ft.com' },
  { subject: 'Your package could not be delivered', from: 'tracking@dhl-parcel-redelivery.info', body: 'Reschedule your shipment and pay a small fee at http://bit.ly/dhl-redeliver' },
  { subject: 'Invoice overdue - final notice', from: 'billing@invoice-center-notice.top', body: 'Please review the attached invoice and settle immediately.' },
  { subject: 'Security alert: new device login', from: 'alerts@secure-appleid-verify.tk', body: 'Confirm your Apple ID credentials to secure your account.' },
  { subject: 'You won a gift card!', from: 'promo@giveaway-rewards.club', body: 'Act now! Limited time offer. Click here to claim your reward.' },
  { subject: 'Bank account locked', from: 'service@chase-online-verify.xyz', body: 'Unlock your bank account by confirming your credential at once.' },
  { subject: 'IRS tax refund pending', from: 'refunds@irs-gov-payment.review', body: 'Submit your tax refund request before it expires. Government deadline.' },
];

/** Labelled legitimate samples. */
const HAM = [
  { subject: 'Your weekly report is ready', from: 'notifications@github.com', body: 'We processed 1234 transactions. No action required.' },
  { subject: 'Sprint retrospective notes', from: 'lead@company.com', body: 'Key takeaways: keep scope small, write tests first.' },
  { subject: 'Lunch tomorrow?', from: 'friend@example.org', body: 'Want to grab lunch at the usual place around noon?' },
  { subject: 'Order confirmation', from: 'orders@amazon.com', body: 'Your order has shipped. Track it in Your Orders.' },
  { subject: 'Meeting rescheduled', from: 'assistant@company.com', body: 'Moved the design review to Thursday at 3pm.' },
  { subject: 'Welcome to StyleHub', from: 'hello@stylehub.com', body: 'Thanks for subscribing! Here is your welcome discount code.' },
  { subject: 'Course access granted', from: 'support@udemy.com', body: 'You now have lifetime access to the course materials.' },
  { subject: 'Photos from the weekend', from: 'mom@family.net', body: 'Sharing the album from our trip. Take a look when you can!' },
];

/**
 * Turn a labelled sample into the shape heuristicDetect() consumes.
 * @param {{subject:string, from:string, body:string}} sample
 */
function toEmail(sample) {
  const [local, domain] = sample.from.split('@');
  return {
    subject: sample.subject,
    text: sample.body,
    sender: { name: local, email: sample.from, domain },
    links: [],
    attachments: [],
  };
}

module.exports = { PHISH, HAM, toEmail };