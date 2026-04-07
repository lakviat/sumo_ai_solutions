/**
 * Sumo AI Solutions - Consultation Handler
 * Recipient: lakviat@gmail.com
 * Source: sumoaisolutions.com
 *
 * Deployment notes:
 * 1. Google Drive folder ID is already set below.
 * 2. Optionally paste a Google Sheets ID into CONFIG.SPREADSHEET_ID.
 * 3. Deploy this Apps Script as a Web App with access set so your website can submit to it.
 * 4. Paste the deployed Web App URL into the data-endpoint attribute of the consultation form
 *    in index.html and portfolio/index.html.
 */

const CONFIG = {
  RECIPIENT_EMAIL: "lakviat@gmail.com",
  DRIVE_FOLDER_ID: "1JtNb25PG7VDk4Nva9An9oCz655TJNQwT",
  SPREADSHEET_ID: "",
  MAX_ATTACHMENT_BYTES: 10 * 1024 * 1024,
  ALLOWED_EXTENSIONS: ["pdf", "doc", "docx", "txt", "jpg", "jpeg", "png", "zip"],
  ALLOWED_MIME_TYPES: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/jpeg",
    "image/png",
    "application/zip",
    "application/x-zip-compressed",
    "application/octet-stream"
  ]
};

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    validatePayload_(payload);

    const attachmentInfos = storeAttachments_(payload);
    const submission = buildSubmissionRecord_(payload, attachmentInfos);

    if (CONFIG.SPREADSHEET_ID) {
      appendSubmissionToSheet_(submission);
    }

    sendSubmissionEmail_(submission);

    return jsonResponse_(200, {
      success: true,
      message: "Inquiry received by Sumo AI Solutions."
    });
  } catch (error) {
    console.error(error);

    return jsonResponse_(400, {
      success: false,
      message: error.message || "Unexpected error occurred."
    });
  }
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Missing request data.");
  }

  return JSON.parse(e.postData.contents);
}

function validatePayload_(payload) {
  const requiredFields = {
    firstName: "First name is required.",
    lastName: "Last name is required.",
    email: "Email address is required.",
    message: "Project details are required."
  };

  Object.keys(requiredFields).forEach(function (key) {
    if (!String(payload[key] || "").trim()) {
      throw new Error(requiredFields[key]);
    }
  });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payload.email || "").trim())) {
    throw new Error("Invalid email address format.");
  }

  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];

  attachments.forEach(function (attachment) {
    const extension = String(attachment.name || "").split(".").pop().toLowerCase();
    const mimeType = String(attachment.mimeType || "").toLowerCase();

    if (!CONFIG.ALLOWED_EXTENSIONS.includes(extension)) {
      throw new Error("Unsupported file type: " + extension);
    }

    if (Number(attachment.size || 0) > CONFIG.MAX_ATTACHMENT_BYTES) {
      throw new Error("File " + attachment.name + " exceeds the 10 MB limit.");
    }

    if (mimeType && !CONFIG.ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new Error("Unsupported MIME type for " + attachment.name + ".");
    }

    if (!String(attachment.base64 || "").trim()) {
      throw new Error("Attachment payload is missing for " + attachment.name + ".");
    }
  });
}

function storeAttachments_(payload) {
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];

  if (!attachments.length) {
    return [];
  }

  if (!CONFIG.DRIVE_FOLDER_ID || CONFIG.DRIVE_FOLDER_ID.indexOf("PASTE_") === 0) {
    throw new Error("Google Drive folder ID is not configured.");
  }

  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const safeName = sanitizeFilename_(payload.fullName || payload.firstName + "-" + payload.lastName);
  const timestamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyyMMdd-HHmmss"
  );

  return attachments.map(function (attachment, index) {
    const decodedBytes = Utilities.base64Decode(attachment.base64);
    const fileName = timestamp + "_" + safeName + "_" + (index + 1) + "_" + attachment.name;
    const blob = Utilities.newBlob(
      decodedBytes,
      attachment.mimeType || "application/octet-stream",
      fileName
    );
    const file = folder.createFile(blob);

    return {
      name: attachment.name,
      url: file.getUrl(),
      fileId: file.getId()
    };
  });
}

function buildSubmissionRecord_(payload, attachmentInfos) {
  const firstName = String(payload.firstName || "").trim();
  const lastName = String(payload.lastName || "").trim();
  const fullName = String(payload.fullName || (firstName + " " + lastName)).trim();

  return {
    submittedAt: new Date().toISOString(),
    source: String(payload.source || "sumoaisolutions.com").trim(),
    pageUrl: String(payload.pageUrl || "").trim(),
    firstName: firstName,
    lastName: lastName,
    fullName: fullName,
    company: String(payload.company || "N/A").trim(),
    email: String(payload.email || "").trim(),
    phone: String(payload.phone || "N/A").trim(),
    whatsapp: String(payload.whatsapp || "N/A").trim(),
    message: String(payload.message || payload.projectDescription || "").trim(),
    referenceLinks: String(payload.referenceLinks || "N/A").trim(),
    attachments: attachmentInfos || []
  };
}

function sendSubmissionEmail_(submission) {
  const subject = "New Inquiry: " + submission.fullName + " | Sumo AI Solutions";

  const fileListHtml = submission.attachments.length
    ? "<ul>" +
      submission.attachments
        .map(function (attachment) {
          return '<li><a href="' + attachment.url + '">' + escapeHtml_(attachment.name) + "</a></li>";
        })
        .join("") +
      "</ul>"
    : "<p>No attachments uploaded.</p>";

  const htmlBody =
    "<h2>Sumo AI Solutions - New Web Inquiry</h2>" +
    "<p><strong>First name:</strong> " + escapeHtml_(submission.firstName) + "</p>" +
    "<p><strong>Last name:</strong> " + escapeHtml_(submission.lastName) + "</p>" +
    "<p><strong>Full name:</strong> " + escapeHtml_(submission.fullName) + "</p>" +
    "<p><strong>Company:</strong> " + escapeHtml_(submission.company) + "</p>" +
    "<p><strong>Email:</strong> " + escapeHtml_(submission.email) + "</p>" +
    "<p><strong>Phone:</strong> " + escapeHtml_(submission.phone) + "</p>" +
    "<p><strong>WhatsApp:</strong> " + escapeHtml_(submission.whatsapp) + "</p>" +
    "<p><strong>Reference links:</strong><br>" + escapeHtml_(submission.referenceLinks) + "</p>" +
    "<p><strong>Project details:</strong><br>" + escapeHtml_(submission.message) + "</p>" +
    "<h3>Attachments (Saved to Drive):</h3>" +
    fileListHtml +
    "<hr>" +
    "<p><small>Source: " +
    escapeHtml_(submission.source) +
    " | Page: " +
    escapeHtml_(submission.pageUrl || "N/A") +
    " | Submitted: " +
    escapeHtml_(submission.submittedAt) +
    "</small></p>";

  MailApp.sendEmail({
    to: CONFIG.RECIPIENT_EMAIL,
    subject: subject,
    htmlBody: htmlBody,
    name: "Sumo AI Web Notifications"
  });
}

function appendSubmissionToSheet_(submission) {
  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheets()[0];

  sheet.appendRow([
    submission.submittedAt,
    submission.source,
    submission.pageUrl,
    submission.firstName,
    submission.lastName,
    submission.fullName,
    submission.company,
    submission.email,
    submission.phone,
    submission.whatsapp,
    submission.referenceLinks,
    submission.message,
    submission.attachments
      .map(function (attachment) {
        return attachment.url;
      })
      .join(", ")
  ]);
}

function sanitizeFilename_(value) {
  return String(value || "inquiry")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml_(value) {
  return String(value || "")
    .replace(/[&<>"']/g, function (match) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[match];
    })
    .replace(/\n/g, "<br>");
}

function jsonResponse_(statusCode, payload) {
  return ContentService.createTextOutput(
    JSON.stringify(
      Object.assign(
        {
          status: statusCode
        },
        payload
      )
    )
  ).setMimeType(ContentService.MimeType.JSON);
}
