/* Reconstruction of the real Revolut email, quoted-printable already decoded
   (which is what GmailMessage.getBody() hands you). Markup copied verbatim
   from the raw source Adithya pasted. */

const cell = (kind, colour, text) => `
              <tr>
                <td align="left" class="detailsCells-${kind}" style="font-size:0px;padding:auto;word-break:break-word;">

      <div style="text-align: left; color: ${colour}; font-family: Inter, -apple-system, Roboto, 'Segoe UI', Arial, sans-serif; font-weight: 400; font-size: 16px; line-height: 1.375;">${text}</div>

                </td>
              </tr>`;

const pair = (title, value) =>
  cell('title', '#717173', title) + cell('value', '#000000', value);

const HTML = `<!doctype html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title></title>
    <style type="text/css">
      .detailsCells,
      .transactions-wrapper,
      .detailsCells .detailsCells-value div,
      .transactions-value {
        color: #FFFFFF !important;
      }
      .detailsCells .detailsCells-title div,
      .transactions-title {
        color: #A1A1A3 !important;
      }
    </style>
  </head>
  <body style="word-spacing: normal; width: 100%;">
      <div style="font-family:Inter, -apple-system, Roboto, Arial, sans-serif;font-size:13px;line-height:1;text-align:left;color:#000000;"><h1 style="margin: 0; padding-top: 24px; padding-bottom: 8px; font-family: Aeonik Pro, -apple-system, Roboto, 'Segoe UI', Arial, sans-serif; font-size: 32px; font-weight: 500; color: #191C1F; line-height: 1.125;">Aishwaryya has sent you a transfer</h1></div>

      <div style="font-family:Inter, -apple-system, Roboto, Arial, sans-serif;font-size:13px;line-height:1;text-align:left;color:#000000;"><div class="text-container"><p style="margin: 0; padding: 0; color: #191C1F; font-family: Inter, -apple-system, Roboto, 'Segoe UI', Arial, sans-serif; font-weight: 400; line-height: 1.375; font-size: 16px; padding-top: 8px; padding-bottom: 8px;">Hi Adithya Balagopal,</p><p style="margin: 0; padding: 0; color: #191C1F; font-family: Inter, -apple-system, Roboto, 'Segoe UI', Arial, sans-serif; font-weight: 400; line-height: 1.375; font-size: 16px; padding-top: 8px; padding-bottom: 8px;">Aishwaryya sent you ₹70,000 via a bank transfer from Revolut. You can find the details below:</p></div></div>

      <div class="detailsCells content-block" style="margin: 0px auto; max-width: NaNpx; background-color: #F4F5F6; color: #191C1F; border-radius: 16px; padding: 16px;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
          <tbody>
${pair('Sender', 'Aishwaryya')}
${pair('Recipient', 'Adithya Balagopal')}
${pair('Reference', 'Sent from Revolut')}
${pair('Amount', '₹70,000')}
${pair('Sent on', 'September 9, 2026')}
${pair('Expected by', 'Today')}
          </tbody>
        </table>
      </div>
  </body>
</html>`;

/* The headers Gmail stamped on it, verbatim. */
const RAW_HEADERS = `Delivered-To: adithyab0727@gmail.com
Received: by 2002:a05:6022:111e:b0:10f:5c21:aef6 with SMTP id bd30csp1453363lab; Wed, 9 Sep 2026 10:00:12 -0700 (PDT)
ARC-Authentication-Results: i=1; mx.google.com; dkim=pass header.i=@revolut.com header.s=scph0616 header.b=a7WH5OS9; spf=pass (google.com: domain of msprvs1=20712denw2rpm=bounces-63739@sp-bounce.revolut.com designates 192.174.91.95 as permitted sender) smtp.mailfrom="msprvs1=20712denW2rPM=bounces-63739@sp-bounce.revolut.com"; dmarc=pass (p=QUARANTINE sp=QUARANTINE dis=NONE) header.from=revolut.com
Return-Path: <msprvs1=20712denW2rPM=bounces-63739@sp-bounce.revolut.com>
Authentication-Results: mx.google.com; dkim=pass header.i=@revolut.com header.s=scph0616 header.b=a7WH5OS9; spf=pass (google.com: domain of msprvs1=20712denw2rpm=bounces-63739@sp-bounce.revolut.com designates 192.174.91.95 as permitted sender) smtp.mailfrom="msprvs1=20712denW2rPM=bounces-63739@sp-bounce.revolut.com"; dmarc=pass (p=QUARANTINE sp=QUARANTINE dis=NONE) header.from=revolut.com
Content-Type: text/html; charset="UTF-8"
Subject: You've been sent ₹70,000
Message-ID: <B7.01.08148.B9091AA6@i-0b81e668203cef5c0.mta1vrest.sd.prd.sparkpost>
To: adithyab0727@gmail.com
Date: Wed, 09 Sep 2026 17:00:11 +0000
From: "Revolut" <no-reply@revolut.com>

`;

module.exports = {
  HTML,
  SUBJECT: "You've been sent ₹70,000 ",
  RAW: RAW_HEADERS + HTML,
};
